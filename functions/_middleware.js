export async function onRequest(context) {
  const { request, next, env } = context;
  
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      }
    });
  }
  
  // Basic rate limiting using KV (if available)
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimit = await checkRateLimit(clientIP, env);
  
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfter: rateLimit.retryAfter
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': rateLimit.retryAfter.toString(),
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
  
  // Continue to the next function
  const response = await next();
  
  // Add CORS headers to all responses
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
}

async function checkRateLimit(clientIP, env) {
  // Simple rate limiting: 100 requests per 15 minutes
  const rateLimitKey = `rate_limit:${clientIP}`;
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 100;
  
  if (!env.RATE_LIMIT_KV) {
    // If KV is not available, allow all requests
    return { allowed: true };
  }
  
  try {
    const currentTime = Date.now();
    const windowStart = currentTime - windowMs;
    
    // Get current count from KV
    const existingData = await env.RATE_LIMIT_KV.get(rateLimitKey);
    let requestData = existingData ? JSON.parse(existingData) : { count: 0, windowStart: currentTime };
    
    // Reset if window has expired
    if (requestData.windowStart < windowStart) {
      requestData = { count: 0, windowStart: currentTime };
    }
    
    // Check if limit exceeded
    if (requestData.count >= maxRequests) {
      const retryAfter = Math.ceil((requestData.windowStart + windowMs - currentTime) / 1000);
      return { allowed: false, retryAfter };
    }
    
    // Increment count and store
    requestData.count++;
    await env.RATE_LIMIT_KV.put(rateLimitKey, JSON.stringify(requestData), {
      expirationTtl: Math.ceil(windowMs / 1000)
    });
    
    return { allowed: true };
  } catch (error) {
    console.error('Rate limiting error:', error);
    // If rate limiting fails, allow the request
    return { allowed: true };
  }
} 