import React, { useState, useEffect, useRef } from 'react';
import { Save, Layout, RefreshCw, BookOpen, Plus, CheckCircle, XCircle, Film, Tv, Music } from 'lucide-react';

const FormatSettingsView = () => {
  const [showAdditionalField, setShowAdditionalField] = useState(true);
  const [loading, setSaving] = useState(false);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [saved, setSaved] = useState(false);
  const [examples, setExamples] = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [selectedLibraryId, setSelectedLibraryId] = useState('');
  
  // References to track active textarea for variable insertion
  const primaryFormatRef = useRef(null);
  const additionalFormatRef = useRef(null);
  const [activeTextareaRef, setActiveTextareaRef] = useState(null);

  // Per-library format settings with modified tracking
  const [libraryFormats, setLibraryFormats] = useState({});
  // Track which libraries have unsaved changes
  const [unsavedChanges, setUnsavedChanges] = useState({});
  // Track global save status message
  const [saveFeedback, setSaveFeedback] = useState({ message: '', type: '' });

  useEffect(() => {
    // Load libraries and formats
    fetchLibraries();
  }, []);

  // When a library is selected, load its specific formats
  useEffect(() => {
    if (selectedLibraryId) {
      // If we already have formats for this library, use them
      if (libraryFormats[selectedLibraryId]) {
        // Don't modify other libraries' formats
      } else {
        // Otherwise load from API
        fetchLibraryFormat(selectedLibraryId);
      }
    }
  }, [selectedLibraryId]);

  const fetchLibraries = async () => {
    try {
      const response = await fetch('/api/audiobooks/libraries');
      if (response.ok) {
        const data = await response.json();
        if (data.response && data.response.data) {
          setLibraries(data.response.data);
          
          // If libraries are found, select the first one by default
          if (data.response.data.length > 0 && !selectedLibraryId) {
            setSelectedLibraryId(data.response.data[0].id);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching libraries:', error);
    }
  };

  const fetchLibraryFormat = async (libraryId) => {
    setLoadingExamples(true);
    try {
      const response = await fetch(`/api/formats?libraryId=${libraryId}`);
      if (response.ok) {
        const data = await response.json();
        
        // Cache the formats for this library
        setLibraryFormats(prev => ({
          ...prev,
          [libraryId]: {
            primaryFormat: data.formats?.primaryFormat || '${title}',
            additionalFormat: data.formats?.additionalFormat || ''
          }
        }));
        
        // Update examples
        setExamples(data.examples || []);
      }
    } catch (error) {
      console.error(`Error fetching formats for library ${libraryId}:`, error);
    } finally {
      setLoadingExamples(false);
    }
  };

  const saveChanges = async (specificLibraryId = null) => {
    // If a specific library ID is provided, save only that library
    // Otherwise, save all libraries with unsaved changes
    const librariesToSave = specificLibraryId 
      ? [specificLibraryId] 
      : Object.keys(unsavedChanges).filter(id => unsavedChanges[id]);
    
    if (librariesToSave.length === 0) {
      setSaveFeedback({
        message: 'No changes to save',
        type: 'info'
      });
      setTimeout(() => setSaveFeedback({ message: '', type: '' }), 3000);
      return;
    }
    
    setSaving(true);
    setSaveFeedback({ message: '', type: '' });
    
    try {
      // Array to store all save operations
      const savePromises = librariesToSave.map(libraryId => {
        const formatToSave = {
          primaryFormat: libraryFormats[libraryId]?.primaryFormat || '${title}',
          additionalFormat: libraryFormats[libraryId]?.additionalFormat || ''
        };
        
        return fetch(`/api/formats?libraryId=${libraryId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formatToSave)
        });
      });
      
      // Wait for all save operations to complete
      const results = await Promise.all(savePromises);
      
      // Check if all operations were successful
      const allSuccessful = results.every(response => response.ok);
      
      if (allSuccessful) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        
        // Clear unsaved changes for saved libraries
        const updatedUnsavedChanges = { ...unsavedChanges };
        librariesToSave.forEach(id => {
          updatedUnsavedChanges[id] = false;
        });
        setUnsavedChanges(updatedUnsavedChanges);
        
        setSaveFeedback({
          message: `Format settings saved successfully for ${librariesToSave.length} ${librariesToSave.length === 1 ? 'library' : 'libraries'}`,
          type: 'success'
        });
        
        // If current library was saved, refresh its examples
        if (librariesToSave.includes(selectedLibraryId)) {
          fetchLibraryFormat(selectedLibraryId);
        }
      } else {
        setSaveFeedback({
          message: 'Error saving some format settings',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error saving formats:', error);
      setSaveFeedback({
        message: `Error: ${error.message}`,
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Function to toggle the Additional Field for the current library
  const toggleAdditionalField = () => {
    setShowAdditionalField(!showAdditionalField);
    
    // Update the current library format
    if (selectedLibraryId) {
      const currentLibraryFormat = libraryFormats[selectedLibraryId] || {
        primaryFormat: '${title}',
        additionalFormat: ''
      };
      
      setLibraryFormats(prev => ({
        ...prev,
        [selectedLibraryId]: {
          ...currentLibraryFormat,
          additionalFormat: !showAdditionalField 
            ? '${added_at_relative}'  // Add default when enabling
            : ''                      // Clear when disabling
        }
      }));
      
      // Mark this library as having unsaved changes
      setUnsavedChanges(prev => ({
        ...prev,
        [selectedLibraryId]: true
      }));
    }
  };
  
  // Function to handle updating the primary format
  const updatePrimaryFormat = (value) => {
    if (!selectedLibraryId) return;
    
    setLibraryFormats(prev => ({
      ...prev,
      [selectedLibraryId]: {
        ...prev[selectedLibraryId],
        primaryFormat: value
      }
    }));
    
    // Mark this library as having unsaved changes
    setUnsavedChanges(prev => ({
      ...prev,
      [selectedLibraryId]: true
    }));
  };
  
  // Function to handle updating the additional format
  const updateAdditionalFormat = (value) => {
    if (!selectedLibraryId) return;
    
    setLibraryFormats(prev => ({
      ...prev,
      [selectedLibraryId]: {
        ...prev[selectedLibraryId],
        additionalFormat: value
      }
    }));
    
    // Mark this library as having unsaved changes
    setUnsavedChanges(prev => ({
      ...prev,
      [selectedLibraryId]: true
    }));
  };
  
  // Function to handle inserting a variable at the cursor position
  const insertVariableAtCursor = (variable) => {
    // Determine which textarea is active
    const textarea = activeTextareaRef?.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    
    // Insert the variable at cursor position
    const newValue = value.substring(0, start) + variable + value.substring(end);
    
    // Update the appropriate state
    if (textarea === primaryFormatRef.current) {
      updatePrimaryFormat(newValue);
    } else if (textarea === additionalFormatRef.current) {
      updateAdditionalFormat(newValue);
    }
    
    // After state update, focus and set cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  // Helper function to get the appropriate icon for a library based on its type
  const getLibraryIcon = (library) => {
    const mediaType = library.mediaType?.toLowerCase() || '';
    
    if (mediaType.includes('movie')) return <Film className="h-6 w-6" />;
    if (mediaType.includes('show')) return <Tv className="h-6 w-6" />;
    if (mediaType.includes('music')) return <Music className="h-6 w-6" />;
    return <BookOpen className="h-6 w-6" />;
  };

  // Helper to get the current library's primary format
  const getCurrentPrimaryFormat = () => {
    if (!selectedLibraryId || !libraryFormats[selectedLibraryId]) return '${title}';
    return libraryFormats[selectedLibraryId].primaryFormat || '${title}';
  };
  
  // Helper to get the current library's additional format
  const getCurrentAdditionalFormat = () => {
    if (!selectedLibraryId || !libraryFormats[selectedLibraryId]) return '';
    return libraryFormats[selectedLibraryId].additionalFormat || '';
  };
  
  // Helper to check if the current library has additional format
  const hasAdditionalFormat = () => {
    if (!selectedLibraryId || !libraryFormats[selectedLibraryId]) return false;
    return !!libraryFormats[selectedLibraryId].additionalFormat;
  };

  // Count libraries with unsaved changes
  const countUnsavedChanges = () => {
    return Object.values(unsavedChanges).filter(Boolean).length;
  };

  return (
    <div className="section-spacing">
      <div className="dark-panel mb-6">
        <div className="p-4">
          <h1 className="text-xl font-bold text-white">Format Settings</h1>
          <p className="text-gray-400 mt-2">
            Configure display formats for users and media items.
          </p>
        </div>
      </div>

      {/* Media Section */}
      <h2 className="text-xl text-white font-bold mb-4">Media Section</h2>
      
      {/* Save All Button - Only show if there are unsaved changes */}
      {countUnsavedChanges() > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded flex items-center gap-2"
            onClick={() => saveChanges()}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="loading-spinner h-4 w-4"></span>
                <span>Saving All Changes...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save All Changes ({countUnsavedChanges()})</span>
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Feedback Message */}
      {saveFeedback.message && (
        <div className={`mb-4 p-3 rounded ${
          saveFeedback.type === 'success' ? 'bg-green-800/30 border border-green-700' : 
          saveFeedback.type === 'error' ? 'bg-red-800/30 border border-red-700' :
          'bg-blue-800/30 border border-blue-700'
        }`}>
          <p className={`text-sm ${
            saveFeedback.type === 'success' ? 'text-green-400' : 
            saveFeedback.type === 'error' ? 'text-red-400' :
            'text-blue-400'
          }`}>
            {saveFeedback.message}
          </p>
        </div>
      )}
      
      {/* Libraries Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {libraries.map(library => (
          <div 
            key={library.id}
            className={`dark-panel p-4 cursor-pointer transition-colors ${
              selectedLibraryId === library.id 
                ? 'border-2 border-blue-500 bg-blue-900/20' 
                : 'border border-gray-700 hover:bg-gray-800/50'
            }`}
            onClick={() => setSelectedLibraryId(library.id)}
          >
            <div className="flex items-center gap-3">
              <div className="text-blue-400">
                {getLibraryIcon(library)}
              </div>
              <div className="flex-grow">
                <div className="text-white font-medium">Section {library.id.substring(0, 5)}</div>
                <div className="text-gray-400 text-sm">{library.name}</div>
              </div>
              {/* Show indicator for unsaved changes */}
              {unsavedChanges[library.id] && (
                <div className="text-yellow-400" title="Unsaved changes">
                  <div className="h-2 w-2 rounded-full bg-yellow-400"></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedLibraryId && (
        <>
          {/* Format Template */}
          <div className="dark-panel mb-6">
            <div className="flex justify-between items-center p-4 border-b border-gray-700">
              <h3 className="text-lg text-white font-medium">Format Template</h3>
              <button 
                className={`${hasAdditionalFormat() ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} text-white px-3 py-1 rounded text-sm flex items-center gap-1`}
                onClick={toggleAdditionalField}
              >
                {hasAdditionalFormat() ? (
                  'Remove Additional Field'
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Additional Field
                  </>
                )}
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Primary Field */}
              <div>
                <label className="block text-white mb-2">Primary Field</label>
                <div className="text-sm text-gray-400 mb-2">Display Format</div>
                <textarea
                  ref={primaryFormatRef}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded text-white"
                  rows="3"
                  value={getCurrentPrimaryFormat()}
                  onChange={(e) => updatePrimaryFormat(e.target.value)}
                  placeholder="Format pattern, e.g. ${title} (${year}) ${duration}"
                  onFocus={() => setActiveTextareaRef(primaryFormatRef)}
                />
              </div>

              {/* Additional Field - Only render if showAdditionalField is true */}
              {hasAdditionalFormat() && (
                <div>
                  <label className="block text-white mb-2">Additional Field</label>
                  <div className="text-sm text-gray-400 mb-2">Display Format</div>
                  <textarea
                    ref={additionalFormatRef}
                    className="w-full p-3 bg-gray-800 border border-gray-700 rounded text-white"
                    rows="3"
                    value={getCurrentAdditionalFormat()}
                    onChange={(e) => updateAdditionalFormat(e.target.value)}
                    placeholder="Format pattern, e.g. ${added_at_relative}"
                    onFocus={() => setActiveTextareaRef(additionalFormatRef)}
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Example Preview */}
          <div className="dark-panel mb-6">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg text-white font-medium">Format Preview</h3>
              <p className="text-sm text-gray-400 mt-1">
                See how your format will look with actual media items
              </p>
            </div>
            
            <div className="p-4">
              {loadingExamples ? (
                <div className="flex justify-center py-12">
                  <div className="loading-spinner" />
                </div>
              ) : examples.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No example items available for this library.
                </div>
              ) : (
                <div className="p-4 bg-gray-800/30 rounded border border-gray-700">
                  <div className="flex gap-4 items-start">
                    <BookOpen className="h-6 w-6 text-blue-400 flex-shrink-0 mt-1" />
                    <div className="flex-grow">
                      <div className="font-medium text-white">
                        {examples[0]?.formattedPrimary || 'No preview available'}
                      </div>
                      {/* Only show additional format if the field is visible */}
                      {hasAdditionalFormat() && (
                        <div className="text-sm text-gray-400 mt-1">
                          {examples[0]?.formattedAdditional || ''}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-2">
                        From: {libraries.find(l => l.id === examples[0]?.libraryId)?.name || 'Unknown library'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Available Variables */}
          <div className="dark-panel mb-6">
            <h3 className="text-lg text-white font-medium p-4 border-b border-gray-700">Available Variables</h3>
            <div className="p-4">
              <p className="text-gray-400 mb-4">Click on a variable to insert it at the cursor position:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <code 
                    className="text-blue-400 font-mono cursor-pointer hover:bg-blue-900/30 px-1"
                    onClick={() => insertVariableAtCursor('${title}')}
                  >$&#123;title&#125;</code>
                  <span className="text-gray-400">- Audiobook title (e.g., "Project Hail Mary")</span>
                </div>
                <div className="flex items-start gap-2">
                  <code 
                    className="text-blue-400 font-mono cursor-pointer hover:bg-blue-900/30 px-1"
                    onClick={() => insertVariableAtCursor('${year}')}
                  >$&#123;year&#125;</code>
                  <span className="text-gray-400">- Release year (e.g., "2021")</span>
                </div>
                <div className="flex items-start gap-2">
                  <code 
                    className="text-blue-400 font-mono cursor-pointer hover:bg-blue-900/30 px-1"
                    onClick={() => insertVariableAtCursor('${duration}')}
                  >$&#123;duration&#125;</code>
                  <span className="text-gray-400">- Runtime in hours and minutes (e.g., "16h 10m")</span>
                </div>
                <div className="flex items-start gap-2">
                  <code 
                    className="text-blue-400 font-mono cursor-pointer hover:bg-blue-900/30 px-1"
                    onClick={() => insertVariableAtCursor('${author_name}')}
                  >$&#123;author_name&#125;</code>
                  <span className="text-gray-400">- Author name (e.g., "Andy Weir")</span>
                </div>
                <div className="flex items-start gap-2">
                  <code 
                    className="text-blue-400 font-mono cursor-pointer hover:bg-blue-900/30 px-1"
                    onClick={() => insertVariableAtCursor('${narrator_name}')}
                  >$&#123;narrator_name&#125;</code>
                  <span className="text-gray-400">- Narrator name (e.g., "Ray Porter")</span>
                </div>
                <div className="flex items-start gap-2">
                  <code 
                    className="text-blue-400 font-mono cursor-pointer hover:bg-blue-900/30 px-1"
                    onClick={() => insertVariableAtCursor('${series_name}')}
                  >$&#123;series_name&#125;</code>
                  <span className="text-gray-400">- Series name and number (e.g., "Bobiverse #1")</span>
                </div>
                <div className="flex items-start gap-2">
                  <code 
                    className="text-blue-400 font-mono cursor-pointer hover:bg-blue-900/30 px-1"
                    onClick={() => insertVariableAtCursor('${added_at_relative}')}
                  >$&#123;added_at_relative&#125;</code>
                  <span className="text-gray-400">- Relative time since addition (e.g., "2d ago")</span>
                </div>
                <div className="flex items-start gap-2">
                  <code 
                    className="text-blue-400 font-mono cursor-pointer hover:bg-blue-900/30 px-1"
                    onClick={() => insertVariableAtCursor('${added_at_short}')}
                  >$&#123;added_at_short&#125;</code>
                  <span className="text-gray-400">- Short date format for addition date (e.g., "Feb 10")</span>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button - Only for current library */}
          <div className="flex justify-between">
            <div>
              {unsavedChanges[selectedLibraryId] && (
                <span className="text-yellow-400 text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-400"></div>
                  Unsaved changes for this library
                </span>
              )}
            </div>
            <button
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded flex items-center gap-2"
              onClick={() => saveChanges(selectedLibraryId)}
              disabled={loading || !unsavedChanges[selectedLibraryId]}
            >
              {loading ? (
                <>
                  <span className="loading-spinner h-4 w-4"></span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save This Library</span>
                </>
              )}
            </button>
          </div>
          
          {saved && (
            <div className="mt-4 p-3 bg-green-800/30 border border-green-700 rounded">
              <p className="text-green-400 text-sm">Format settings saved successfully!</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FormatSettingsView;