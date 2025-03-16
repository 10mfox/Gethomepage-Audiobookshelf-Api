import React, { useState, useEffect } from 'react';
import { Library, RefreshCw, Book, BookOpen, Music, FileAudio, HelpCircle } from 'lucide-react';

/**
 * Libraries view component for displaying all configured libraries and their statistics
 */
const LibrariesView = () => {
  const [libraries, setLibraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState([]);

  // Group summaries
  const [summaries, setSummaries] = useState({});

  useEffect(() => {
    fetchLibraries();
    
    // Set up polling every minute
    const interval = setInterval(() => {
      fetchLibraries(true);
    }, 60000); // 1 minute
    
    return () => clearInterval(interval);
  }, []);

  const fetchLibraries = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    
    try {
      // First get config to ensure we have base URL and selected libraries
      const configResponse = await fetch('/api/config');
      const config = await configResponse.json();
      setBaseUrl(config.baseUrl || '');
      
      // Get the selected library IDs
      const libraryIdsArray = [];
      if (config.libraryIds) {
        libraryIdsArray.push(...config.libraryIds.split(',').filter(id => id.trim()));
      } else if (config.libraryId) {
        libraryIdsArray.push(config.libraryId);
      }
      setSelectedLibraryIds(libraryIdsArray);
      
      if (!config.baseUrl) {
        setError('Audiobookshelf connection not configured. Please visit the Setup page.');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Fetch all libraries
      const response = await fetch('/api/audiobooks/libraries');
      if (!response.ok) {
        throw new Error('Failed to fetch libraries');
      }
      
      const librariesData = await response.json();
      
      if (!librariesData.response || !librariesData.response.data) {
        throw new Error('Invalid library data format');
      }
      
      const libraryList = librariesData.response.data;
      const librariesWithStats = [];
      
      // Fetch stats for each library
      for (const library of libraryList) {
        try {
          const statsResponse = await fetch(`/api/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: `${config.baseUrl}/api/libraries/${library.id}/stats?token=${encodeURIComponent(config.apiToken || '')}`
            })
          });
          
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            
            // Combine library data with stats data
            librariesWithStats.push({
              ...library,
              stats: statsData
            });
          } else {
            // If stats fetch fails, add library without stats
            librariesWithStats.push(library);
          }
        } catch (err) {
          console.error(`Failed to fetch stats for library ${library.name}:`, err);
          librariesWithStats.push(library);
        }
      }
      
      setLibraries(librariesWithStats);
      generateSummaries(librariesWithStats);
      setError(null);
    } catch (err) {
      console.error('Error fetching libraries:', err);
      setError(err.message || 'Failed to load libraries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateSummaries = (libraryList) => {
    const newSummaries = {};
    
    // Group libraries by media type
    const groupedLibraries = {};
    
    libraryList.forEach(library => {
      const mediaType = library.mediaType || 'unknown';
      if (!groupedLibraries[mediaType]) {
        groupedLibraries[mediaType] = [];
      }
      groupedLibraries[mediaType].push(library);
    });
    
    // Generate summaries for each media type
    Object.keys(groupedLibraries).forEach(mediaType => {
      const libraries = groupedLibraries[mediaType];
      const summary = {
        count: libraries.length,
        totalItems: libraries.reduce((sum, lib) => sum + (lib.stats?.totalItems || 0), 0),
        totalAuthors: libraries.reduce((sum, lib) => sum + (lib.stats?.totalAuthors || 0), 0),
        totalSeries: libraries.reduce((sum, lib) => sum + (lib.stats?.totalSeries || 0), 0),
      };
      
      newSummaries[mediaType] = summary;
    });
    
    // Generate grand total
    newSummaries.total = {
      count: libraryList.length,
      totalItems: libraryList.reduce((sum, lib) => sum + (lib.stats?.totalItems || 0), 0),
      totalAuthors: libraryList.reduce((sum, lib) => sum + (lib.stats?.totalAuthors || 0), 0),
      totalSeries: libraryList.reduce((sum, lib) => sum + (lib.stats?.totalSeries || 0), 0),
    };
    
    setSummaries(newSummaries);
  };

  const getTypeIcon = (mediaType) => {
    switch (mediaType) {
      case 'audiobook':
        return <FileAudio className="h-5 w-5 text-blue-400" />;
      case 'book':
        return <Book className="h-5 w-5 text-green-400" />;
      case 'podcast':
        return <Music className="h-5 w-5 text-purple-400" />;
      case 'music':
        return <Music className="h-5 w-5 text-red-400" />;
      default:
        return <HelpCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const formatStatCount = (library) => {
    const stats = library.stats || {};
    
    switch (library.mediaType) {
      case 'audiobook':
        return `${stats.totalItems || 0} books, ${stats.totalAuthors || 0} authors`;
      case 'book':
        return `${stats.totalItems || 0} books, ${stats.totalAuthors || 0} authors`;
      case 'podcast':
        return `${stats.totalItems || 0} podcasts, ${stats.totalEpisodes || 0} episodes`;
      case 'music':
        return `${stats.totalArtists || 0} artists, ${stats.totalAlbums || 0} albums, ${stats.totalTracks || 0} tracks`;
      default:
        return `${stats.totalItems || 0} items`;
    }
  };

  const formatMediaType = (mediaType) => {
    switch (mediaType) {
      case 'audiobook':
        return 'Audiobook';
      case 'book':
        return 'Book';
      case 'podcast':
        return 'Podcast';
      case 'music':
        return 'Music';
      default:
        return mediaType.charAt(0).toUpperCase() + mediaType.slice(1);
    }
  };

  return (
    <div className="section-spacing">
      <div className="dark-panel mb-6">
        <div className="p-4 flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <Library className="h-5 w-5" />
            <h2 className="text-xl font-semibold text-white">Libraries</h2>
            <span className="bg-blue-900/50 text-xs text-blue-300 px-2 py-1 rounded-full ml-2">
              {libraries.length} libraries
            </span>
          </div>
          <div className="flex items-center">
            <div className="text-xs text-gray-400 mr-2">
              Updates every 1 minute
            </div>
            <button 
              onClick={() => fetchLibraries()}
              className="btn-secondary !py-1 !px-2"
              title="Refresh now"
              disabled={refreshing || loading}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing || loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="dark-panel p-8 text-center text-red-400">{error}</div>
      ) : loading && libraries.length === 0 ? (
        <div className="dark-panel p-8 flex justify-center items-center">
          <div className="loading-spinner mr-3" />
          <span>Loading library data...</span>
        </div>
      ) : (
        <>
          <div className="dark-panel mb-6 overflow-hidden">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-gray-700 text-left">
                  <th className="p-4 text-gray-400">Section</th>
                  <th className="p-4 text-gray-400">Count</th>
                  <th className="p-4 text-gray-400">Type</th>
                  <th className="p-4 text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {libraries.map((library) => (
                  <tr key={library.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(library.mediaType)}
                        <div>
                          <div className="font-medium text-white">{library.name}</div>
                          <div className="text-xs text-gray-400">Section {library.id.substring(0, 4)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-gray-300">
                      {formatStatCount(library)}
                    </td>
                    <td className="p-4 text-gray-300">
                      {formatMediaType(library.mediaType || 'unknown')}
                    </td>
                    <td className="p-4">
                      <span className={`${
                        selectedLibraryIds.includes(library.id) 
                          ? 'bg-green-900/50 text-green-400' 
                          : 'bg-yellow-900/50 text-yellow-400'
                        } text-xs px-3 py-1 rounded-full`}>
                        {selectedLibraryIds.includes(library.id) ? 'Configured' : 'Available'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Section */}
          {Object.keys(summaries).length > 0 && (
            <div className="space-y-2">
              {Object.entries(summaries).filter(([key]) => key !== 'total').map(([mediaType, summary]) => (
                <div key={mediaType} className="dark-panel p-4">
                  <div className="flex items-center gap-3">
                    {getTypeIcon(mediaType)}
                    <div className="font-medium text-white">
                      {formatMediaType(mediaType)} Total
                    </div>
                  </div>
                  <div className="mt-2 text-gray-300 pl-8">
                    {mediaType === 'audiobook' || mediaType === 'book' ? (
                      `${summary.count} ${summary.count === 1 ? 'section' : 'sections'}, ${summary.totalItems} books, ${summary.totalAuthors} authors, ${summary.totalSeries} series`
                    ) : mediaType === 'podcast' ? (
                      `${summary.count} ${summary.count === 1 ? 'section' : 'sections'}, ${summary.totalItems} podcasts`
                    ) : mediaType === 'music' ? (
                      `${summary.count} ${summary.count === 1 ? 'section' : 'sections'}, ${summary.totalItems} tracks`
                    ) : (
                      `${summary.count} ${summary.count === 1 ? 'section' : 'sections'}, ${summary.totalItems} items`
                    )}
                  </div>
                </div>
              ))}
              
              {/* Grand Total */}
              {libraries.length > 1 && (
                <div className="dark-panel p-4 border-t-2 border-blue-600">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-blue-400" />
                    <div className="font-medium text-white">All Libraries</div>
                  </div>
                  <div className="mt-2 text-gray-300 pl-8">
                    {`${summaries.total.count} ${summaries.total.count === 1 ? 'section' : 'sections'}, ${summaries.total.totalItems} items, ${summaries.total.totalAuthors} authors, ${summaries.total.totalSeries} series`}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LibrariesView;