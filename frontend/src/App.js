import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import RecentView from './components/dashboard/RecentView';
import SetupView from './components/setup/SetupView';
import ApiEndpointsView from './components/api/ApiEndpointsView';
import LibrariesView from './components/libraries/LibrariesView';
import FormatSettingsView from './components/settings/FormatSettingsView';
import HomepageConfigView from './components/settings/HomepageConfigView';

/**
 * Main Application Component
 */
function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
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
      
      <footer className="mt-12 py-6 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
          <p>Audiobookshelf Manager • Refresh Interval: 60 seconds</p>
        </div>
      </footer>
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