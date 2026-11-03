export async function onRequest(context) {
  const { env } = context;
  
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV || 'production',
      platform: 'cloudflare-pages',
      services: {
        database: !!env.SUPABASE_URL,
        ai: !!env.OPENAI_API_KEY,
      }
    };
    
    return new Response(JSON.stringify(healthStatus), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
} 