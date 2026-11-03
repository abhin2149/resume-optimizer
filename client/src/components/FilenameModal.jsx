import React, { useState, useEffect } from 'react';
import { X, Download, FileText, AlertCircle } from 'lucide-react';

const FilenameModal = ({ isOpen, onClose, onConfirm, defaultFilename = '', sessionId = '' }) => {
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Generate default filename if none provided
      const defaultName = defaultFilename || `tailored_resume_${sessionId || 'download'}`;
      setFilename(defaultName);
      setError('');
    }
  }, [isOpen, defaultFilename, sessionId]);

  const validateFilename = (name) => {
    if (!name.trim()) {
      return 'Filename cannot be empty';
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(name)) {
      return 'Filename contains invalid characters (<>:"/\\|?*)';
    }
    
    // Check if filename is too long
    if (name.length > 200) {
      return 'Filename is too long (max 200 characters)';
    }
    
    return '';
  };

  const handleFilenameChange = (e) => {
    const value = e.target.value;
    setFilename(value);
    
    const validationError = validateFilename(value);
    setError(validationError);
  };

  const handleConfirm = () => {
    const validationError = validateFilename(filename);
    
    if (validationError) {
      setError(validationError);
      return;
    }
    
    // Ensure .pdf extension
    let finalFilename = filename.trim();
    if (!finalFilename.toLowerCase().endsWith('.pdf')) {
      finalFilename += '.pdf';
    }
    
    onConfirm(finalFilename);
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
            <FileText className="h-5 w-5 mr-2 text-blue-400" />
            Name Your PDF
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
          Choose a name for your tailored resume PDF file:
        </p>

        {/* Input Field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Filename
          </label>
          <input
            type="text"
            value={filename}
            onChange={handleFilenameChange}
            onKeyPress={handleKeyPress}
            className={`w-full px-3 py-2 bg-gray-700 border rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-600'
            }`}
            placeholder="Enter filename..."
            autoFocus
          />
          {!filename.toLowerCase().endsWith('.pdf') && filename.trim() && (
            <p className="text-xs text-gray-400 mt-1">
              .pdf extension will be added automatically
            </p>
          )}
          {error && (
            <p className="text-red-400 text-sm mt-1 flex items-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              {error}
            </p>
          )}
        </div>

        {/* Preview */}
        <div className="mb-6 p-3 bg-gray-700/50 rounded-lg">
          <p className="text-xs text-gray-400 mb-1">Preview:</p>
          <p className="text-sm text-gray-200 font-mono">
            {filename.trim() 
              ? (filename.toLowerCase().endsWith('.pdf') ? filename : filename + '.pdf')
              : 'filename.pdf'
            }
          </p>
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
            disabled={!!error || !filename.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilenameModal; 