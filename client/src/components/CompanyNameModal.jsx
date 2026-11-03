import React, { useState, useEffect } from 'react';
import { X, Briefcase, AlertCircle, Sparkles } from 'lucide-react';

const CompanyNameModal = ({ isOpen, onClose, onConfirm, defaultCompany = '' }) => {
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCompanyName(defaultCompany);
      setError('');
    }
  }, [isOpen, defaultCompany]);

  const validateCompanyName = (name) => {
    if (!name.trim()) {
      return 'Company name cannot be empty';
    }
    
    // Check if company name is too long
    if (name.length > 100) {
      return 'Company name is too long (max 100 characters)';
    }
    
    // Check for excessive special characters
    const specialCharCount = (name.match(/[^a-zA-Z0-9\s&,.\-\(\)]/g) || []).length;
    if (specialCharCount > name.length * 0.3) {
      return 'Company name contains too many special characters';
    }
    
    return '';
  };

  const handleCompanyNameChange = (e) => {
    const value = e.target.value;
    setCompanyName(value);
    
    const validationError = validateCompanyName(value);
    setError(validationError);
  };

  const handleConfirm = () => {
    const validationError = validateCompanyName(companyName);
    
    if (validationError) {
      setError(validationError);
      return;
    }
    
    const finalCompanyName = companyName.trim();
    onConfirm(finalCompanyName);
    onClose();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center">
            <Briefcase className="h-5 w-5 mr-2 text-blue-400" />
            Enter Company Name
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-gray-300 text-sm mb-4">
          Please enter the company name for this position to help tailor your resume more effectively:
        </p>

        {/* Input Field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Company Name
          </label>
          <input
            type="text"
            value={companyName}
            onChange={handleCompanyNameChange}
            onKeyPress={handleKeyPress}
            className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-600'
            }`}
            placeholder="e.g., Google, Microsoft, Acme Corp..."
            autoFocus
          />
          {error && (
            <p className="text-red-400 text-sm mt-1 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {error}
            </p>
          )}
        </div>

        {/* Preview/Info */}
        <div className="mb-6 p-3 bg-blue-900/30 rounded-lg border border-blue-700/50">
          <div className="flex items-start">
            <Sparkles className="h-4 w-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-blue-300 font-medium mb-1">AI Tailoring</p>
              <p className="text-xs text-blue-200">
                Your resume will be specifically tailored for {companyName.trim() || 'this company'}, 
                optimizing keywords and content to match their job requirements.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!!error || !companyName.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Start Tailoring
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyNameModal; 