import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import { 
  ArrowRight, 
  FileText, 
  Briefcase, 
  Zap, 
  Shield, 
  Download,
  CheckCircle,
  Star
} from 'lucide-react';
import SpotlightCard from '../components/SpotlightCard';
import GlareHover from '../components/GlareHover';
import TiltedCard from '../components/TiltedCard';


const HomePage = () => {
  const [isPaused, setIsPaused] = useState(false);
  const controls = useAnimation();

  const features = [
    {
      icon: Zap,
      title: 'Advanced NLP Optimization',
      description: 'Revolutionary bullet-by-bullet analysis using advanced NLP to seamlessly integrate keywords while preserving natural language flow.'
    },
    {
      icon: Shield,
      title: 'Education Section Protection',
      description: 'Completely preserves your education section while strategically optimizing experience and skills sections with precision engineering.'
    },
    {
      icon: FileText,
      title: 'Strategic Skills Enhancement',
      description: 'Intelligently adds 3-5 job-relevant keywords to your Technical Skills section with semantic clustering and natural integration.'
    },
    {
      icon: Download,
      title: 'Context-Aware Integration',
      description: 'Uses semantic similarity and context analysis to enhance each bullet point without forced keyword placement or boastful language.'
    }
  ];

  const steps = [
    {
      step: '01',
      title: 'Upload Job Description',
      description: 'Paste the job description you want to tailor your resume for.'
    },
    {
      step: '02',
      title: 'Choose Resume Template',
      description: 'Use our default template or upload your own LaTeX resume file.'
    },
    {
      step: '03',
      title: 'AI Optimization',
      description: 'Our AI analyzes and optimizes your resume content for the specific role.'
    },
    {
      step: '04',
      title: 'Download Results',
      description: 'Get your tailored LaTeX source code and compiled PDF resume.'
    }
  ];

  const testimonials = [
    {
      name: 'Alex Chen',
      role: 'Senior Software Engineer at Google',
      content: 'Helped me tailor my resume for different tech roles while keeping my LaTeX formatting perfect. The AI optimization is incredible!',
      rating: 5
    },
    {
      name: 'Sarah Rodriguez',
      role: 'Data Scientist at Meta',
      content: 'The keyword optimization really improved my ATS success rate for data science positions. Landed 3 interviews in one week!',
      rating: 5
    },
    {
      name: 'Michael Thompson',
      role: 'Product Manager at Stripe',
      content: 'Great tool for customizing my resume for different product management opportunities. The precision is unmatched.',
      rating: 5
    },
    {
      name: 'Emily Zhang',
      role: 'DevOps Engineer at Amazon',
      content: 'Revolutionary approach to resume optimization. The bullet-by-bullet analysis caught details I never noticed.',
      rating: 5
    },
    {
      name: 'David Kumar',
      role: 'Machine Learning Engineer at OpenAI',
      content: 'Perfect for AI roles! The semantic analysis understands technical context better than any tool I\'ve used.',
      rating: 5
    },
    {
      name: 'Jessica Martinez',
      role: 'UX Designer at Apple',
      content: 'Maintained my design portfolio links while optimizing content. The education section protection is a game-changer.',
      rating: 5
    },
    {
      name: 'Ryan O\'Connor',
      role: 'Cybersecurity Analyst at Microsoft',
      content: 'Impressed by the surgical precision. Added relevant security keywords without changing my professional tone.',
      rating: 5
    },
    {
      name: 'Priya Patel',
      role: 'Full Stack Developer at Netflix',
      content: 'The best resume tool for developers. Handles technical skills optimization flawlessly while preserving formatting.',
      rating: 5
    }
  ];

  const totalCards = testimonials.length;
  const cardWidth = 408; // 384px + 24px gap
  const maxOffset = -(cardWidth * totalCards);

  const handleMouseEnter = () => {
    setIsPaused(true);
    controls.stop();
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    // Resume auto-scroll from current position
    controls.start({
      x: maxOffset,
      transition: {
        duration: totalCards * 4,
        ease: "linear",
        repeat: Infinity,
        repeatType: "loop"
      }
    });
  };

  // Initialize auto-scroll
  useEffect(() => {
    if (!isPaused) {
      controls.start({
        x: maxOffset,
        transition: {
          duration: totalCards * 4,
          ease: "linear",
          repeat: Infinity,
          repeatType: "loop"
        }
      });
    }
  }, [controls, maxOffset, totalCards, isPaused]);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-50 to-blue-100 py-16 lg:py-24">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            {/* Achievement Badge */}
            <div className="inline-flex items-center bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2 rounded-full text-sm font-semibold mb-8 shadow-lg">
              <CheckCircle className="mr-2 h-4 w-4" />
              Advanced AI Optimization
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 mb-8 max-w-6xl mx-auto leading-tight">
              <span className="text-primary-600">Surgical AI</span>{' '}
              Resume Optimization
            </h1>
            <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 mb-12 leading-relaxed max-w-5xl mx-auto">
              Revolutionary <span className="font-semibold text-gray-800">bullet-by-bullet NLP analysis</span> that performs 
              precision keyword integration while preserving your LaTeX formatting perfectly.
            </p>
            
            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 lg:gap-8 max-w-4xl mx-auto mb-12">
              <GlareHover
                width="100%"
                height="auto"
                background="rgba(255, 255, 255, 0.8)"
                borderRadius="0.75rem"
                borderColor="rgba(255, 255, 255, 0.2)"
                glareColor="#3b82f6"
                glareOpacity={0.3}
                glareAngle={-45}
                glareSize={150}
                transitionDuration={500}
                className="backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300"
              >
                <div className="p-6 lg:p-8 text-center w-full">
                  <div className="text-3xl lg:text-4xl font-bold text-primary-600 mb-2">10/10</div>
                  <div className="text-base text-gray-600">Surgical Precision</div>
                </div>
              </GlareHover>
              
              <GlareHover
                width="100%"
                height="auto"
                background="rgba(255, 255, 255, 0.8)"
                borderRadius="0.75rem"
                borderColor="rgba(255, 255, 255, 0.2)"
                glareColor="#10b981"
                glareOpacity={0.3}
                glareAngle={-45}
                glareSize={150}
                transitionDuration={500}
                className="backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300"
              >
                <div className="p-6 lg:p-8 text-center w-full">
                  <div className="text-3xl lg:text-4xl font-bold text-green-600 mb-2">100%</div>
                  <div className="text-base text-gray-600">Section Protection</div>
                </div>
              </GlareHover>
              
              <GlareHover
                width="100%"
                height="auto"
                background="rgba(255, 255, 255, 0.8)"
                borderRadius="0.75rem"
                borderColor="rgba(255, 255, 255, 0.2)"
                glareColor="#2563eb"
                glareOpacity={0.3}
                glareAngle={-45}
                glareSize={150}
                transitionDuration={500}
                className="backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow duration-300"
              >
                <div className="p-6 lg:p-8 text-center w-full">
                  <div className="text-3xl lg:text-4xl font-bold text-blue-600 mb-2">&lt;10%</div>
                  <div className="text-base text-gray-600">Content Addition</div>
                </div>
              </GlareHover>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
              <Link
                to="/tailor"
                className="btn-primary text-base px-6 py-3 flex items-center justify-center bg-gradient-to-r from-primary-600 to-blue-600 hover:from-primary-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
              >
                Start AI Optimization
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                to="/about"
                className="btn-secondary text-base px-6 py-3 flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 whitespace-nowrap"
              >
                View Details
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-900">
        <div className="container-responsive">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              Advanced AI Optimization Technology
            </h2>
            <p className="text-xl text-gray-300 max-w-4xl mx-auto">
              Experience professional-grade resume tailoring with <span className="font-semibold text-primary-400">surgical precision</span>. 
              Our advanced NLP engine performs bullet-by-bullet analysis while maintaining 100% education section protection 
              and staying within strict content limits.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map(({ icon: Icon, title, description }, index) => (
              <SpotlightCard 
                key={index} 
                className="text-center h-full"
                spotlightColor="rgba(37, 99, 235, 0.2)"
              >
                <div className="w-16 h-16 bg-primary-600/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Icon className="h-8 w-8 text-primary-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {description}
                </p>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50 overflow-hidden">
        <div className="container-responsive">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <motion.h2 
              className="text-4xl font-bold text-gray-900 mb-4"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{}}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              How It Works
            </motion.h2>
            <motion.p 
              className="text-xl text-gray-600 max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{}}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              Simple 4-step process to get your perfectly tailored resume
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map(({ step, title, description }, index) => (
              <motion.div 
                key={index} 
                className="relative"
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ margin: "-50px" }}
                transition={{ 
                  duration: 0.6, 
                  delay: index * 0.2,
                  type: "spring",
                  stiffness: 100,
                  damping: 15
                }}
                whileHover={{ 
                  y: -10,
                  transition: { duration: 0.3, type: "spring", stiffness: 400 }
                }}
              >
                <div className="text-center group">
                  <motion.div 
                    className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold relative overflow-hidden"
                    whileHover={{ 
                      scale: 1.1,
                      boxShadow: "0 10px 25px rgba(59, 130, 246, 0.4)"
                    }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-primary-500 to-blue-500 opacity-0 group-hover:opacity-100"
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                    <motion.span
                      className="relative z-10"
                      initial={{ rotateY: 0 }}
                      whileHover={{ rotateY: 360 }}
                      transition={{ duration: 0.6 }}
                    >
                      {step}
                    </motion.span>
                  </motion.div>
                  
                  <motion.h3 
                    className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors duration-300"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{}}
                    transition={{ delay: index * 0.2 + 0.3, duration: 0.4 }}
                  >
                    {title}
                  </motion.h3>
                  
                  <motion.p 
                    className="text-gray-600 text-sm leading-relaxed"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{}}
                    transition={{ delay: index * 0.2 + 0.5, duration: 0.4 }}
                  >
                    {description}
                  </motion.p>
                </div>
                
              </motion.div>
            ))}
          </div>

        </div>
      </section>

      {/* Achievement Metrics Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="container-responsive">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why trust it?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our advanced optimization engine delivers enterprise-grade results with measurable quality scores
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <div className="bg-white rounded-2xl p-8 shadow-lg text-center border border-gray-100">
              <div className="text-4xl font-bold text-green-600 mb-2">
                10/10
              </div>
              <div className="text-lg font-semibold text-gray-900 mb-2">
                Quality Score
              </div>
              <div className="text-sm text-gray-600">
                Bullet-by-bullet NLP optimization with perfect context awareness
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-lg text-center border border-gray-100">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                100%
              </div>
              <div className="text-lg font-semibold text-gray-900 mb-2">
                Section Protection
              </div>
              <div className="text-sm text-gray-600">
                Preserves your personal information without changing content
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-lg text-center border border-gray-100">
              <div className="text-4xl font-bold text-purple-600 mb-2">
                &lt;10%
              </div>
              <div className="text-lg font-semibold text-gray-900 mb-2">
                Content Addition
              </div>
              <div className="text-sm text-gray-600">
                Strategic enhancement within strict content limits
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-lg text-center border border-gray-100">
              <div className="text-4xl font-bold text-orange-600 mb-2">
                0%
              </div>
              <div className="text-lg font-semibold text-gray-900 mb-2">
                Boastful Language
              </div>
              <div className="text-sm text-gray-600">
                No artificial buzzwords or explanatory appendages
              </div>
            </div>
          </div>

          <div className="text-center mb-12">
            <div className="inline-flex items-center bg-gradient-to-r from-primary-100 to-blue-100 text-primary-700 px-6 py-2 rounded-full text-sm font-semibold mb-4">
              <CheckCircle className="mr-2 h-4 w-4" />
              Technical Excellence
            </div>
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Key Technical Achievements
            </h3>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Breakthrough innovations that set our AI optimization apart from traditional resume tools
            </p>
          </div>
          <div className="grid md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-16 lg:gap-20 xl:gap-24 max-w-full mx-auto px-12 lg:px-16">
            <div className="p-8 lg:p-12">
              <TiltedCard
              imageSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23111827'/%3E%3Cg transform='translate(200,200)'%3E%3Ccircle r='50' fill='%233b82f6' opacity='0.2'/%3E%3Cpath d='M-25,-25 L25,-25 L25,25 L-25,25 Z' fill='%233b82f6' opacity='0.9'/%3E%3Ctext y='7' text-anchor='middle' fill='%23ffffff' font-family='Arial' font-size='18' font-weight='bold'%3ENLP%3C/text%3E%3C/g%3E%3C/svg%3E"
              altText="Advanced NLP Integration"
              containerHeight="400px"
              imageHeight="400px"
              imageWidth="400px"
              scaleOnHover={1.05}
              rotateAmplitude={10}
              showMobileWarning={false}
              showTooltip={false}
              displayOverlayContent={true}
              overlayContent={
                <div className="w-full h-full bg-gradient-to-br from-gray-900/95 to-slate-800/95 rounded-2xl p-8 text-white flex flex-col justify-center border border-gray-700/50">
                  <div className="flex items-center mb-6">
                    <CheckCircle className="mr-3 h-7 w-7 text-blue-400" />
                    <h4 className="text-2xl font-bold">Advanced NLP Integration</h4>
                  </div>
                  <ul className="space-y-4 text-base text-gray-200">
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Semantic similarity analysis for natural keyword placement
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Context-aware enhancement preserving professional tone
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Intelligent action verb optimization
                    </li>
                  </ul>
                </div>
              }
              />
            </div>

            <div className="p-8 lg:p-12">
              <TiltedCard
                imageSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23111827'/%3E%3Cg transform='translate(200,200)'%3E%3Ccircle r='50' fill='%2310b981' opacity='0.2'/%3E%3Cpath d='M-25,-25 L25,-25 L25,25 L-25,25 Z' fill='%2310b981' opacity='0.9'/%3E%3Ctext y='0' text-anchor='middle' fill='%23ffffff' font-family='Arial' font-size='14' font-weight='bold'%3E%3Ctspan x='0' dy='-4'%3ESKILLS%3C/tspan%3E%3Ctspan x='0' dy='18'%3EENHANCE%3C/tspan%3E%3C/text%3E%3C/g%3E%3C/svg%3E"
              altText="Strategic Skills Enhancement"
              containerHeight="400px"
              imageHeight="400px"
              imageWidth="400px"
              scaleOnHover={1.05}
              rotateAmplitude={10}
              showMobileWarning={false}
              showTooltip={false}
              displayOverlayContent={true}
              overlayContent={
                <div className="w-full h-full bg-gradient-to-br from-gray-900/95 to-slate-800/95 rounded-2xl p-8 text-white flex flex-col justify-center border border-gray-700/50">
                  <div className="flex items-center mb-6">
                    <CheckCircle className="mr-3 h-7 w-7 text-green-400" />
                    <h4 className="text-2xl font-bold">Strategic Skills Enhancement</h4>
                  </div>
                  <ul className="space-y-4 text-base text-gray-200">
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Gap analysis between resume and job requirements
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Semantic clustering of related technologies
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Natural integration without disrupting structure
                    </li>
                  </ul>
                </div>
              }
              />
            </div>

            <div className="p-8 lg:p-12">
              <TiltedCard
                imageSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23111827'/%3E%3Cg transform='translate(200,200)'%3E%3Ccircle r='50' fill='%23f59e0b' opacity='0.2'/%3E%3Cpath d='M-25,-25 L25,-25 L25,25 L-25,25 Z' fill='%23f59e0b' opacity='0.9'/%3E%3Ctext y='0' text-anchor='middle' fill='%23ffffff' font-family='Arial' font-size='12' font-weight='bold'%3E%3Ctspan x='0' dy='-6'%3ESURGICAL%3C/tspan%3E%3Ctspan x='0' dy='12'%3EBULLET%3C/tspan%3E%3Ctspan x='0' dy='12'%3EOPT%3C/tspan%3E%3C/text%3E%3C/g%3E%3C/svg%3E"
              altText="Surgical Bullet-by-Bullet Optimization"
              containerHeight="400px"
              imageHeight="400px"
              imageWidth="400px"
              scaleOnHover={1.05}
              rotateAmplitude={10}
              showMobileWarning={false}
              showTooltip={false}
              displayOverlayContent={true}
              overlayContent={
                <div className="w-full h-full bg-gradient-to-br from-gray-900/95 to-slate-800/95 rounded-2xl p-8 text-white flex flex-col justify-center border border-gray-700/50">
                  <div className="flex items-center mb-6">
                    <CheckCircle className="mr-3 h-7 w-7 text-amber-400" />
                    <h4 className="text-2xl font-bold">Surgical Bullet Optimization</h4>
                  </div>
                  <ul className="space-y-4 text-base text-gray-200">
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Individual bullet point analysis and enhancement
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Precision keyword integration without disruption
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Maintains exact formatting and structure
                    </li>
                  </ul>
                </div>
              }
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="container-responsive">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Trusted by Professionals
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See how our resume builder has helped professionals land their dream jobs
            </p>
          </div>
        </div>

        {/* Full Width Infinite Scroll Container */}
        <div 
          className="w-full overflow-hidden relative"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <motion.div
            className="flex gap-6"
            animate={controls}
            initial={{ x: 0 }}
            style={{ width: `${(testimonials.length * 2) * 100}%` }}
          >
            {/* Duplicate testimonials for seamless loop */}
            {[...testimonials, ...testimonials].map((testimonial, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-96 mx-3"
              >
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 shadow-lg border border-gray-100 h-80 flex flex-col justify-between relative overflow-hidden">
                  {/* Decorative background element */}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary-50 rounded-full opacity-30 transform translate-x-12 -translate-y-12"></div>
                  
                  <div>
                    <div className="flex items-center justify-center mb-6">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-5 w-5 text-yellow-400 fill-current mx-0.5" />
                      ))}
                    </div>
                    
                    <blockquote className="text-gray-700 mb-6 italic leading-relaxed text-center relative z-10">
                      "{testimonial.content}"
                    </blockquote>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-6 text-center relative z-10">
                    <div className="font-bold text-gray-900 text-lg mb-1">
                      {testimonial.name}
                    </div>
                    <div className="text-primary-600 font-semibold text-sm">
                      {testimonial.role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>

        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary-600 via-blue-600 to-primary-700">
        <div className="container-responsive text-center">
          <div className="max-w-4xl mx-auto">
            {/* Achievement Highlight */}
            <div className="inline-flex items-center bg-white/20 backdrop-blur-sm text-white px-6 py-2 rounded-full text-sm font-semibold mb-6">
              <Star className="mr-2 h-4 w-4 fill-current" />
              Production-Ready • Advanced Precision • Professional Grade
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Experience the Future of Resume Optimization
            </h2>
            <p className="text-xl text-primary-100 mb-8 max-w-3xl mx-auto leading-relaxed">
              Join professionals using our <span className="font-semibold text-white">advanced AI optimization</span> to land their dream jobs. 
              Revolutionary bullet-by-bullet analysis with 10/10 quality scores.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/tailor"
                className="inline-flex items-center bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Briefcase className="mr-2 h-5 w-5" />
                Try AI Optimization
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center border-2 border-white text-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-primary-600 transition-all duration-200"
              >
                <FileText className="mr-2 h-5 w-5" />
                View Technical Specs
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage; 