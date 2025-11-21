import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, useLoadScript, Marker, Circle } from '@react-google-maps/api';
import { useStore } from './useStore';
import DrawingLayer from './DrawingLayer';
import RoadDetection from './RoadDetection';
import { nearestRoad, nearbyAddresses } from './api';
import { chaikinSmooth, pathDistanceMeters, formatDistance } from './PolylineUtils';

const libraries = ['places'];
const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 28.6139, lng: 77.209 };
const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  fullscreenControl: false,
  mapTypeControl: false,
  streetViewControl: false
};

export default function MapScreen() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries
  });

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

  // derived
  const routeDistance = useMemo(() => pathDistanceMeters(polyline), [polyline]);
  const routeReady = Boolean(selectedRoadPoint && polyline && polyline.length >= 2);

  // safe pan helper (no state changes)
  const panTo = useCallback((point, zoom = 19) => {
    if (!point || !mapRef.current) return;
    mapRef.current.panTo(point);
    mapRef.current.setZoom(zoom);
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
      if (savedAddress.road_point) {
        setSelectedRoadPoint(savedAddress.road_point);
        setNearestRoad(savedAddress.road_point);
      }
      if (savedAddress.destination_point) {
        panTo(savedAddress.destination_point, 20);
      }
    }
  }, [savedAddress, setPolyline, setSelectedRoadPoint, setNearestRoad, panTo]);

  // hydrate context: do not call setState synchronously outside handlers
  const hydrateContext = useCallback(
    async (point) => {
      if (!point) return;
      setStatus('Scanning nearest labelled road...');
      try {
        const road = await nearestRoad(point.lat, point.lng);
        if (road) {
          setNearestRoad(road);
          setStatus('Road anchor found. Tap it or drag the start marker to lock it in.');
        }
      } catch (err) {
        console.error(err);
        setStatus('Unable to fetch nearest road. You can still place the start point manually.');
      }

      try {
        const results = await nearbyAddresses(point.lat, point.lng, 80);
        setNearbyAddresses(results || []);
      } catch (err) {
        console.error(err);
      }
    },
    [setNearestRoad, setNearbyAddresses]
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
    if (!drawing) return;
    
    // Ensure we have a road start point
    if (!selectedRoadPoint && !nearestRoadPoint) {
      setStatus('Please select the highlighted road first before drawing.');
      return;
    }

    const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
    
    // If polyline is empty, start with the road point, then add the clicked point
    setPolyline((prev) => {
      if (!prev || prev.length === 0) {
        const start = selectedRoadPoint || nearestRoadPoint;
        return start ? [start, point] : [point];
      }
      return [...prev, point];
    });
  };

  const handleSelectRoad = useCallback(
    (point) => {
      setSelectedRoadPoint(point);
      setPolyline((prev) => {
        if (!prev || prev.length === 0) return [point];
        const rest = prev.slice(1);
        return [point, ...rest];
      });
      setStatus('Road anchor locked. Continue drawing towards your door.');
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
    setNearestRoad(null);
    setDrawing(false);
    if (typeof setDuplicates === 'function') setDuplicates([]);
    setStatus('Route cleared. Start fresh by selecting the road anchor.');
  }, [setPolyline, setSelectedRoadPoint, setNearestRoad, setDrawing, setDuplicates]);

  const handleMapTypeToggle = useCallback(() => {
    setMapType((prev) => (prev === 'hybrid' ? 'roadmap' : 'hybrid'));
  }, []);

  const handleFocusAddress = useCallback((point) => {
    if (!point) return;
    panTo(point, 20);
  }, [panTo]);

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
                fillColor: '#3772ff',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2
              }}
            />
            <Circle
              center={userLocation}
              radius={60}
              options={{ fillColor: '#3772ff1a', strokeColor: '#3772ff', strokeOpacity: 0.4, strokeWeight: 1, zIndex: 1 }}
            />
          </>
        )}

        <RoadDetection onSelectRoad={handleSelectRoad} />

        {selectedRoadPoint && (
          <Marker
            position={selectedRoadPoint}
            label={{ text: 'Start', color: '#fff', fontWeight: '700' }}
            icon={{
              path: googleMaps?.SymbolPath.BACKWARD_OPEN_ARROW,
              scale: 5,
              fillColor: '#00d1b2',
              fillOpacity: 1,
              strokeColor: '#003a2f',
              strokeWeight: 1.5
            }}
            draggable
            onDragEnd={(e) => handleSelectRoad({ lat: e.latLng.lat(), lng: e.latLng.lng() })}
          />
        )}

        <DrawingLayer />
      </GoogleMap>

      <div className="map-overlay">
        <div className="map-card">
          <h4>Doorstep route</h4>
          <p>
            1) Locate yourself, 2) tap the highlighted road, 3) draw the lane exactly the way riders should follow it.
          </p>
          <div className="map-tools">
            <button className={`pill ${drawing ? 'active' : ''}`} onClick={handleToggleDrawing}>
              {drawing ? 'Drawing...' : 'Draw route'}
            </button>
            <button className="pill" onClick={handleSmoothRoute} disabled={!polyline || polyline.length < 3}>
              Smooth
            </button>
            <button className="pill" onClick={handleUndo} disabled={!polyline || polyline.length === 0}>
              Undo
            </button>
            <button className="pill" onClick={handleClear} disabled={!polyline.length && !selectedRoadPoint}>
              Reset
            </button>
          </div>
          <div className="map-status">
            <span className="ok">{formatDistance(routeDistance)}</span>
            <span className="warn">{polyline ? polyline.length : 0} pts</span>
            <span className="warn">{routeReady ? 'Route ready to save' : 'Awaiting route'}</span>
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
        <button className="primary" onClick={handleFindMyLocation} disabled={locating}>
          {locating ? 'Locating...' : 'Find my location'}
        </button>
        <button onClick={handleMapTypeToggle}>{mapType === 'hybrid' ? 'Switch to map view' : 'Switch to satellite'}</button>
      </div>

      {nearbyList && nearbyList.length > 0 && (
        <div className="nearby-strip">
          {nearbyList.map((addr) => (
            <div key={addr.id || addr._id} className="nearby-chip" onClick={() => handleFocusAddress(addr.destination_point)}>
              <strong>{addr.official_address || addr.code}</strong>
              <div className="muted">{addr.code}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}