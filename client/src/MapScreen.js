import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, Circle, Polyline, StreetViewPanorama } from '@react-google-maps/api';
import { useStore } from './useStore';
import DrawingLayer from './DrawingLayer';
import RoadDetection from './RoadDetection';
import { nearbyAddresses, fetchNearbyRoads } from './api';
import { chaikinSmooth, pathDistanceMeters, formatDistance } from './PolylineUtils';

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 28.6139, lng: 77.209 };
const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  fullscreenControl: false,
  mapTypeControl: false,
  streetViewControl: false
};

export default function MapScreen({ isLoaded, loadError }) {
  // Removed internal useLoadScript
  /*
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries
  });
  */

  const mapRef = useRef(null);
  const streetViewRef = useRef(null);

  /* isCropping: User is adjusting the frame with an overlay */
  const [isCropping, setIsCropping] = useState(false);
  const viewfinderRef = useRef(null);

  const handleCaptureStreetView = useCallback(async () => {
    if (!streetViewRef.current) return;
    const pov = streetViewRef.current.getPov();
    const pos = streetViewRef.current.getPosition();

    // Calculate simulated FOV based on Zoom if needed, but standard is fine.
    // Ideally we'd zoom in the Static API based on the crop box ratio, 
    // but the API deals in FOV (max 120, min ~10). 
    // If user zoomed in SV, `zoom` property is available.
    // streetViewRef.current.getZoom() returns 0-3 usually.
    // Formula: fov = 180 / (2^zoom) roughly.
    const zoom = streetViewRef.current.getZoom() || 1;
    const fov = Math.max(10, Math.min(120, 180 / Math.pow(2, zoom)));

    // Dynamic Size from Viewfinder
    let size = "600x400"; // Fallback
    if (viewfinderRef.current) {
      const w = viewfinderRef.current.clientWidth;
      const h = viewfinderRef.current.clientHeight;
      // Cap max size for Standard Plan (640x640) - or assume Premium/Scale
      // For safety, let's cap at 640 for width/height or use scale=2 if small
      const safeW = Math.min(640, w);
      const safeH = Math.min(640, h);
      size = `${safeW}x${safeH}`;
    }

    if (pos && pov) {
      // MUST append API Key
      const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
      const url = `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${pos.lat()},${pos.lng()}&heading=${pov.heading}&pitch=${pov.pitch}&fov=${fov}&key=${apiKey}`;
      console.log("Capturing Street View URL:", url);

      console.log("Capturing Street View URL:", url);

      // Store the URL string directly.
      // The backend expects a string (URL), and since we don't have a multipart upload flow for this feature yet,
      // sending a File object via JSON results in "{}".
      useStore.getState().setStreetView({ visible: false, capturedUrl: url });
      setIsCropping(false);
    }
  }, []);
  const [mapType, setMapType] = useState('hybrid');
  const [locating, setLocating] = useState(false);
  const [status, setStatus] = useState('Tap "Find my location" to begin.');

  // ==== stable, individual selectors (prevents unstable object creation)
  const userLocation = useStore((s) => s.userLocation);
  const setUserLocation = useStore((s) => s.setUserLocation);

  const nearestRoadPoint = useStore((s) => s.nearestRoad);
  const setNearestRoad = useStore((s) => s.setNearestRoad);

  const selectedRoadPoint = useStore((s) => s.selectedRoadPoint);
  const setSelectedRoadPoint = useStore((s) => s.setSelectedRoadPoint);

  const polyline = useStore((s) => s.polyline);
  const setPolyline = useStore((s) => s.setPolyline);

  const drawing = useStore((s) => s.drawing);
  const setDrawing = useStore((s) => s.setDrawing);

  const nearbyList = useStore((s) => s.nearbyAddresses);
  const setNearbyAddresses = useStore((s) => s.setNearbyAddresses);

  const setDuplicates = useStore((s) => s.setDuplicates);
  const savedAddress = useStore((s) => s.savedAddress);
  const focusPoint = useStore((s) => s.focusPoint);

  // New state for road visibility
  const [referencePoint, setReferencePoint] = useState(null);
  const [nearbyRoads, setNearbyRoads] = useState([]);
  const [selectedRoadPath, setSelectedRoadPath] = useState(null);


  // derived
  const routeDistance = useMemo(() => pathDistanceMeters(polyline), [polyline]);
  const routeReady = Boolean(selectedRoadPoint && polyline && polyline.length >= 2);

  // safe pan helper (no state changes)
  const panTo = useCallback((point, zoom = 19) => {
    if (!point || !mapRef.current) return;
    if (typeof point.lat !== 'number' || typeof point.lng !== 'number') {
      console.warn('Invalid point passed to panTo:', point);
      return;
    }
    try {
      mapRef.current.panTo(point);
      mapRef.current.setZoom(zoom);
    } catch (e) {
      console.error('Map panTo error:', e);
    }
  }, []);

  const onMapLoad = useCallback(
    (map) => {
      mapRef.current = map;
      if (mapType) map.setMapTypeId(mapType);
    },
    [mapType]
  );

  useEffect(() => {
    if (mapRef.current) mapRef.current.setMapTypeId(mapType);
  }, [mapType]);

  useEffect(() => {
    if (focusPoint) panTo(focusPoint, 20);
  }, [focusPoint, panTo]);

  // Load saved address route on map when address is loaded
  useEffect(() => {
    if (savedAddress && savedAddress.polyline_smoothed && savedAddress.polyline_smoothed.length > 0) {
      setPolyline(savedAddress.polyline_smoothed);

      // Fit bounds to show the entire route
      if (mapRef.current && window.google) {
        const bounds = new window.google.maps.LatLngBounds();
        savedAddress.polyline_smoothed.forEach(point => bounds.extend(point));
        mapRef.current.fitBounds(bounds);
      }

      if (savedAddress.road_point) {
        setSelectedRoadPoint(savedAddress.road_point);
        setNearestRoad(savedAddress.road_point);
      }
    }
  }, [savedAddress, setPolyline, setSelectedRoadPoint, setNearestRoad]);

  // hydrate context: do not call setState synchronously outside handlers
  const hydrateContext = useCallback(
    async (point) => {
      if (!point) return;
      setReferencePoint(point);
      setNearbyRoads([]); // Clear previous roads immediately
      setSelectedRoadPath(null); // Clear selection
      setStatus('Scanning nearby roads...');

      try {
        const roads = await fetchNearbyRoads(point.lat, point.lng, 100);
        // Backend now handles the logic and filtering properly
        setNearbyRoads(roads);
        setStatus('Roads visible. Tap a road segment to begin.');
      } catch (err) {
        console.error(err);
        setStatus('Unable to fetch nearby roads.');
      }

      try {
        const results = await nearbyAddresses(point.lat, point.lng, 100);
        setNearbyAddresses(results || []);
      } catch (err) {
        console.error(err);
      }
    },
    [setNearbyAddresses, setReferencePoint, setNearbyRoads]
  );

  // location handler (user action)
  const handleFindMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const userPoint = { lat, lng };
        setUserLocation(userPoint);
        panTo(userPoint);
        await hydrateContext(userPoint);
        setLocating(false);
      },
      (err) => {
        setStatus(`Location error: ${err.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, [hydrateContext, panTo, setUserLocation]);

  // drawing handlers
  const handleMapClick = (event) => {
    const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };

    if (drawing) {
      // Ensure we have a road start point
      if (!selectedRoadPoint) {
        setStatus('Please select a road segment first.');
        return;
      }

      // If polyline is empty, start with the road point, then add the clicked point
      setPolyline((prev) => {
        if (!prev || prev.length === 0) {
          return [selectedRoadPoint, point];
        }
        return [...prev, point];
      });
    } else {
      // Set reference point
      setReferencePoint(point);
      hydrateContext(point);
      panTo(point);
    }
  };

  const handleSelectRoad = useCallback(
    (point, roadSegment = null) => {
      // Check if point is within 100m of referencePoint is now less critical as backend filters,
      // but keeping it for sanity if needed. 
      // Actually, user explicitly said "Remove clipPath logic".

      setSelectedRoadPoint(point);
      if (roadSegment) {
        setSelectedRoadPath(roadSegment);
      }

      setPolyline((prev) => {
        if (!prev || prev.length === 0) return [point];
        const rest = prev.slice(1);
        return [point, ...rest];
      });
      setStatus('Road anchor locked. Tap "Draw route" to continue.');
      panTo(point, 20);
    },
    [setSelectedRoadPoint, setPolyline, panTo]
  );

  const handleToggleDrawing = useCallback(() => {
    if (!selectedRoadPoint && !nearestRoadPoint) {
      setStatus('Select the highlighted road anchor before drawing.');
      return;
    }
    if (!selectedRoadPoint && nearestRoadPoint) handleSelectRoad(nearestRoadPoint);
    setDrawing((prev) => {
      const next = !prev;
      setStatus(next ? 'Drawing enabled - tap inside your lane.' : 'Drawing paused.');
      return next;
    });
  }, [selectedRoadPoint, nearestRoadPoint, handleSelectRoad, setDrawing]);

  const handleSmoothRoute = useCallback(() => {
    if (!polyline || polyline.length < 3) {
      setStatus('Add at least three points before smoothing the route.');
      return;
    }
    setPolyline((prev) => chaikinSmooth(prev, 2));
    setStatus('Route smoothened for a cleaner delivery overlay.');
  }, [polyline, setPolyline]);

  const handleUndo = useCallback(() => {
    if (!polyline || polyline.length === 0) return;
    setPolyline((prev) => prev.slice(0, -1));
  }, [polyline, setPolyline]);

  const handleClear = useCallback(() => {
    setPolyline([]);
    setSelectedRoadPoint(null);
    setSelectedRoadPath(null);
    setNearestRoad(null);
    setDrawing(false);
    setReferencePoint(null);
    setNearbyRoads([]);
    if (typeof setDuplicates === 'function') setDuplicates([]);
    setStatus('Tap "Find my location" or tap the map to start.');
  }, [setPolyline, setSelectedRoadPoint, setNearestRoad, setDrawing, setDuplicates]);

  const handleMapTypeToggle = useCallback(() => {
    setMapType((prev) => (prev === 'hybrid' ? 'roadmap' : 'hybrid'));
  }, []);

  const handleFocusAddress = useCallback((addr) => {
    if (!addr || !addr.destination_point) return;
    panTo(addr.destination_point, 20);

    // Show the route if available
    if (addr.polyline_smoothed && addr.polyline_smoothed.length > 0) {
      setPolyline(addr.polyline_smoothed);

      // Also set the road point if available
      if (addr.road_point) {
        setSelectedRoadPoint(addr.road_point);
        setNearestRoad(addr.road_point);
      }

      // Fit bounds to show the whole route
      if (mapRef.current && window.google) {
        const bounds = new window.google.maps.LatLngBounds();
        addr.polyline_smoothed.forEach(point => bounds.extend(point));
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [panTo, setPolyline, setSelectedRoadPoint, setNearestRoad]);

  if (loadError) {
    return <div className="map-card">Unable to load Google Maps. Check your API key.</div>;
  }

  if (!isLoaded) {
    return <div className="map-card">Loading satellite tiles...</div>;
  }

  const googleMaps = typeof window !== 'undefined' ? window.google?.maps : undefined;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GoogleMap
        onLoad={onMapLoad}
        onClick={handleMapClick}
        mapContainerStyle={mapContainerStyle}
        center={userLocation || defaultCenter}
        zoom={userLocation ? 18 : 13}
        options={mapOptions}
        mapTypeId={mapType}
      >
        {userLocation && (
          <Marker
            position={userLocation}
            label={{ text: 'You', color: '#fff', fontWeight: '700' }}
            icon={{
              path: googleMaps?.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: '#4C6FFF', // Primary Accent
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 2
            }}
          />
        )}

        {referencePoint && (
          <Circle
            center={referencePoint}
            radius={100}
            options={{
              fillColor: '#4C6FFF', // Primary Accent
              fillOpacity: 0.1,
              strokeColor: '#4C6FFF', // Primary Accent
              strokeOpacity: 0.3,
              strokeWeight: 1,
              zIndex: 1,
              clickable: false
            }}
          />
        )}

        {/* Render Invisible Hit Targets */}
        <RoadDetection roads={nearbyRoads} onSelectRoad={handleSelectRoad} />

        {/* Render Selected Road Visibly */}
        {selectedRoadPath && (
          <Polyline
            path={selectedRoadPath}
            options={{
              strokeColor: '#1976D2',
              strokeWeight: 6,
              strokeOpacity: 1,
              zIndex: 10
            }}
          />
        )}

        {selectedRoadPoint && (
          <Marker
            position={selectedRoadPoint}
            label={{ text: 'Start', color: '#fff', fontWeight: '700' }}
            icon={{
              path: googleMaps?.SymbolPath.BACKWARD_OPEN_ARROW,
              scale: 5,
              fillColor: '#2EC4B6', // Secondary Accent (Mint)
              fillOpacity: 1,
              strokeColor: '#0D1B2A', // Contrast Base
              strokeWeight: 1.5
            }}
            draggable
            onDragEnd={(e) => handleSelectRoad({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
          />
        )}

        <DrawingLayer nearbyRoads={nearbyRoads} onSelectRoad={handleSelectRoad} />

        {nearbyList && nearbyList.map((addr, index) => (
          <Marker
            key={addr.id || addr._id || index}
            position={addr.destination_point}
            title={addr.official_address || addr.code}
            label={{
              text: addr.code,
              color: '#000',
              fontSize: '11px',
              fontWeight: '600',
              className: 'map-marker-label'
            }}
            icon={{
              path: googleMaps?.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: '#FFD700', // Gold/Yellow for saved addresses
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2
            }}
            onClick={() => handleFocusAddress(addr)}
          />
        ))}
        {/* Street View Integration */}
        <StreetViewPanorama
          visible={useStore.getState().streetView.visible}
          position={useStore.getState().streetView.position || userLocation}
          options={{
            pov: useStore.getState().streetView.pov,
            visible: useStore.getState().streetView.visible,
            motionTracking: false,
            motionTrackingControl: false,
            addressControl: false,
            fullscreenControl: false
          }}
          onLoad={(pano) => { streetViewRef.current = pano; }}
          onCloseclick={() => useStore.getState().setStreetView({ visible: false })}
        />

        {/* Viewfinder Overlay - Visible ONLY during Cropping (Inside Map to overlay SV) */}
        {useStore.getState().streetView.visible && isCropping && (
          <div className="viewfinder-overlay">
            <div className="viewfinder-box" ref={viewfinderRef}></div>
          </div>
        )}
      </GoogleMap>

      {/* Map Overlays Container (Interactive UI Layers) */}
      <div className="map-overlay">
        {/* 1. Context Hint (Top Center) */}
        <div className="context-hint" style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px 16px', borderRadius: 20,
          fontSize: '13px', fontWeight: '500', pointerEvents: 'none', whiteSpace: 'nowrap',
          zIndex: 50, transition: 'opacity 0.3s',
          opacity: (useStore.getState().streetView.visible || drawing || !selectedRoadPoint) ? 1 : 0
        }}>
          {useStore.getState().streetView.visible
            ? (isCropping ? "Resize box to frame house -> Click Save" : "Pan & Zoom to view house -> Click Crop")
            : (drawing
              ? "Tap road to extend path -> Click Save"
              : (!selectedRoadPoint ? "Tap a road segment to begin" : "Check form details"))
          }
        </div>

        {/* 2. Map Tools (Bottom Left) - Hidden during Street View */}
        {!useStore.getState().streetView.visible && (
          <div className="glass-overlay">
            <h4>Doorstep route</h4>
            <p>
              1) Locate yourself, 2) tap the road, 3) draw the lane exactly the way riders should follow it.
            </p>
            <div className="map-tools">
              <button className={`pill ${drawing ? 'active' : ''}`} onClick={handleToggleDrawing} title="Draw Route">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path></svg>
              </button>
              <button className="pill" onClick={handleSmoothRoute} disabled={!polyline || polyline.length < 3} title="Smooth Route">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12c3-4 6-7 9-7s9 5 9 12"></path></svg>
              </button>
              <button className="pill" onClick={handleUndo} disabled={!polyline || polyline.length === 0} title="Undo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"></path></svg>
              </button>
              <button className="pill" onClick={handleClear} disabled={!polyline.length && !selectedRoadPoint} title="Reset">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
              </button>
            </div>
            <div className="map-status">
              <span className="ok">{formatDistance(routeDistance)}</span>
              <span className="warn">{polyline ? polyline.length : 0} pts</span>
              <span className="warn">{routeReady ? 'Route ready' : 'Pending'}</span>
            </div>
            <p style={{ marginTop: 10 }}>{status}</p>
            {savedAddress && (
              <div className="map-status">
                <span className="ok">Saved as {savedAddress.code}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="floating-actions">
        <button className="primary" onClick={handleFindMyLocation} disabled={locating} title="Find My Location">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg>
        </button>
        <button onClick={handleMapTypeToggle} title="Switch Map View">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
        </button>
        {useStore.getState().streetView.visible && (
          <>
            {/* Mode 1: View Open, deciding to Crop */}
            {!isCropping && (
              <>
                <button className="action-btn" onClick={() => setIsCropping(true)} title="Crop / Adjust Frame" style={{ background: '#FF9800', color: 'white', marginTop: 10 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path>
                    <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path>
                  </svg>
                </button>
                <button className="action-btn danger" onClick={() => useStore.getState().setStreetView({ visible: false })} title="Exit" style={{ background: '#d32f2f', color: 'white', marginTop: 10 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </>
            )}

            {/* Mode 2: Cropping Active */}
            {isCropping && (
              <>
                <button className="action-btn success" onClick={handleCaptureStreetView} title="Save / Snap" style={{ background: '#2e7d32', color: 'white', marginTop: 10 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <button className="action-btn danger" onClick={() => setIsCropping(false)} title="Cancel Crop" style={{ background: '#757575', color: 'white', marginTop: 10 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5"></path><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"></path></svg>
                </button>
              </>
            )}
          </>
        )}
      </div>

      {nearbyList && nearbyList.length > 0 && (
        <div className="nearby-strip">
          {nearbyList.map((addr, index) => (
            <div key={`card-${addr.id || addr._id || addr.code}-${index}`} className="nearby-chip" onClick={() => handleFocusAddress(addr)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{addr.code}</strong>
                <span style={{ fontSize: '10px', background: '#EFF6FF', color: '#3B82F6', padding: '2px 6px', borderRadius: '4px' }}>
                  {addr.type === 'apartment' ? 'Apt' : 'House'}
                </span>
              </div>
              <div className="muted">
                {addr.official_address || 'No address details available'}
              </div>
              <div className="meta">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                View Route
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}