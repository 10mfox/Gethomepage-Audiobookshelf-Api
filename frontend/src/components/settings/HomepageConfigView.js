import React, { useState, useEffect } from 'react';
import { Save, Home, Code, Copy, ExternalLink, Book, Check } from 'lucide-react';

/**
 * Homepage Config View component for generating Homepage integration YAML
 */
const HomepageConfigView = () => {
  const [loading, setLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [homepageIp, setHomepageIp] = useState('');
  const [booksLength, setBooksLength] = useState(1);
  const [libraries, setLibraries] = useState([]);
  
  // Display settings
  const [displayMode, setDisplayMode] = useState('split');
  const [countMode, setCountMode] = useState('individual');
  const [formatMode, setFormatMode] = useState('formatted');
  
  // YAML configurations for each section
  const [recentBooksYaml, setRecentBooksYaml] = useState('');
  const [bookCountsYaml, setBookCountsYaml] = useState('');
  const [copiedSection, setCopiedSection] = useState(null);

  // Fetch configuration details on component mount
  useEffect(() => {
    fetchConfig();
    fetchLibraries();
  }, []);

  // Update YAML whenever settings change
  useEffect(() => {
    generateYamlConfigs();
  }, [baseUrl, homepageIp, booksLength, displayMode, countMode, formatMode, libraries]);

  /**
   * Fetch current configuration from API
   */
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config');
      const config = await response.json();
      
      setBaseUrl(config.baseUrl || '');
      setHomepageIp(config.homepageIp || '');
    } catch (error) {
      console.error('Error fetching configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch libraries configured in the system
   */
  const fetchLibraries = async () => {
    try {
      // Fetch all available libraries first
      const response = await fetch('/api/audiobooks/libraries');
      let allLibraries = [];
      
      if (response.ok) {
        const data = await response.json();
        if (data.response && data.response.data) {
          allLibraries = data.response.data;
        }
      }
      
      // Now fetch configuration to determine which libraries are actually selected
      const configResponse = await fetch('/api/config');
      const config = await configResponse.json();
      
      // Get the selected library IDs
      const selectedLibraryIds = [];
      if (config.libraryIds) {
        selectedLibraryIds.push(...config.libraryIds.split(',').filter(id => id.trim()));
      } else if (config.libraryId) {
        selectedLibraryIds.push(config.libraryId);
      }
      
      // Filter libraries to only include those that are selected in the config
      const configuredLibraries = allLibraries.filter(lib => 
        selectedLibraryIds.includes(lib.id)
      );
      
      // Update state with only the configured libraries
      setLibraries(configuredLibraries);
      
    } catch (error) {
      console.error('Error fetching libraries:', error);
    }
  };

  /**
   * Copy specific YAML configuration to clipboard
   */
  const copyToClipboard = (yaml, section) => {
    navigator.clipboard.writeText(yaml)
      .then(() => {
        setCopiedSection(section);
        setTimeout(() => setCopiedSection(null), 2000);
      })
      .catch(err => {
        console.error('Failed to copy:', err);
      });
  };

  /**
   * Generate mappings based on the specified length
   * 
   * @param {number} length - Number of mappings to generate
   * @returns {string} - Generated mappings string
   */
  const generateItemMappings = (length) => {
    let mappings = '';
    
    for (let i = 0; i < length; i++) {
      mappings += `              - field:
                  items:
                    ${i}: formattedPrimary
                additionalField:
                  field:
                    items:
                      ${i}: formattedAdditional\n`;
    }
    
    return mappings;
  };

  /**
   * Generate YAML configurations for Recently Added Books and Book Counts sections
   */
  const generateYamlConfigs = () => {
    const formatSetting = formatMode === 'formatted' ? 'numbers' : 'raw';
    
    // Generate mappings based on the bookLength setting
    const itemMappings = generateItemMappings(booksLength);
    
    // Generate Recently Added Books section
    let recentBooks = '';
    
    if (displayMode === 'combined' || displayMode === 'combinedCount') {
      // Combined view - all libraries combined into one section
      recentBooks += `- Recently Added Books:
    - Books:
        icon: mdi-book
        id: list
        widgets:
          - type: customapi
            url: http://${homepageIp || 'your-ip-address'}:3020/api/formats/combined?limit=${booksLength}
            method: GET
            display: list
            mappings:
${itemMappings}`;
      
      // Add count statistics if combined with count is selected
      if (displayMode === 'combinedCount') {
        recentBooks += `          - type: customapi 
            url: http://${homepageIp || 'your-ip-address'}:3020/api/audiobooks/stats
            method: GET
            display: block
            mappings:
            - field:
                response:
                  totals: totalItems
              format: ${formatSetting}
              label: Books
            - field:
                response:
                  totals: totalAuthors
              format: ${formatSetting}
              label: Authors\n`;
      }
    } else { 
      // Split view - individual sections for each library
      if (libraries.length > 0) {
        // Recent Added Books section with all libraries as subsections
        recentBooks += `- Recently Added Books:\n`;
        
        // Add each library under the recently added books section
        libraries.forEach((library) => {
          const libraryId = library.id;
          const libraryName = library.name || `Library ${libraryId.substring(0, 5)}`;
          const sanitizedName = libraryName.replace(/[^a-zA-Z0-9 ]/g, '');
          
          recentBooks += `    - ${sanitizedName}:
        icon: mdi-book
        id: list
        widgets:
          - type: customapi
            url: http://${homepageIp || 'your-ip-address'}:3020/api/formats?libraryId=${libraryId}
            method: GET
            display: list
            mappings:
${itemMappings}`;
          
          // Add count statistics if split with count is selected
          if (displayMode === 'splitCount') {
            recentBooks += `          - type: customapi
            url: http://${homepageIp || 'your-ip-address'}:3020/api/audiobooks/stats?libraryId=${libraryId}
            method: GET
            display: block
            mappings:
            - field:
                response:
                  totals: totalItems
              format: ${formatSetting}
              label: Books
            - field:
                response:
                  totals: totalAuthors
              format: ${formatSetting}
              label: Authors\n`;
          }
        });
      } else {
        // No libraries configured, provide an example
        recentBooks += `- Recently Added Books:
    - Books:
        icon: mdi-book
        id: list
        widgets:
          - type: customapi
            url: http://${homepageIp || 'your-ip-address'}:3020/api/formats?libraryId=YOUR_LIBRARY_ID
            method: GET
            display: list
            mappings:
${itemMappings}`;
      }
    }
    
    // Generate Book Counts section
    let bookCounts = '';
    
    // Skip generating Book Counts if counts are already shown with Recently Added Books
    if ((displayMode !== 'splitCount' && displayMode !== 'combinedCount')) {
      if (countMode === 'individual' && libraries.length > 0) {
        // Individual counts for each library
        bookCounts += `- Book Counts:\n`;
        
        // Add each library under the book counts section
        libraries.forEach((library) => {
          const libraryId = library.id;
          const libraryName = library.name || `Library ${libraryId.substring(0, 5)}`;
          const sanitizedName = libraryName.replace(/[^a-zA-Z0-9 ]/g, '');
          
          bookCounts += `    - ${sanitizedName} Counts:
         widgets:
           - type: customapi 
             url: http://${homepageIp || 'your-ip-address'}:3020/api/audiobooks/stats?libraryId=${libraryId}
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   totals: totalItems
               format: ${formatSetting}
               label: Books
             - field:
                 response:
                   totals: totalAuthors
               format: ${formatSetting}
               label: Authors\n`;
        });
      } else if (countMode === 'totalsOnly') {
        // Combined counts for all libraries
        bookCounts += `- Book Counts:             
    - Book Counts:
         widgets:
           - type: customapi 
             url: http://${homepageIp || 'your-ip-address'}:3020/api/audiobooks/stats
             method: GET
             display: block
             mappings:
             - field:
                 response:
                   totals: totalItems
               format: ${formatSetting}
               label: Books
             - field:
                 response:
                   totals: totalAuthors
               format: ${formatSetting}
               label: Authors\n`;
      }
    }
    
    // Set the YAML strings with appropriate headers
    setRecentBooksYaml(recentBooks);
    
    if (bookCounts) {
      setBookCountsYaml(bookCounts);
    } else {
      setBookCountsYaml('# Book Counts section is not applicable with the current settings.\n# When using Split with Count or Combined with Count, counts are already included in the Recently Added Books section.');
    }
  };

  return (
    <div className="section-spacing">
      <div className="dark-panel mb-6">
        <div className="p-4">
          <h1 className="text-xl font-bold text-white">Homepage Integration</h1>
          <p className="text-gray-400 mt-2">
            Configure display formats for Homepage Dashboard integration and generate YAML configuration.
          </p>
        </div>
      </div>

      {/* Display Settings Section */}
      <h2 className="text-xl text-white font-bold mb-4">Display Settings</h2>
      <div className="dark-panel p-6 mb-6">
        <div className="mb-6">
          <label className="block text-white mb-3">Recently Added Display</label>
          <div className="flex flex-wrap gap-2">
            <button 
              className={`px-4 py-2 rounded ${displayMode === 'split' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
              onClick={() => setDisplayMode('split')}
            >
              Split
            </button>
            <button 
              className={`px-4 py-2 rounded ${displayMode === 'splitCount' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
              onClick={() => setDisplayMode('splitCount')}
            >
              Split with Count
            </button>
            <button 
              className={`px-4 py-2 rounded ${displayMode === 'combined' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
              onClick={() => setDisplayMode('combined')}
            >
              Combined
            </button>
            <button 
              className={`px-4 py-2 rounded ${displayMode === 'combinedCount' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
              onClick={() => setDisplayMode('combinedCount')}
            >
              Combined with Count
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-white mb-3">Library Count Display</label>
          <div className="flex flex-wrap gap-2">
            <button 
              className={`px-4 py-2 rounded ${countMode === 'individual' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
              onClick={() => setCountMode('individual')}
            >
              Individual
            </button>
            <button 
              className={`px-4 py-2 rounded ${countMode === 'totalsOnly' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
              onClick={() => setCountMode('totalsOnly')}
            >
              Totals Only
            </button>
          </div>
        </div>

        <div className="mb-2">
          <label className="block text-white mb-3">Number Format</label>
          <div className="flex flex-wrap gap-2">
            <button 
              className={`px-4 py-2 rounded ${formatMode === 'formatted' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
              onClick={() => setFormatMode('formatted')}
            >
              Formatted
            </button>
            <button 
              className={`px-4 py-2 rounded ${formatMode === 'raw' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}
              onClick={() => setFormatMode('raw')}
            >
              Raw
            </button>
          </div>
        </div>
      </div>

      {/* Mapping Length Settings */}
      <h2 className="text-xl text-white font-bold mb-4">Mapping Length Settings</h2>
      <div className="dark-panel p-6 mb-6">
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Book className="text-blue-400 h-5 w-5" />
            <label className="text-white">Books</label>
          </div>
          <input
            type="number"
            min="1"
            max="15"
            value={booksLength}
            onChange={(e) => setBooksLength(parseInt(e.target.value) || 1)}
            className="bg-gray-800 text-white border border-gray-700 rounded p-2 w-20"
          />
          <span className="text-gray-400 ml-2 text-sm">Number of books to display</span>
        </div>
      </div>

      {/* YAML Configuration Output */}
      <h2 className="text-xl text-white font-bold mb-4">Generated YAML</h2>
      
      {/* Combined YAML display with separate copy buttons */}
      <div className="dark-panel p-6 mb-6">
        <div className="mb-3">
          <h3 className="text-lg text-white">Configuration for Homepage Dashboard</h3>
        </div>
        
        <div className="bg-gray-800 p-4 rounded-md border border-gray-700">
          <div className="flex justify-between mb-2">
            <span className="text-green-400 font-mono">- Recently Added Books:</span>
            <button
              onClick={() => copyToClipboard(recentBooksYaml, 'recent')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1"
            >
              {copiedSection === 'recent' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedSection === 'recent' ? 'Copied!' : 'Copy YAML'}
            </button>
          </div>
          <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap ml-4 mb-6">{recentBooksYaml.replace('- Recently Added Books:', '')}</pre>
          
          <div className="flex justify-between mb-2">
            <span className="text-green-400 font-mono">- Book Counts:</span>
            <button
              onClick={() => copyToClipboard(bookCountsYaml, 'counts')}
              className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1"
            >
              {copiedSection === 'counts' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedSection === 'counts' ? 'Copied!' : 'Copy YAML'}
            </button>
          </div>
          <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap ml-4">{bookCountsYaml.replace('- Book Counts:', '')}</pre>
          
          <pre className="text-green-400 font-mono text-sm whitespace-pre-wrap mt-4">
{`# NOTE:
# - This configuration is based on your current setup
# - You can adjust the icons as needed (mdi-book, mdi-bookshelf, etc.)
# - The display will show up to ${booksLength} items in combined views
# - Format setting: ${formatMode === 'formatted' ? 'Numbers will be formatted' : 'Raw numbers will be displayed'}`}
          </pre>
        </div>
        
        <div className="mt-4 text-gray-400 text-sm">
          <p className="mb-2">This YAML configuration can be added to your Homepage configuration file.</p>
          <p className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            <a 
              href="https://gethomepage.dev/latest/widgets/services/audiobookshelf/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              View Homepage Audiobookshelf widget documentation
            </a>
          </p>
        </div>
      </div>

      {/* Configuration Status */}
      <div className="dark-panel p-4">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${homepageIp ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <p className="text-sm text-gray-300">
            {homepageIp ? 
              `Homepage IP configured: ${homepageIp}` : 
              'No Homepage IP configured. Set it in the Setup page for this configuration to work properly.'}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <div className={`h-3 w-3 rounded-full ${libraries.length > 0 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <p className="text-sm text-gray-300">
            {libraries.length > 0 ? 
              `${libraries.length} ${libraries.length === 1 ? 'library' : 'libraries'} configured` : 
              'No libraries configured. Select libraries in the Setup page.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomepageConfigView;