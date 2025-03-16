import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';

/**
 * Setup view component for configuring Audiobookshelf connection
 */
const SetupView = () => {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [homepageIp, setHomepageIp] = useState('');
  const [libraries, setLibraries] = useState([]);
  const [selectedLibraries, setSelectedLibraries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showApiToken, setShowApiToken] = useState(false);

  // Fetch current configuration on component mount
  useEffect(() => {
    fetchConfiguration();
  }, []);

  /**
   * Fetch current configuration from API
   */
  const fetchConfiguration = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config');
      const config = await response.json();
      
      setBaseUrl(config.baseUrl || '');
      setApiToken(config.apiToken || '');
      setHomepageIp(config.homepageIp || '');
      
      if (config.libraryIds) {
        setSelectedLibraries(config.libraryIds.split(','));
      } else if (config.libraryId) {
        // For backward compatibility
        setSelectedLibraries([config.libraryId]);
      }
      
      if (config.baseUrl && config.apiToken) {
        await fetchLibraries(config.baseUrl, config.apiToken);
      }
      
    } catch (error) {
      console.error('Error fetching configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch available libraries from Audiobookshelf
   */
  const fetchLibraries = async (url = baseUrl, token = apiToken) => {
    if (!url || !token) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Clean up base URL by ensuring it starts with http:// or https:// and removing trailing slashes
      let cleanUrl = url.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'http://' + cleanUrl;
      }
      cleanUrl = cleanUrl.replace(/\/+$/, '');
      
      // Use the proxy endpoint to avoid CORS issues
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          url: `${cleanUrl}/api/libraries?token=${encodeURIComponent(token)}`
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch libraries: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Libraries API response:', data);
      
      if (data.libraries && Array.isArray(data.libraries)) {
        // Initialize an array to hold libraries with their stats
        const librariesWithStats = [];
        
        // For each library, fetch its stats
        for (const lib of data.libraries) {
          try {
            const statsResponse = await fetch('/api/proxy', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                url: `${cleanUrl}/api/libraries/${lib.id}/stats?token=${encodeURIComponent(token)}`
              })
            });
            
            if (statsResponse.ok) {
              const statsData = await statsResponse.json();
              librariesWithStats.push({
                id: lib.id,
                name: lib.name,
                mediaType: lib.mediaType || 'audiobook',
                itemCount: statsData.totalItems || 0
              });
            } else {
              // If stats aren't available, use any available item count from library data
              librariesWithStats.push({
                id: lib.id,
                name: lib.name,
                mediaType: lib.mediaType || 'audiobook',
                itemCount: lib.itemCount || 0
              });
            }
          } catch (statsError) {
            console.error(`Error fetching stats for library ${lib.id}:`, statsError);
            // Add the library with default/fallback values
            librariesWithStats.push({
              id: lib.id,
              name: lib.name,
              mediaType: lib.mediaType || 'audiobook',
              itemCount: lib.itemCount || 0
            });
          }
        }
        
        setLibraries(librariesWithStats);
      } else {
        console.error('Unexpected API response format:', data);
        setLibraries([]);
        throw new Error('Invalid library data format received from server');
      }
      
    } catch (error) {
      console.error('Error fetching libraries:', error);
      setTestResult({
        success: false,
        message: `Library detection failed: ${error.message}`
      });
      setLibraries([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Test connection to Audiobookshelf server
   */
  const testConnection = async () => {
    if (!baseUrl || !apiToken) {
      setTestResult({
        success: false,
        message: 'Base URL and API Token are required'
      });
      return;
    }
    
    try {
      setLoading(true);
      setTestResult(null);
      
      // Clean up base URL by ensuring it starts with http:// or https:// and removing trailing slashes
      let cleanUrl = baseUrl.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'http://' + cleanUrl;
      }
      cleanUrl = cleanUrl.replace(/\/+$/, '');
      
      // Use the proxy endpoint to avoid CORS issues - Modified to use /api/libraries endpoint instead of /api/server
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          url: `${cleanUrl}/api/libraries?token=${encodeURIComponent(apiToken)}`
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check for the libraries array in the response
      if (data.libraries) {
        setTestResult({
          success: true,
          message: `Connected successfully. Found ${data.libraries.length} libraries.`
        });
        
        // After successful connection, fetch libraries
        await fetchLibraries(cleanUrl, apiToken);
      } else {
        throw new Error('Invalid server response');
      }
      
    } catch (error) {
      console.error('Connection test failed:', error);
      setTestResult({
        success: false,
        message: error.message || 'Connection failed'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Save connection configuration
   */
  const saveConnection = async () => {
    if (!baseUrl || !apiToken) {
      setTestResult({
        success: false,
        message: 'Base URL and API Token are required'
      });
      return;
    }
    
    // Allow saving even with no libraries selected
    // No longer blocking saving if selectedLibraries is empty
    
    try {
      setSaving(true);
      
      // Clean up base URL by ensuring it starts with http:// or https:// and removing trailing slashes
      let cleanUrl = baseUrl.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'http://' + cleanUrl;
      }
      cleanUrl = cleanUrl.replace(/\/+$/, '');
      
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          baseUrl: cleanUrl,
          apiToken: apiToken,
          homepageIp: homepageIp,
          libraryIds: selectedLibraries.join(','), // Join multiple libraries with comma
          libraryId: selectedLibraries[0] || '' // For backward compatibility
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }
      
      setTestResult({
        success: true,
        message: 'Configuration saved successfully'
      });
      
    } catch (error) {
      console.error('Error saving configuration:', error);
      setTestResult({
        success: false,
        message: error.message || 'Failed to save configuration'
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Toggle library selection with improved handling
   */
  const toggleLibrary = (libraryId) => {
    console.log('Toggle library called for:', libraryId);
    console.log('Current selection before toggle:', selectedLibraries);
    
    setSelectedLibraries(prev => {
      // Check if the library is already selected
      if (prev.includes(libraryId)) {
        // Remove from selection
        const newSelection = prev.filter(id => id !== libraryId);
        console.log('Library removed from selection. New selection:', newSelection);
        return newSelection;
      } else {
        // Add to selection
        const newSelection = [...prev, libraryId];
        console.log('Library added to selection. New selection:', newSelection);
        return newSelection;
      }
    });
  };
  
  // Debug log for selection state changes
  useEffect(() => {
    console.log('Selected libraries updated:', selectedLibraries);
  }, [selectedLibraries]);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <p className="text-gray-300 mb-6">
        Configure your Audiobookshelf connection and select which libraries to include in your dashboard.
      </p>
      
      <h2 className="text-xl font-bold text-white mb-4">Audiobookshelf Connection</h2>
      
      <div className="dark-panel p-6 mb-8">
        {/* Base URL Input */}
        <div className="mb-4">
          <label className="block text-white mb-2" htmlFor="baseUrl">
            Audiobookshelf Base URL
          </label>
          <input
            id="baseUrl"
            type="text"
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
            placeholder="http://192.168.0.10:13378"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>
        
        {/* API Token Input */}
        <div className="mb-4">
          <label className="block text-white mb-2" htmlFor="apiToken">
            Audiobookshelf API Key
          </label>
          <div className="relative">
            <input
              id="apiToken"
              type={showApiToken ? "text" : "password"}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white pr-10"
              placeholder="Your API token"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 px-3 flex items-center"
              onClick={() => setShowApiToken(!showApiToken)}
              aria-label={showApiToken ? "Hide API token" : "Show API token"}
            >
              {showApiToken ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
        </div>
        
        {/* Homepage IP Input */}
        <div className="mb-6">
          <label className="block text-white mb-2" htmlFor="homepageIp">
            Homepage Integration IP
          </label>
          <input
            id="homepageIp"
            type="text"
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"
            placeholder="192.168.0.10"
            value={homepageIp}
            onChange={(e) => setHomepageIp(e.target.value)}
          />
          <p className="text-gray-400 text-xs mt-1">
            This IP address will be used exclusively in Homepage YAML configurations. Enter the IP address that Homepage can use to reach this application.
          </p>
        </div>
        
        {/* Connection Test & Save Buttons */}
        <div className="flex gap-4">
          <button
            type="button"
            className="btn-secondary"
            onClick={testConnection}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2 inline" />
            ) : null}
            Test Connection
          </button>
          
          <button
            type="button"
            className="btn-primary"
            onClick={saveConnection}
            disabled={saving || loading}
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2 inline" />
            ) : null}
            Save Connection
          </button>
        </div>
        
        {/* Test Result Message */}
        {testResult && (
          <div className={`mt-4 p-3 rounded ${testResult.success ? 'bg-green-800/30 border border-green-700' : 'bg-red-800/30 border border-red-700'}`}>
            <p className={`text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.message}
            </p>
          </div>
        )}
      </div>
      
      {/* Libraries Section */}
      <h2 className="text-xl font-bold text-white mb-4">Library Sections</h2>
      
      <div className="dark-panel p-6">
        <div className="flex justify-between items-center mb-4">
          <p className="text-gray-300">
            Select which libraries to display in your dashboard:
          </p>
          <button
            type="button"
            className="btn-secondary !py-1 !px-2"
            onClick={() => fetchLibraries()}
            disabled={loading}
            title="Refresh libraries"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {libraries.length === 0 ? (
          <div className="text-center p-8 text-gray-400">
            {loading ? (
              <div className="flex flex-col items-center">
                <div className="loading-spinner mb-2" />
                <p>Loading libraries...</p>
              </div>
            ) : (
              <p>No libraries found. Please check your connection settings and try again.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {libraries.map((library) => (
              <div 
                key={library.id}
                className={`p-4 rounded cursor-pointer flex gap-3 items-center border-2 ${
                  selectedLibraries.includes(library.id) 
                    ? 'bg-blue-900/40 border-blue-500' 
                    : 'bg-gray-800/40 border-gray-700 hover:bg-gray-800'
                }`}
                onClick={() => toggleLibrary(library.id)}
              >
                <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    id={`library-${library.id}`}
                    checked={selectedLibraries.includes(library.id)}
                    onChange={() => toggleLibrary(library.id)}
                    className="h-5 w-5 cursor-pointer"
                  />
                </div>
                <label 
                  htmlFor={`library-${library.id}`} 
                  className="flex-grow cursor-pointer"
                >
                  <div className="text-white font-medium">{library.name}</div>
                  <div className="text-xs text-gray-400">
                    {library.itemCount} items • {library.mediaType || 'audiobooks'}
                  </div>
                </label>
              </div>
            ))}
          </div>
        )}
        
        {libraries.length > 0 && (
          <div className="mt-6">
            <button
              className="btn-primary px-6"
              onClick={saveConnection}
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2 inline" />
              ) : null}
              Save Sections
            </button>
            <p className="text-gray-400 text-sm mt-4">
              {selectedLibraries.length} of {libraries.length} libraries selected
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SetupView;