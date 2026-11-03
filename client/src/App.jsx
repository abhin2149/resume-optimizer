import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Authentication
import { AuthProvider } from './contexts/AuthContext';

// Layout components
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';

// Page components
import HomePage from './pages/HomePage';
import TailorPage from './pages/TailorPage';
import ResultsPage from './pages/ResultsPage';
import AboutPage from './pages/AboutPage';
import DashboardPage from './pages/DashboardPage';

import './App.css';

function App() {
  useEffect(() => {
    // Add spotlight effect mouse tracking
    const handleMouseMove = (e) => {
      const cards = document.querySelectorAll('.spotlight-card');
      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="App flex flex-col min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/tailor" element={<TailorPage />} />
              <Route path="/results/:sessionId" element={<ResultsPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Routes>
          </main>
          <Footer />
          
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="dark"
            toastClassName="backdrop-blur-sm"
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App; 