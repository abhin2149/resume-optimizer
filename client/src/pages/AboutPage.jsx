import React from 'react';
import { 
  FileText, 
  Zap, 
  Shield, 
  Code, 
  Settings, 
  Users,
  ExternalLink,
  Github,
  Book,
  Sparkles,
  Cpu,
  Brain,
  Layers
} from 'lucide-react';

const AboutPage = () => {
  const techStack = [
    { name: 'Node.js', description: 'Backend runtime environment', icon: Cpu },
    { name: 'Express.js', description: 'Web application framework', icon: Settings },
    { name: 'React', description: 'Frontend user interface library', icon: Layers },
            { name: 'OpenAI GPT-5', description: 'AI language model for content optimization', icon: Brain },
    { name: 'LaTeX', description: 'Document preparation system', icon: FileText },
    { name: 'Tailwind CSS', description: 'Utility-first CSS framework', icon: Sparkles },
    { name: 'Docker', description: 'Containerization platform', icon: Shield }
  ];

  const features = [
    {
      icon: Zap,
      title: 'AI-Powered Optimization',
              description: 'Uses state-of-the-art GPT-5 to intelligently analyze job descriptions and optimize resume content while maintaining the original tone and authenticity.',
      details: [
        'Keyword extraction and integration',
        'Context-aware content modification',
        'Skill matching and emphasis',
        'Industry-specific terminology'
      ]
    },
    {
      icon: Shield,
      title: 'LaTeX Structure Preservation',
      description: 'Maintains every aspect of your LaTeX formatting, from document class to custom macros, ensuring your carefully crafted layout remains intact.',
      details: [
        'Document structure validation',
        'Custom command preservation',
        'Formatting consistency',
        'Error-free compilation'
      ]
    },
    {
      icon: Code,
      title: 'Advanced Processing',
      description: 'Sophisticated text processing pipeline that handles various input formats and ensures high-quality output with comprehensive validation.',
      details: [
        'HTML and PDF artifact removal',
        'UTF-8 encoding validation',
        'LaTeX syntax verification',
        'Compilation error handling'
      ]
    },
    {
      icon: Settings,
      title: 'Production Ready',
      description: 'Built with scalability and reliability in mind, featuring comprehensive error handling, logging, and monitoring capabilities.',
      details: [
        'Docker containerization',
        'Health monitoring',
        'Error logging and recovery',
        'Session management'
      ]
    }
  ];

  const workflow = [
    {
      step: 1,
      title: 'Input Processing',
      description: 'Job descriptions are sanitized and analyzed to extract relevant keywords and requirements.'
    },
    {
      step: 2,
      title: 'Resume Analysis',
      description: 'LaTeX resume structure is parsed and validated while preserving all formatting commands.'
    },
    {
      step: 3,
      title: 'AI Optimization',
              description: 'GPT-5 intelligently modifies bullet points and descriptions to match job requirements.'
    },
    {
      step: 4,
      title: 'Compilation',
      description: 'Optimized LaTeX is compiled to PDF with comprehensive error checking and logging.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Hero Section */}
      <section className="py-20 border-b border-gray-700/50">
        <div className="container-responsive">
          <div className="max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-8 shadow-2xl shadow-blue-500/25">
              <Brain className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-8">
              About Resume Builder
            </h1>
            <p className="text-xl text-gray-300 leading-relaxed mb-12 max-w-4xl mx-auto">
              An intelligent resume tailoring application that leverages AI to optimize 
              LaTeX resumes for specific job descriptions while preserving formatting 
              and structure integrity.
            </p>
            <div className="flex items-center justify-center space-x-8 text-sm text-gray-400">
              <div className="flex items-center group">
                <Users className="h-5 w-5 mr-2 group-hover:text-blue-400 transition-colors" />
                Open Source
              </div>
              <div className="flex items-center group">
                <Shield className="h-5 w-5 mr-2 group-hover:text-green-400 transition-colors" />
                Privacy Focused
              </div>
              <div className="flex items-center group">
                <Code className="h-5 w-5 mr-2 group-hover:text-purple-400 transition-colors" />
                Production Ready
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem & Solution */}
      <section className="py-20">
        <div className="container-responsive">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="card spotlight-card">
              <div className="card-body">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <Zap className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-white">
                    The Problem
                  </h2>
                </div>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  LaTeX users face a unique challenge when tailoring resumes for different 
                  job applications. While LaTeX provides superior formatting control, 
                  manually optimizing content for each position is time-consuming and 
                  requires deep understanding of both the job requirements and effective 
                  resume writing.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  Existing resume builders don't support LaTeX, and generic optimization 
                  tools often destroy carefully crafted formatting and structure.
                </p>
              </div>
            </div>
            <div className="card spotlight-card">
              <div className="card-body">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-white">
                    Our Solution
                  </h2>
                </div>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Resume Builder bridges this gap by providing AI-powered content 
                  optimization specifically designed for LaTeX users. Our system 
                  understands LaTeX syntax and preserves every formatting detail 
                  while intelligently modifying content to match job requirements.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  The result is a perfectly formatted, highly optimized resume that 
                  maintains your professional design while maximizing ATS compatibility 
                  and keyword relevance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Deep Dive */}
      <section className="py-20">
        <div className="container-responsive">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-6">
              Technical Features
            </h2>
            <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
              Built with modern technologies and best practices to deliver 
              reliable, scalable, and intelligent resume optimization.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map(({ icon: Icon, title, description, details }, index) => (
              <div key={index} className="card spotlight-card">
                <div className="card-body">
                  <div className="flex items-start">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mr-6 flex-shrink-0 shadow-lg">
                      <Icon className="h-8 w-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-4">
                        {title}
                      </h3>
                      <p className="text-gray-300 mb-6 leading-relaxed">
                        {description}
                      </p>
                      <ul className="space-y-3">
                        {details.map((detail, i) => (
                          <li key={i} className="text-sm text-gray-400 flex items-center">
                            <div className="w-2 h-2 bg-blue-400 rounded-full mr-3 flex-shrink-0" />
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="py-20">
        <div className="container-responsive">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-6">
              How It Works
            </h2>
            <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
              Our sophisticated processing pipeline ensures accurate, reliable, 
              and high-quality resume optimization.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {workflow.map(({ step, title, description }, index) => (
              <div key={index} className="text-center group">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">
                  {step}
                </div>
                <h3 className="text-xl font-bold text-white mb-4">
                  {title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="py-20">
        <div className="container-responsive">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-6">
              Technology Stack
            </h2>
            <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed">
              Built with modern, reliable technologies to ensure performance, 
              scalability, and maintainability.
            </p>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            {techStack.map(({ name, description, icon: Icon }, index) => (
              <div key={index} className="card spotlight-card text-center group">
                <div className="card-body">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold text-white mb-3">
                    {name}
                  </h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Source & Resources */}
      <section className="py-20 bg-gradient-to-r from-blue-900/30 to-blue-800/30 border-y border-blue-500/30">
        <div className="container-responsive text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Open Source & Resources
          </h2>
          <p className="text-xl text-blue-200 mb-12 max-w-4xl mx-auto leading-relaxed">
            Resume Builder is open source and welcomes contributions from the community. 
            Explore the code, documentation, and learn more about the technologies we use.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center bg-white text-gray-900 px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all duration-300 transform hover:scale-105 shadow-lg group"
            >
              <Github className="mr-3 h-6 w-6 group-hover:text-blue-600 transition-colors" />
              View Source Code
              <ExternalLink className="ml-3 h-5 w-5" />
            </a>
            <a
              href="https://openai.com/api/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center border-2 border-white text-white px-8 py-4 rounded-xl font-bold hover:bg-white hover:text-gray-900 transition-all duration-300 transform hover:scale-105 shadow-lg group"
            >
              <Book className="mr-3 h-6 w-6 group-hover:text-blue-600 transition-colors" />
              OpenAI Documentation
              <ExternalLink className="ml-3 h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      {/* Contact & Support */}
      <section className="py-20">
        <div className="container-responsive">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-white mb-6">
              Support & Contributing
            </h2>
            <p className="text-xl text-gray-300 mb-12 leading-relaxed">
              Have questions, suggestions, or want to contribute? We'd love to hear from you!
            </p>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="card spotlight-card text-center group">
                <div className="card-body">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Github className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-bold text-white mb-4 text-xl">Issues</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Report bugs or request features on GitHub
                  </p>
                </div>
              </div>
              <div className="card spotlight-card text-center group">
                <div className="card-body">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Code className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-bold text-white mb-4 text-xl">Contribute</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Submit pull requests to improve the codebase
                  </p>
                </div>
              </div>
              <div className="card spotlight-card text-center group">
                <div className="card-body">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Book className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-bold text-white mb-4 text-xl">Documentation</h3>
                  <p className="text-gray-300 leading-relaxed">
                    Read the docs for setup and usage guides
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage; 