import React, { useState } from 'react';
import { getResidenceByCode } from '../api';
import usePlacesAutocomplete, { getGeocode, getLatLng } from 'use-places-autocomplete';

export default function SearchBar({ onResult, isLoaded }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Places Autocomplete Hook
  const {
    ready,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      /* Define search scope here if needed */
    },
    debounce: 300,
    initOnMount: isLoaded,
  });

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    setValue(val);
  };

  const handleSelectPlace = async (description) => {
    setQuery(description);
    setValue(description, false);
    clearSuggestions();

    try {
      const results = await getGeocode({ address: description });
      const { lat, lng } = await getLatLng(results[0]);
      if (typeof lat === 'number' && typeof lng === 'number') {
        onResult({
          type: 'place',
          location: { lat, lng },
          description
        });
      } else {
        console.error('Invalid coordinates returned for place:', description);
      }
    } catch (error) {
      console.log('Error: ', error);
    }
  };

  const handleSearchCode = async (e) => {
    e.preventDefault();
    if (!query) return;

    // Check if it looks like a Smart Code (e.g., SLMD-XXXXXX)
    // Allow alphanumeric and hyphens, at least 6 chars
    const isCode = /^[A-Z0-9-]{6,}$/i.test(query.trim());

    if (isCode) {
      setLoading(true);
      setError('');
      try {
        const data = await getResidenceByCode(query.trim());
        onResult({ type: 'residence', data });
        setQuery('');
        setValue('');
      } catch (err) {
        setError('Smart Address not found');
      } finally {
        setLoading(false);
      }
    } else {
      // If not a code, maybe they hit enter on a place search?
      // For now, we rely on clicking the dropdown for places.
      setError('Please select a place from the list or enter a valid Smart Address Code');
    }
  };

  return (
    <div className="search-container">
      <form onSubmit={handleSearchCode} className="search-input-wrapper">
        <div className="search-icon-box">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search Place or Smart Code..."
          value={query}
          onChange={handleInput}
          disabled={!ready}
        />
        {loading && <div style={{ marginRight: 12, fontSize: 12, color: '#9CA3AF' }}>Loading...</div>}
        {!loading && query && (
          <button type="submit" className="search-action-btn">
            Go
          </button>
        )}
      </form>

      {/* Places Dropdown */}
      {status === 'OK' && (
        <ul className="suggestions-list">
          {data.map(({ place_id, description }) => (
            <li key={place_id} onClick={() => handleSelectPlace(description)}>
              {description}
            </li>
          ))}
        </ul>
      )}

      {error && <div className="search-error">{error}</div>}

      <style>{`
        .suggestions-list {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #E5E7EB;
          border-radius: 12px;
          list-style: none;
          padding: 0;
          margin: 8px 0 0 0;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          max-height: 240px;
          overflow-y: auto;
          z-index: 100;
        }
        .suggestions-list li {
          padding: 12px 16px;
          cursor: pointer;
          font-size: 14px;
          border-bottom: 1px solid #F3F4F6;
          color: #374151;
          transition: background 0.1s;
        }
        .suggestions-list li:last-child {
          border-bottom: none;
        }
        .suggestions-list li:hover {
          background-color: #F9FAFB;
          color: #111827;
        }
        .search-error {
          color: #EF4444;
          font-size: 13px;
          margin-top: 8px;
          padding-left: 4px;
        }
      `}</style>
    </div>
  );
}
