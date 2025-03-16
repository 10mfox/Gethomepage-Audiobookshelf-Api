import React, { useState, useEffect, useRef } from 'react';
import { Book, RefreshCw, ViewGrid, List, LayoutGrid } from 'lucide-react';

/**
 * Media item component for displaying individual items
 */
const MediaItem = React.memo(({ item, baseUrl }) => {
  let coverUrl = '/static/cover-placeholder.jpg';
  
  if (item.id) {
    coverUrl = `${baseUrl}/api/items/${item.id}/cover`;
  }
  
  return (
    <div className="dark-panel flex flex-col overflow-hidden h-full">
      <div className="relative w-full aspect-[2/3] bg-black/40 overflow-hidden group">
        <img 
          src={coverUrl} 
          alt={item.title} 
          className="w-full h-full object-cover"
          onError={(e) => { e.target.src = '/static/cover-placeholder.jpg' }}
        />
        {item.addedAtRelative && (
          <div className="absolute top-2 right-2 bg-black/70 text-xs text-theme-accent px-2 py-1 rounded-full">
            {item.addedAtRelative}
          </div>
        )}
        {item.libraryName && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-xs text-white px-2 py-1 rounded-full">
            {item.libraryName}
          </div>
        )}
      </div>
      
      <div className="p-3 flex flex-col flex-grow">
        <div className="text-white font-medium text-sm line-clamp-2 mb-1">
          {item.formattedPrimary || item.title}
        </div>
        {item.formattedAdditional && (
          <div className="text-xs text-gray-400 mb-1">
            {item.formattedAdditional}
          </div>
        )}
        {!item.formattedPrimary && (
          <>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{item.authorName}</span>
            </div>
            {item.seriesName && (
              <div className="flex items-center gap-2 text-xs text-theme-accent mt-1">
                <span>{item.seriesName}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
              {item.duration ? (
                // If duration is available, show it
                <>
                  <span>{item.duration}</span>
                  {item.numChapters > 0 && <span>• {item.numChapters} chapters</span>}
                </>
              ) : (
                // If duration is not available, show chapter count instead
                item.numChapters > 0 ? <span>{item.numChapters} chapters</span> : <span>No duration data</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

/**
 * Library Section component for displaying a complete library section
 */
const LibrarySection = ({ title, items, baseUrl, itemCount }) => {
  return (
    <div className="mb-12">
      <div className="dark-panel mb-4 p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-white">{title}</h2>
          <span className="bg-blue-900/50 text-xs text-blue-300 px-2 py-1 rounded-full">
            {itemCount} items
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item) => (
          <MediaItem key={item.id} item={item} baseUrl={baseUrl} />
        ))}
      </div>
    </div>
  );
};

/**
 * Combined Media Section component for displaying all items sorted by date
 */
const CombinedMediaSection = ({ items, baseUrl }) => {
  return (
    <div className="mb-12">
      <div className="dark-panel mb-4 p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold text-white">All Recent Media</h2>
          <span className="bg-blue-900/50 text-xs text-blue-300 px-2 py-1 rounded-full">
            {items.length} items
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item) => (
          <MediaItem key={item.id} item={item} baseUrl={baseUrl} />
        ))}
      </div>
    </div>
  );
};

/**
 * Main Recent View component
 */
const RecentView = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [libraryData, setLibraryData] = useState([]);
  const [combinedData, setCombinedData] = useState([]);
  const [viewMode, setViewMode] = useState('byLibrary'); // 'byLibrary' or 'combined'
  const [libraryInfo, setLibraryInfo] = useState({});
  
  const isMountedRef = useRef(true);
  const timerRef = useRef(null);
  
  // Initialize component on mount
  useEffect(() => {
    isMountedRef.current = true;
    
    // Load preferred view mode from localStorage if available
    const savedViewMode = localStorage.getItem('recentViewMode');
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
    
    // Initial data loading
    fetchConfig().then(() => {
      fetchRecentItems(savedViewMode === 'combined');
    });
    
    // Set up periodic refresh
    timerRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchRecentItems(viewMode === 'combined');
      }
    }, 60000);
    
    // Handle tab visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchRecentItems(viewMode === 'combined');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  // When view mode changes, fetch data in the new mode
  useEffect(() => {
    fetchRecentItems(viewMode === 'combined');
    // Save preference to localStorage
    localStorage.setItem('recentViewMode', viewMode);
  }, [viewMode]);
  
  /**
   * Fetch configuration from the API
   */
  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      
      if (isMountedRef.current) {
        setBaseUrl(data.baseUrl || '');
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching configuration:', error);
      return {};
    }
  };
  
  /**
   * Fetch library information for a specific library
   */
  const fetchLibraryInfo = async (libraryId) => {
    if (!baseUrl || !libraryId) return null;
    
    try {
      const response = await fetch(`/api/audiobooks/library/${libraryId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.response?.data) {
          return {
            id: libraryId,
            name: data.response.data.name || `Library ${libraryId}`,
            mediaType: data.response.data.mediaType || 'audiobook'
          };
        }
      }
      
      // If API call fails, try proxy as fallback
      const proxyResponse = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${baseUrl}/api/libraries/${libraryId}?token=${encodeURIComponent(localStorage.getItem('apiToken') || '')}`
        })
      });
      
      if (proxyResponse.ok) {
        const proxyData = await proxyResponse.json();
        return {
          id: libraryId,
          name: proxyData.name || `Library ${libraryId}`,
          mediaType: proxyData.mediaType || 'audiobook'
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching library info for ${libraryId}:`, error);
      return null;
    }
  };
  
  /**
   * Fetch recent items from all libraries
   */
  const fetchRecentItems = async (combinedView = false) => {
    if (!baseUrl) {
      const config = await fetchConfig();
      if (!config.baseUrl) {
        setError('No server URL configured. Please set up your connection in the Setup page.');
        setLoading(false);
        return;
      }
      setBaseUrl(config.baseUrl);
    }
    
    try {
      setRefreshing(true);
      
      if (combinedView) {
        // Use the new combined formats endpoint for combined view
        const response = await fetch('/api/formats/combined?limit=50');
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.items && Array.isArray(data.items)) {
          if (isMountedRef.current) {
            setCombinedData(data.items);
            setError(null);
          }
        } else {
          throw new Error('Invalid response format from server');
        }
      } else {
        // Use the original endpoint for per-library view
        const response = await fetch('/api/audiobooks/recent');
        
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.response?.libraries) {
          const libraries = data.response.libraries;
          
          // Fetch library info for any libraries we don't have info for yet
          const updatedLibraryInfo = { ...libraryInfo };
          const infoPromises = [];
          
          for (const library of libraries) {
            if (!updatedLibraryInfo[library.id]) {
              infoPromises.push(
                fetchLibraryInfo(library.id).then(info => {
                  if (info) {
                    updatedLibraryInfo[library.id] = info;
                  }
                })
              );
            }
          }
          
          // Wait for all library info requests to complete
          if (infoPromises.length > 0) {
            await Promise.all(infoPromises);
          }
          
          if (isMountedRef.current) {
            setLibraryData(libraries);
            setLibraryInfo(updatedLibraryInfo);
            setError(null);
          }
        } else {
          throw new Error('Invalid response format from server');
        }
      }
    } catch (error) {
      console.error('Error fetching media items:', error);
      if (isMountedRef.current) {
        setError(error.message || 'Failed to load media items');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };
  
  /**
   * Handle manual refresh button click
   */
  const handleManualRefresh = () => {
    fetchRecentItems(viewMode === 'combined');
  };
  
  /**
   * Switch between view modes
   */
  const toggleViewMode = () => {
    setViewMode(prevMode => prevMode === 'byLibrary' ? 'combined' : 'byLibrary');
  };
  
  return (
    <div className="section-spacing">
      <div className="dark-panel mb-6">
        <div className="p-4 flex justify-between items-center">
          <div className="flex gap-2">
            <h2 className="text-xl font-semibold text-white">Recent Media</h2>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleViewMode}
              className="btn-secondary !py-1 !px-2 flex items-center gap-1"
              title={viewMode === 'byLibrary' ? 'Switch to combined view' : 'Switch to library view'}
            >
              {viewMode === 'byLibrary' ? (
                <>
                  <List className="h-4 w-4" />
                  <span className="hidden md:inline">Combined View</span>
                </>
              ) : (
                <>
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden md:inline">Library View</span>
                </>
              )}
            </button>
            <div className="flex items-center">
              <div className="text-xs text-gray-400 mr-2">
                Updates every 60 seconds
              </div>
              <button 
                onClick={handleManualRefresh}
                className="btn-secondary !py-1 !px-2"
                title="Refresh now"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && libraryData.length === 0 && combinedData.length === 0 ? (
        <div className="dark-panel p-8 flex justify-center items-center">
          <div className="loading-spinner" />
        </div>
      ) : error ? (
        <div className="dark-panel p-8 text-center text-red-400">{error}</div>
      ) : viewMode === 'combined' ? (
        // Combined view - all items sorted by date
        combinedData.length === 0 ? (
          <div className="dark-panel p-8 text-center text-gray-400">
            No media items found
          </div>
        ) : (
          <CombinedMediaSection 
            items={combinedData} 
            baseUrl={baseUrl} 
          />
        )
      ) : (
        // Library view - separated by section
        libraryData.length === 0 ? (
          <div className="dark-panel p-8 text-center text-gray-400">
            No media items found
          </div>
        ) : (
          libraryData.map(library => {
            // Skip libraries with no items
            if (!library.data || library.data.length === 0) {
              return null;
            }
            
            // Use library name from info if available, otherwise use ID
            const libraryName = libraryInfo[library.id]?.name || library.name || `Library ${library.id}`;
            
            return (
              <LibrarySection
                key={library.id}
                title={libraryName}
                items={library.data}
                baseUrl={baseUrl}
                itemCount={library.count || library.data.length}
              />
            );
          })
        )
      )}
    </div>
  );
};

export default RecentView;