import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Github } from 'lucide-react';
import Navbar from './components/layout/Navbar';
import RecentView from './components/dashboard/RecentView';
import SetupView from './components/setup/SetupView';
import ApiEndpointsView from './components/api/ApiEndpointsView';
import LibrariesView from './components/libraries/LibrariesView';
import FormatSettingsView from './components/settings/FormatSettingsView';
import HomepageConfigView from './components/settings/HomepageConfigView';

/**
 * Footer Component
 */
export const Footer = () => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 p-2 bg-black/20 backdrop-blur-sm border-t border-white/5 text-center z-10">
      <div className="container mx-auto flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Created by <a href="https://github.com/10mfox" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors duration-200" style={{ color: `rgb(var(--accent))` }}>10mfox</a>
        </div>
        <a href="https://github.com/10mfox/Gethomepage-Audiobookshelf-Api" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors duration-200">
          <Github className="h-5 w-5" />
        </a>
      </div>
    </footer>
  );
};

/**
 * Main Application Component
 */
function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white pb-16">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<RecentView />} />
          <Route path="/setup" element={<SetupView />} />
          <Route path="/libraries" element={<LibrariesView />} />
          <Route path="/formats" element={<FormatSettingsView />} />
          <Route path="/homepage" element={<HomepageConfigView />} />
          <Route path="/api" element={<ApiEndpointsView />} />
          <Route path="*" element={<NotFoundView />} />
        </Routes>
      </main>
      
      <Footer />
    </div>
  );
}

/**
 * 404 Not Found view
 */
const NotFoundView = () => {
  return (
    <div className="section-spacing">
      <h1 className="text-2xl font-bold text-white mb-6">404 - Page Not Found</h1>
      <div className="dark-panel p-12 text-center">
        <p className="text-xl text-gray-400">The page you are looking for does not exist.</p>
      </div>
    </div>
  );
};

export default App;