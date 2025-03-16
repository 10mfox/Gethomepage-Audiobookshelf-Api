import React, { useState, useEffect } from 'react';
import { Copy, ExternalLink, ChevronRight, Box, BarChart, Database, BookOpen, Server, RefreshCw, FileAudio, Activity, Layout } from 'lucide-react';

const ApiEndpointsView = () => {
  const [expandedSection, setExpandedSection] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [configuredLibraries, setConfiguredLibraries] = useState([]);

  // Fetch the base URL and libraries on component mount
  useEffect(() => {
    async function fetchData() {
      try {
        // Get current hostname and port for base URL
        const hostname = window.location.hostname;
        const port = window.location.port;
        const protocol = window.location.protocol;
        const currentBaseUrl = `${protocol}//${hostname}${port ? ':' + port : ''}`;
        setBaseUrl(currentBaseUrl);
        
        // Fetch libraries data
        try {
          const librariesResponse = await fetch('/api/audiobooks/libraries');
          if (librariesResponse.ok) {
            const librariesData = await librariesResponse.json();
            if (librariesData.response && librariesData.response.data) {
              setConfiguredLibraries(librariesData.response.data);
            }
          }
        } catch (libraryError) {
          console.error('Error fetching libraries:', libraryError);
          setConfiguredLibraries([]);
        }
      } catch (error) {
        console.error('Error initializing component:', error);
      }
    }
    fetchData();
  }, []);

  // Toggle expanded section
  const toggleSection = (section) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  // Copy URL to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('URL copied to clipboard');
      })
      .catch((error) => {
        console.error('Error copying text: ', error);
      });
  };

  // Test an endpoint
  const testEndpoint = (url) => {
    window.open(url, '_blank');
  };
  
  // Generate library-specific raw endpoints
  const getLibraryRawEndpoints = () => {
    if (!configuredLibraries || configuredLibraries.length === 0) {
      return [];
    }
    
    return configuredLibraries.map(library => ({
      method: 'GET',
      path: `/api/audiobooks/raw?libraryId=${library.id}`,
      description: `Get completely unmodified audiobook data from "${library.name}" library`,
      parameters: [
        '?limit=30 (limit results)',
        '?sort=addedAt (sort by field)',
        '?order=desc (sort direction)'
      ]
    }));
  };
  
  // Generate library-specific format endpoints
  const getLibraryFormatEndpoints = () => {
    if (!configuredLibraries || configuredLibraries.length === 0) {
      return [];
    }
    
    return configuredLibraries.map(library => ({
      method: 'GET',
      path: `/api/formats?libraryId=${library.id}`,
      description: `Get format settings for "${library.name}" library`,
      parameters: []
    }));
  };

  // Generate library-specific statistics endpoints
  const getLibraryStatisticsEndpoints = () => {
    if (!configuredLibraries || configuredLibraries.length === 0) {
      return [];
    }
    
    return configuredLibraries.map(library => ({
      method: 'GET',
      path: `/api/audiobooks/stats?libraryId=${library.id}`,
      description: `Get statistics for "${library.name}" library`,
      parameters: []
    }));
  };
  
  // Generate library-specific raw stats endpoints
  const getLibraryRawStatsEndpoints = () => {
    if (!configuredLibraries || configuredLibraries.length === 0) {
      return [];
    }
    
    return configuredLibraries.map(library => ({
      method: 'GET',
      path: `/api/audiobooks/stats/raw?libraryId=${library.id}`,
      description: `Get completely unmodified statistics data from "${library.name}" library`,
      parameters: []
    }));
  };
  
  // Endpoint sections
  const endpointSections = [
    {
      id: 'raw',
      title: 'Raw Endpoints',
      icon: <Database className="h-5 w-5" />,
      endpoints: [
        {
          method: 'GET',
          path: '/api/audiobooks/raw/combined',
          description: 'Get completely unmodified audiobook data from all libraries combined',
          parameters: [
            '?limit=30 (limit results per library)',
            '?globalLimit=30 (limit total results)',
            '?sort=addedAt (sort by field)',
            '?order=desc (sort direction)',
          ]
        },
        {
          method: 'GET',
          path: '/api/audiobooks/libraries/raw',
          description: 'Get completely unmodified library data directly from Audiobookshelf API',
          parameters: []
        },
        ...getLibraryRawEndpoints(),
        ...getLibraryRawStatsEndpoints()
      ]
    },
    {
      id: 'processed',
      title: 'Processed Endpoints',
      icon: <BookOpen className="h-5 w-5" />,
      endpoints: [
        {
          method: 'GET',
          path: '/api/audiobooks/recent',
          description: 'Get processed audiobook data with additional fields and formatting',
          parameters: [
            '?limit=30 (limit results per library)',
            '?libraryId=YOUR_LIBRARY_ID (filter by specific library)',
            '?combined=true (combine all libraries and sort by date)',
            '?globalLimit=30 (limit total results when using combined view)',
            '?sort=addedAt (sort by field)',
            '?order=desc (sort direction)',
          ]
        },
        {
          method: 'GET',
          path: '/api/audiobooks/libraries',
          description: 'Get processed library data with additional information',
          parameters: []
        },
        {
          method: 'GET',
          path: '/api/audiobooks/stats',
          description: 'Get processed statistics with calculations and formatting',
          parameters: [
            '?libraryId=YOUR_LIBRARY_ID (specify library, defaults to first configured library)',
            '?all=true (get stats for all libraries even if libraryId is specified)'
          ]
        }
      ]
    },
    {
      id: 'formatted',
      title: 'Formatted Endpoints',
      icon: <Layout className="h-5 w-5" />,
      endpoints: [
        {
          method: 'GET',
          path: '/api/formats/combined',
          description: 'Get formatted media items from all libraries combined and sorted by add date',
          parameters: [
            '?limit=30 (limit total results)'
          ]
        },
        ...getLibraryFormatEndpoints()
      ]
    },
    {
      id: 'health',
      title: 'Health & Status Endpoints',
      icon: <BarChart className="h-5 w-5" />,
      endpoints: [
        {
          method: 'GET',
          path: '/api/health',
          description: 'Check application health status',
          parameters: []
        }
      ]
    },
    {
      id: 'debug',
      title: 'Debug Endpoints',
      icon: <Box className="h-5 w-5" />,
      endpoints: [
        {
          method: 'GET',
          path: '/api/debug/cache',
          description: 'Get cache statistics and status',
          parameters: []
        },
        {
          method: 'POST',
          path: '/api/debug/cache/clear',
          description: 'Clear application cache',
          parameters: []
        },
        {
          method: 'GET',
          path: '/api/debug/logs',
          description: 'Get application logs',
          parameters: [
            '?level=info (filter by log level)',
            '?limit=100 (limit results)',
            '?page=1 (pagination)'
          ]
        }
      ]
    }
  ];

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">API Endpoints</h1>
      
      <div className="dark-panel p-6 mb-8">
        <p className="text-gray-300 mb-4">
          These API endpoints are designed for integration with external services. Each endpoint returns JSON data and supports various query parameters for filtering and customization.
        </p>
        
        <div className="flex flex-col gap-3">
          <div className="flex items-center p-3 bg-gray-800/50 rounded-md border border-gray-700 text-sm text-gray-300">
            <span className="mr-2">Base URL:</span>
            <code className="bg-gray-800 p-1 rounded">{baseUrl}</code>
          </div>
          
          <div className="p-3 bg-gray-800/30 rounded-md border border-gray-700 text-sm">
            <p className="text-blue-300 font-medium mb-1">API Endpoint Categories</p>
            <p className="text-gray-300">
              <span className="text-blue-400 font-medium">Raw Endpoints</span> return completely unmodified data directly from Audiobookshelf API.
            </p>
            <p className="text-gray-300">
              <span className="text-blue-400 font-medium">Processed Endpoints</span> return data with additional fields and basic formatting.
            </p>
            <p className="text-gray-300">
              <span className="text-blue-400 font-medium">Formatted Endpoints</span> return data that has been processed through customizable templates.
            </p>
          </div>
        </div>
      </div>
      
      {/* Endpoint Sections */}
      {endpointSections.map((section) => (
        <div key={section.id} className="mb-8">
          <div 
            className="dark-panel p-4 flex items-center justify-between cursor-pointer"
            onClick={() => toggleSection(section.id)}
          >
            <div className="flex items-center gap-3">
              {section.icon}
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              {(section.id === 'raw' || section.id === 'processed' || section.id === 'formatted') && configuredLibraries.length > 0 && (
                <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded-full">
                  {configuredLibraries.length} libraries
                </span>
              )}
              {section.id === 'raw' && (
                <span className="text-xs bg-green-900/50 text-green-300 px-2 py-1 rounded-full ml-2">
                  Unmodified Data
                </span>
              )}
            </div>
            <ChevronRight className={`h-5 w-5 transition-transform duration-200 ${expandedSection === section.id ? 'rotate-90' : ''}`} />
          </div>
          
          {expandedSection === section.id && (
            <div className="mt-2 space-y-2">
              {section.endpoints.map((endpoint, index) => (
                <div key={index} className="dark-panel border border-gray-700 overflow-hidden">
                  <div className="p-4 border-b border-gray-700 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded font-mono ${
                          endpoint.method === 'GET' ? 'bg-blue-900/50 text-blue-300' : 
                          endpoint.method === 'POST' ? 'bg-green-900/50 text-green-300' : 
                          'bg-yellow-900/50 text-yellow-300'
                        }`}>
                          {endpoint.method}
                        </span>
                        <code className="text-sm text-theme-accent font-mono">{endpoint.path}</code>
                        <button 
                          className="text-gray-400 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(`${baseUrl}${endpoint.path}`);
                          }}
                          title="Copy URL"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-gray-300 text-sm">{endpoint.description}</p>
                    </div>
                    
                    {endpoint.method === 'GET' && (
                      <button 
                        className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          testEndpoint(`${baseUrl}${endpoint.path}`);
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Test Endpoint
                      </button>
                    )}
                  </div>
                  
                  {endpoint.parameters.length > 0 && (
                    <div className="p-4 bg-gray-800/30">
                      <h4 className="text-sm text-gray-400 mb-2">Example Parameters:</h4>
                      <div className="space-y-1">
                        {endpoint.parameters.map((param, i) => (
                          <code key={i} className="block text-xs text-blue-300 font-mono">{param}</code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      
      {/* Debug Dashboard Section */}
      <div className="dark-panel p-6 mt-12">
        <h2 className="text-xl font-semibold text-white mb-4">Debug Dashboard</h2>
        
        <p className="text-gray-300 mb-6">
          The Debug Dashboard provides an interface for monitoring and managing the application's performance and state. It can be accessed directly by administrators to perform various debugging and maintenance tasks.
        </p>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium text-white mb-2">Dashboard Features</h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-gray-300">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
              Server status monitoring and metrics
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
              Cache statistics and management
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
              Memory usage and performance data
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
              Audiobookshelf connection status and configuration
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
              Library section overview
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
              Data refresh controls
            </li>
            <li className="flex items-center gap-2 text-gray-300">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-400"></div>
              Verbose logging toggle
            </li>
          </ul>
        </div>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium text-white mb-2">Dashboard Access</h3>
          <p className="text-gray-300 mb-2">The Debug Dashboard is available at:</p>
          <div className="flex items-center gap-2 bg-gray-800/50 p-3 rounded border border-gray-700">
            <code className="text-theme-accent font-mono">{baseUrl}/api/debug</code>
            <button 
              className="text-gray-400 hover:text-white"
              onClick={() => copyToClipboard(`${baseUrl}/api/debug`)}
              title="Copy URL"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <button 
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded flex items-center gap-2"
          onClick={() => window.open(`${baseUrl}/api/debug`, '_blank')}
        >
          <Server className="h-4 w-4" />
          Open Debug Dashboard
        </button>
      </div>
    </div>
  );
};

export default ApiEndpointsView;