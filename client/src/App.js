import React, { useState } from 'react';
import { useLoadScript } from '@react-google-maps/api';
import MapScreen from './MapScreen';
import AddressComposer from './components/AddressComposer';
import AddressViewer from './components/AddressViewer';
import AddressBook from './components/AddressBook';
import SearchBar from './components/SearchBar';
import ProfilePanel from './components/ProfilePanel';
import { useStore } from './useStore';
import './index.css';

const libraries = ['places'];

const MilesBranding = ({ onStart, onSearchResult, onOpenAddressBook, isLoaded }) => (
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

        <button
          onClick={onOpenAddressBook}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#94a3b8',
            padding: '12px 32px',
            borderRadius: '30px',
            cursor: 'pointer',
            fontSize: '14px',
            letterSpacing: '1px',
            fontWeight: '600',
            marginLeft: '16px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.target.style.borderColor = 'rgba(255,255,255,0.3)'; e.target.style.color = 'white'; }}
          onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.color = '#94a3b8'; }}
        >
          Address Book
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

  // View Modes: 'create' | 'view' | 'edit' | 'address-book'
  const [viewMode, setViewMode] = useState('create');
  const [previousMode, setPreviousMode] = useState(null); // Track where we came from
  const [filteredBookCodes, setFilteredBookCodes] = useState(null); // For clustered hotspots
  const [hasStarted, setHasStarted] = useState(false);
  const [viewData, setViewData] = useState(null); // { address, household }

  const handleSearchResult = (result) => {
    setHasStarted(true);
    setPreviousMode(null); // Search results always "reset" the stack (or go back to home)
    if (result.type === 'residence') {
      const addressData = result.data.address;
      // Map backend fields to frontend expectations for MapScreen
      console.log('Search Result Address Data:', addressData);
      const mappedAddress = {
        ...addressData,
        polyline_smoothed: addressData.polylineOptimized || [],
        code: addressData.smartAddressCode
      };

      setSavedAddress(mappedAddress);

      // If the address has route data, populate it so MapScreen shows it
      if (mappedAddress.polyline_smoothed) {
        setPolyline(mappedAddress.polyline_smoothed);
        setPolylineSegments([{ points: mappedAddress.polyline_smoothed, mode: 'car' }]); // Default to car (Blue)
      }

      // Priority Focus: Destination -> Polyline Start
      let focusTarget = null;
      if (mappedAddress.destination_point?.coordinates) {
        focusTarget = { lat: mappedAddress.destination_point.coordinates[1], lng: mappedAddress.destination_point.coordinates[0] };
      } else if (mappedAddress.destination_point?.lat) {
        focusTarget = mappedAddress.destination_point;
      } else if (mappedAddress.polyline_smoothed?.length > 0) {
        focusTarget = mappedAddress.polyline_smoothed[0];
      }

      if (focusTarget) {
        setFocusPoint(focusTarget);
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
      if (savedAddress.destination_point?.coordinates) {
        // Backend stores [lng, lat]
        target = {
          lat: savedAddress.destination_point.coordinates[1],
          lng: savedAddress.destination_point.coordinates[0]
        };
      } else if (savedAddress.destination_point?.lat) {
        target = savedAddress.destination_point;
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
    if (previousMode === 'address-book') {
      setViewMode('address-book');
      setPreviousMode(null);
      return;
    }

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
  const isLanding = !hasStarted && viewMode !== 'address-book';

  const handleOpenAddressBook = () => {
    setHasStarted(true);
    setViewMode('address-book');
    // Clear map? Or show all points? For now, keep as is (likely default/last loc)
    // Maybe zoom out to see city?
  };

  const handleViewBookItem = (code, zoomLevel = 5) => {
    const addresses = useStore.getState().createdAddressesMap;
    const data = addresses[code];

    if (data) {
      // CLUSTERING LOGIC: Check for nearby addresses based on Zoom Level
      // Zoom 5 (Country) -> 0.5 deg tolerance (~55km)
      // Zoom 12 (City) -> 0.01 deg tolerance (~1km)
      // Zoom 15+ (Street) -> 0.0001 deg tolerance (~10m) -> basically no clustering

      let tolerance = 0.5;
      if (typeof zoomLevel === 'number') {
        if (zoomLevel > 18) tolerance = 0.00001; // Exact point
        else if (zoomLevel > 14) tolerance = 0.001; // ~100m
        else if (zoomLevel > 10) tolerance = 0.05; // ~5km
      }

      const targetAddr = data.address;
      let tLat, tLng;
      if (targetAddr.destination_point?.coordinates) {
        tLat = targetAddr.destination_point.coordinates[1];
        tLng = targetAddr.destination_point.coordinates[0];
      } else if (targetAddr.polylineOptimized?.length > 0) {
        tLat = targetAddr.polylineOptimized[targetAddr.polylineOptimized.length - 1].lat;
        tLng = targetAddr.polylineOptimized[targetAddr.polylineOptimized.length - 1].lng;
      }

      if (tLat && tLng && viewMode === 'address-book') {
        // Find neighbors
        const neighbors = Object.values(addresses).filter(item => {
          const a = item.address;
          let aLat, aLng;
          if (a.destination_point?.coordinates) {
            aLat = a.destination_point.coordinates[1];
            aLng = a.destination_point.coordinates[0];
          } else if (a.polylineOptimized?.length > 0) {
            aLat = a.polylineOptimized[a.polylineOptimized.length - 1].lat;
            aLng = a.polylineOptimized[a.polylineOptimized.length - 1].lng;
          }

          if (!aLat || !aLng) return false;

          const d = Math.sqrt(Math.pow(tLat - aLat, 2) + Math.pow(tLng - aLng, 2));
          return d < tolerance; // Approx ~50km tolerance for "clustering" visual check
        }).map(item => item.address.smartAddressCode);

        if (neighbors.length > 1) {
          console.log('Cluster detected:', neighbors);
          setFilteredBookCodes(neighbors);
          return; // Stop here, show list instead of opening one
        }
      }

      setPreviousMode('address-book'); // <--- Record source

      // Same logic as search result
      const addressData = data.address;
      const mappedAddress = {
        ...addressData,
        polyline_smoothed: addressData.polylineOptimized || [],
        code: addressData.smartAddressCode
      };

      setSavedAddress(mappedAddress);
      if (mappedAddress.polyline_smoothed && mappedAddress.polyline_smoothed.length > 0) {
        setPolyline(mappedAddress.polyline_smoothed);
        setPolylineSegments([{ points: mappedAddress.polyline_smoothed, mode: 'car' }]);
        setFocusPoint(mappedAddress.polyline_smoothed[0]);
      }

      setViewData(data);
      setViewMode('view');
    }
  };

  const handleDeleteAddress = (code) => {
    if (window.confirm('Are you sure you want to delete this address?')) {
      useStore.getState().removeCreatedAddress(code);
      // Logic to refresh or clear filter if the deleted one was current view? 
      // Zustand updates will trigger re-render of AddressBook list automatically.
      // If we are viewing it, we might want to close view.
      if (viewMode === 'view' && savedAddress?.code === code) {
        handleBack();
      }
    }
  };

  const handleEditAddressFromBook = (code) => {
    const addresses = useStore.getState().createdAddressesMap;
    const data = addresses[code];
    if (data) {
      setViewData(data);
      setViewMode('edit');
    }
  };

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

            {viewMode === 'address-book' && (
              <AddressBook
                onView={(code) => {
                  // When clicking FROM list, force open, ignore cluster check
                  // To do this reuse logic but maybe add flag? 
                  // Or just manually set it. Let's simplify:
                  // Actually handleViewBookItem checks viewMode. 
                  // If we click from list, we want to open it. 
                  // So we need to distinct "Click Map" vs "Click List".
                  // Let's create specific handler for list click.
                  const addresses = useStore.getState().createdAddressesMap;
                  const data = addresses[code];
                  if (data) {
                    setPreviousMode('address-book');
                    // ... hydration logic copy ...
                    // Refactor hydration logic? 
                    // For now, call logic with bypass param?
                    // Or simple copy paste to avoid risk of breaking map click logic
                    const addressData = data.address;
                    const mappedAddress = { ...addressData, polyline_smoothed: addressData.polylineOptimized || [], code: addressData.smartAddressCode };
                    setSavedAddress(mappedAddress);
                    if (mappedAddress.polyline_smoothed?.length > 0) {
                      setPolyline(mappedAddress.polyline_smoothed);
                      setPolylineSegments([{ points: mappedAddress.polyline_smoothed, mode: 'car' }]);
                      setFocusPoint(mappedAddress.polyline_smoothed[0]);
                    }
                    setViewData(data);
                    setViewMode('view');
                  }
                }}
                onBack={handleBack}
                filteredCodes={filteredBookCodes}
                onClearFilter={() => setFilteredBookCodes(null)}
                onDelete={handleDeleteAddress}
                onEdit={handleEditAddressFromBook}
              />
            )}
          </div>
        </div>

        {/* Map Region takes full width on Landing to show Branding */}
        <div className="map-region">
          {(isLanding || (viewMode === 'create' && wizardStep === 0 && !savedAddress)) ? (
            <MilesBranding
              onStart={() => setHasStarted(true)}
              onSearchResult={handleSearchResult}
              onOpenAddressBook={handleOpenAddressBook}
              isLoaded={isLoaded}
            />
          ) : (
            <MapScreen
              isLoaded={isLoaded}
              loadError={loadError}
              showHotspots={viewMode === 'address-book'}
              onHotspotClick={handleViewBookItem}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
