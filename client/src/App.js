import React, { useState } from 'react';
import { useLoadScript } from '@react-google-maps/api';
import MapScreen from './MapScreen';
import AddressComposer from './components/AddressComposer';
import AddressViewer from './components/AddressViewer';
import SearchBar from './components/SearchBar';
import ProfilePanel from './components/ProfilePanel';
import { useStore } from './useStore';
import './index.css';

const libraries = ['places'];

function App() {
  const { savedAddress, setSavedAddress, setFocusPoint, setPolyline, setSelectedRoadPoint, setNearestRoad, setDrawing, setNearbyAddresses, setDuplicates, resetAddressForm, resetProfileForm } = useStore();

  // Load Google Maps Script Globally
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries
  });

  // View Modes: 'create' | 'view' | 'edit'
  const [viewMode, setViewMode] = useState('create');
  const [viewData, setViewData] = useState(null); // { address, household }

  const handleSearchResult = (result) => {
    if (result.type === 'residence') {
      const addressData = result.data.address;
      // Map backend fields to frontend expectations for MapScreen
      console.log('Search Result Address Data:', addressData);
      const mappedAddress = {
        ...addressData,
        polyline_smoothed: addressData.polylineOptimized || [],
        code: addressData.smartAddressCode
      };
      console.log('Mapped Address for Store:', mappedAddress);

      setSavedAddress(mappedAddress); // Update store so MapScreen renders the route
      setViewData(result.data);
      setViewMode('view');
    } else if (result.type === 'place') {
      // Pan to place
      if (result.location) {
        setFocusPoint(result.location);
      }
    }
  };

  const handleEdit = (addressData) => {
    setViewMode('edit');
  };

  const handleBack = () => {
    setViewMode('create');
    setViewData(null);
  };

  const handleReset = () => {
    // Reset Store
    setSavedAddress(null);
    setPolyline([]);
    setSelectedRoadPoint(null);
    setNearestRoad(null);
    setDrawing(false);
    setNearbyAddresses([]);
    setDuplicates([]);
    resetAddressForm();
    resetProfileForm();

    // Reset Local State
    setViewMode('create');
    setViewData(null);

    // Reload window to ensure map and all states are clean (optional but robust)
    window.location.reload();
  };

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className="app-shell">
      <header className="header">
        <div className="brand-cluster" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

          <h1 style={{ color: '#2854C5', margin: 0, fontSize: '48px', fontFamily: '"MuseoModerno", sans-serif', fontWeight: '400', letterSpacing: '-2px' }}>Miles</h1>
        </div>
        <div className="header-actions">
          <button className="small-btn" onClick={handleReset} style={{ background: '#f5f5f5', color: '#333', border: '1px solid #ddd' }}>Reset</button>
        </div>
      </header>

      <div className="main-layout">
        <div className="sidebar">
          <SearchBar onResult={handleSearchResult} isLoaded={isLoaded} />

          <div className="sidebar-content">
            {viewMode === 'create' && <AddressComposer />}

            {viewMode === 'view' && viewData && (
              <AddressViewer
                data={viewData}
                onEdit={handleEdit}
                onBack={handleBack}
              />
            )}

            {viewMode === 'edit' && viewData && (
              <div className="edit-wrapper">
                <div className="panel-header" style={{ marginBottom: 10 }}>
                  <button className="small-btn" onClick={() => setViewMode('view')}>Cancel Edit</button>
                  <h4>Editing {viewData.address.smartAddressCode}</h4>
                </div>
                <AddressComposer
                  initialData={viewData.address}
                  onSaveSuccess={() => {
                    alert('Saved!');
                    setViewMode('view');
                  }}
                />
              </div>
            )}

            {savedAddress && viewMode === 'create' && <ProfilePanel />}
          </div>
        </div>
        <div className="map-region">
          <MapScreen isLoaded={isLoaded} loadError={loadError} />
        </div>
      </div>
    </div>
  );
}

export default App;
