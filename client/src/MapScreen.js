import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, Circle, Polyline } from '@react-google-maps/api';
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
          <>
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

          </>
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
      </GoogleMap>

      <div className="map-overlay">
        <div className="glass-overlay">
          <h4>Doorstep route</h4>
          <p>
            1) Locate yourself, 2) tap the road, 3) draw the lane exactly the way riders should follow it.
          </p>
          <div className="map-tools">
            <button className={`pill ${drawing ? 'active' : ''}`} onClick={handleToggleDrawing} title="Draw Route">
              {/* Pen Icon - Clearer for "Draw" */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              </svg>
            </button>
            <button className="pill" onClick={handleSmoothRoute} disabled={!polyline || polyline.length < 3} title="Smooth Route">
              {/* Curve Icon - Clearer for "Smooth" */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12c3-4 6-7 9-7s9 5 9 12"></path>
              </svg>
            </button>
            <button className="pill" onClick={handleUndo} disabled={!polyline || polyline.length === 0} title="Undo">
              {/* Back Arrow - Standard Undo */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 14L4 9l5-5"></path>
                <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"></path>
              </svg>
            </button>
            <button className="pill" onClick={handleClear} disabled={!polyline.length && !selectedRoadPoint} title="Reset">
              {/* Refresh/X Icon - Clearer for "Reset" than Trash */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6"></path>
                <path d="M1 20v-6h6"></path>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
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
      </div>

      <div className="floating-actions">
        <button className="primary" onClick={handleFindMyLocation} disabled={locating} title="Find My Location">
          {/* Target Icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="22" y1="12" x2="18" y2="12"></line>
            <line x1="6" y1="12" x2="2" y2="12"></line>
            <line x1="12" y1="6" x2="12" y2="2"></line>
            <line x1="12" y1="22" x2="12" y2="18"></line>
          </svg>
        </button>
        <button onClick={handleMapTypeToggle} title="Switch Map View">
          {/* Layers Icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
        </button>
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