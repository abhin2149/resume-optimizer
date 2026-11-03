import React from 'react';
import { Github, Heart, ExternalLink } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-900/90 backdrop-blur-lg border-t border-gray-700/50 mt-auto">
      <div className="container-responsive py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">RB</span>
              </div>
              Resume Builder
            </h3>
            <p className="text-gray-300 text-sm leading-relaxed mb-6 max-w-lg">
              AI-powered resume tailoring application that optimizes LaTeX resumes 
              for specific job descriptions while preserving formatting and structure. 
              Built with precision, designed for professionals.
            </p>
            <div className="flex items-center text-sm text-gray-400">
              Made with <Heart className="h-4 w-4 text-red-400 mx-2 animate-pulse" /> using Node.js, React, and OpenAI GPT-5
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wide">
              Quick Links
            </h4>
            <ul className="space-y-3">
              <li>
                <a href="/" className="text-gray-300 hover:text-blue-400 text-sm transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-125"></span>
                  Home
                </a>
              </li>
              <li>
                <a href="/tailor" className="text-gray-300 hover:text-blue-400 text-sm transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-125"></span>
                  Tailor Resume
                </a>
              </li>
              <li>
                <a href="/about" className="text-gray-300 hover:text-blue-400 text-sm transition-colors duration-300 flex items-center group">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-125"></span>
                  About
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-wide">
              Resources
            </h4>
            <ul className="space-y-3">
              <li>
                <a 
                  href="https://openai.com/api/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-blue-400 text-sm transition-colors duration-300 flex items-center group"
                >
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-125"></span>
                  OpenAI API
                  <ExternalLink className="h-3 w-3 ml-2 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                </a>
              </li>
              <li>
                <a 
                  href="https://www.latex-project.org/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-blue-400 text-sm transition-colors duration-300 flex items-center group"
                >
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-125"></span>
                  LaTeX Documentation
                  <ExternalLink className="h-3 w-3 ml-2 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                </a>
              </li>
              <li>
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-blue-400 text-sm transition-colors duration-300 flex items-center group"
                >
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-125"></span>
                  <Github className="h-4 w-4 mr-2" />
                  Source Code
                  <ExternalLink className="h-3 w-3 ml-2 opacity-0 group-hover:opacity-100 transition-all duration-300" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom section */}
        <div className="border-t border-gray-700/50 pt-8 mt-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} Resume Builder. Built for educational purposes.
            </p>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-400 text-sm">
                  Powered by OpenAI GPT-5
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 