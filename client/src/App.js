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

const MilesBranding = ({ onStart, onSearchResult, isLoaded }) => (
  <div style={{
    width: '100%',
    height: '100%',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#020617',
    overflow: 'hidden',
    fontFamily: '"Inter", sans-serif'
  }}>
    {/* Abstract Glows */}
    <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(120px)' }} />
    <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(120px)' }} />

    {/* Content Container */}
    <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        fontSize: '120px',
        fontWeight: '900',
        letterSpacing: '-4px',
        lineHeight: 1,
        background: 'linear-gradient(to bottom right, #ffffff 30%, #94a3b8 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.5))'
      }}>
        Miles.
      </div>
      <div style={{
        marginTop: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px'
      }}>
        <div style={{ height: '1px', width: '40px', background: 'rgba(255,255,255,0.2)' }} />
        <span style={{
          fontSize: '14px',
          color: '#94a3b8',
          letterSpacing: '6px',
          textTransform: 'uppercase',
          fontWeight: '600'
        }}>
          The Last Mile OS
        </span>
        <div style={{ height: '1px', width: '40px', background: 'rgba(255,255,255,0.2)' }} />
      </div>

      {/* Interactive Entry Points */}
      <div style={{ marginTop: '48px', width: '100%', maxWidth: '420px', position: 'relative', zIndex: 20 }}>
        <SearchBar onResult={onSearchResult} isLoaded={isLoaded} />
      </div>

      <div style={{ marginTop: '24px', zIndex: 20 }}>
        <button
          onClick={onStart}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#cbd5e1',
            padding: '12px 32px',
            borderRadius: '30px',
            cursor: 'pointer',
            fontSize: '14px',
            letterSpacing: '1px',
            fontWeight: '600',
            transition: 'all 0.2s',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.color = 'white'; }}
          onMouseLeave={e => { e.target.style.background = 'rgba(255,255,255,0.05)'; e.target.style.color = '#cbd5e1'; }}
        >
          Create New Address
        </button>
      </div>

      {/* Premium Badge */}
      <div style={{ marginTop: '60px', opacity: 0.6 }}>
        <span style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '10px',
          color: '#64748b',
          fontWeight: '500',
          letterSpacing: '1px'
        }}>
          ENTERPRISE EDITION 2.0
        </span>
      </div>
    </div>
  </div>
);

function App() {
  const { savedAddress, setSavedAddress, setFocusPoint, setPolyline, setPolylineSegments, setSelectedRoadPoint, setNearestRoad, setDrawing, setNearbyAddresses, setDuplicates, resetAddressForm, resetProfileForm } = useStore();

  // Load Google Maps Script Globally
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries
  });

  // View Modes: 'create' | 'view' | 'edit'
  const [viewMode, setViewMode] = useState('create');
  const [hasStarted, setHasStarted] = useState(false);
  const [viewData, setViewData] = useState(null); // { address, household }

  const handleSearchResult = (result) => {
    setHasStarted(true);
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

      // Hydrate Map State
      setSavedAddress(mappedAddress);

      // If the address has route data, populate it so MapScreen shows it
      if (mappedAddress.polyline_smoothed) {
        setPolyline(mappedAddress.polyline_smoothed);
        setPolylineSegments([{ points: mappedAddress.polyline_smoothed, mode: 'car' }]); // Default to car (Blue)
        // Zoom to the start
        if (mappedAddress.polyline_smoothed.length > 0) {
          setFocusPoint(mappedAddress.polyline_smoothed[0]);
        }
      }

      setViewData(result.data);
      setViewMode('view');
    } else if (result.type === 'place') {
      // Pan to place
      if (result.location) {
        setFocusPoint(result.location);
      }
    }
  };

  const handleViewOnMap = () => {
    // Priority: 1. Destination Point (The House/Door) - Most Accurate
    //           2. End of Polyline (Usually the house)
    //           3. Address Location Fallback
    //           4. Start of Polyline (Gate) - Last Resort
    let target = null;

    if (savedAddress) {
      if (savedAddress.destination_point && savedAddress.destination_point.coordinates) {
        // Backend stores [lng, lat]
        target = {
          lat: savedAddress.destination_point.coordinates[1],
          lng: savedAddress.destination_point.coordinates[0]
        };
      } else if (savedAddress.polyline_smoothed && savedAddress.polyline_smoothed.length > 0) {
        // Use the LAST point of the polyline (the destination)
        target = savedAddress.polyline_smoothed[savedAddress.polyline_smoothed.length - 1];
      } else if (savedAddress.location && savedAddress.location.lat) {
        target = savedAddress.location;
      } else if (savedAddress.polyline_smoothed && savedAddress.polyline_smoothed.length > 0) {
        // Fallback to start if nothing else (already covered by length check above but kept for clarity/safety logic flow)
        target = savedAddress.polyline_smoothed[0];
      }
    }

    if (target) {
      // Force new object reference to ensure useEffect triggers
      setFocusPoint({ ...target, forceUpdate: Date.now() });
    } else {
      console.warn('View on Map: No valid coordinates found in savedAddress', savedAddress);
    }
  };

  const handleEdit = (addressData) => {
    setViewMode('edit');
  };

  const handleBack = () => {
    // Fully reset to landing page
    setViewMode('create');
    setViewData(null);
    useStore.getState().setWizardStep(0);

    // Also clear map state if coming from search
    setPolyline([]);
    setNearbyAddresses([]);
    setDuplicates([]);

    // Deep reset storage forms
    resetAddressForm();
    resetProfileForm();
    setSavedAddress(null); // Clear saved address to hide ProfilePanel
    setHasStarted(false); // Return to Branding
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
    setHasStarted(false);

    // Reload window to ensure map and all states are clean (optional but robust)
    window.location.reload();
  };

  // Landing Mode Logic
  const wizardStep = useStore((s) => s.wizardStep);
  const isLanding = !hasStarted;

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className={`app-shell ${isLanding ? 'landing-mode' : ''}`}>
      <header className="header">
        <div className="brand-cluster">
          <h1>Miles</h1>
        </div>
        <div className="header-actions">
          <button className="small-btn" onClick={handleReset}>Reset</button>
        </div>
      </header>

      <div className="main-layout">
        {/* Sidebar is only visible when we have started */}
        <div className="sidebar" style={{ display: isLanding ? 'none' : 'flex' }}>
          <SearchBar onResult={handleSearchResult} isLoaded={isLoaded} />

          <div className="sidebar-content">
            {viewMode === 'create' && <AddressComposer />}

            {viewMode === 'view' && viewData && (
              <AddressViewer
                data={viewData}
                onEdit={handleEdit}
                onBack={handleBack}
                onViewMap={handleViewOnMap}
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

        {/* Map Region takes full width on Landing to show Branding */}
        <div className="map-region">
          {(isLanding || (viewMode === 'create' && wizardStep === 0 && !savedAddress)) ? (
            <MilesBranding
              onStart={() => setHasStarted(true)}
              onSearchResult={handleSearchResult}
              isLoaded={isLoaded}
            />
          ) : (
            <MapScreen isLoaded={isLoaded} loadError={loadError} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
