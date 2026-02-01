
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GoogleMap, Marker, Polyline, OverlayView } from '@react-google-maps/api';
import { useStore } from './useStore';
import RoadDetection from './RoadDetection';
import { nearbyAddresses, fetchNearbyRoads } from './api';
import { pathDistanceMeters, snapPointToPolyline, computeHeading } from './PolylineUtils';

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 28.6139, lng: 77.209 };
const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  fullscreenControl: false,
  mapTypeControl: false,
  streetViewControl: false
};

const hotspotMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
  { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#373737" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3c3c3c" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

export default function MapScreen({ isLoaded, loadError, showHotspots, onHotspotClick }) {
  const mapRef = useRef(null);

  // Global Store
  const mapType = useStore((s) => s.mapType);
  const setMapType = useStore((s) => s.setMapType);
  const drawing = useStore((s) => s.drawing);
  const waypoints = useStore((s) => s.waypoints);
  const setWaypoints = useStore((s) => s.setWaypoints);
  const savedAddress = useStore((s) => s.savedAddress);

  // Locating Trigger
  const triggerLocate = useStore((s) => s.triggerLocate);
  const setTriggerLocate = useStore((s) => s.setTriggerLocate);

  // Other Store Selectors
  const userLocation = useStore((s) => s.userLocation);
  const setUserLocation = useStore((s) => s.setUserLocation);
  const polyline = useStore((s) => s.polyline);
  const polylineSegments = useStore((s) => s.polylineSegments);
  const focusPoint = useStore((s) => s.focusPoint);
  const currentMode = useStore((s) => s.currentMode); // Subscribe to mode

  // Local State
  const [locating, setLocating] = useState(false);
  const [referencePoint, setReferencePoint] = useState(null);
  const [nearbyRoads, setNearbyRoads] = useState([]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    if (mapType) map.setMapTypeId(mapType);

    // FIX: If we already have a focus point (e.g. from Search), pan to it immediately
    // This fixes the 'Someone Else' flow where the map didn't center correctly
    // FIX: If we already have a focus point (e.g. from Search), pan to it immediately
    // BUT only if we are NOT in hotspot mode
    const currentFocus = useStore.getState().focusPoint;
    if (currentFocus && !showHotspots) {
      map.panTo(currentFocus);
      map.setZoom(20);
    }

    // Explicitly handle Hotspot Init on Load
    if (showHotspots) {
      map.setZoom(5);
      map.setCenter({ lat: 20.5937, lng: 78.9629 });
      map.setMapTypeId('roadmap');
    }
  }, [mapType, showHotspots]);

  useEffect(() => {
    if (mapRef.current) mapRef.current.setMapTypeId(mapType);

    // Hotspot Mode Init
    if (showHotspots && mapRef.current) {
      mapRef.current.setZoom(5);
      mapRef.current.setCenter({ lat: 20.5937, lng: 78.9629 }); // Center of India
      mapRef.current.setMapTypeId('roadmap');
    }
  }, [mapType, showHotspots]);

  // Auto-Zoom on Drawing
  useEffect(() => {
    if (drawing && mapRef.current) {
      mapRef.current.setZoom(21);
      mapRef.current.setMapTypeId('hybrid');
    }
  }, [drawing]);

  const panTo = useCallback((point, zoom = 19) => {
    if (!point || !mapRef.current) return;
    try {
      mapRef.current.panTo(point);
      mapRef.current.setZoom(zoom);
    } catch (e) {
      console.error('Pan error:', e);
    }
  }, []);

  // Hydrate context (nearby roads/addresses)
  const hydrateContext = useCallback(async (point) => {
    if (!point) return;
    setReferencePoint(point);
    try {
      const roads = await fetchNearbyRoads(point.lat, point.lng);
      setNearbyRoads(roads || []);
    } catch (err) {
      console.error('Failed to fetch roads', err);
    }
  }, [setReferencePoint]);

  // Location Handler
  const handleFindMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(pt);
        panTo(pt);
        hydrateContext(pt); // <--- Auto-fetch roads around user
        setLocating(false);
      },
      (err) => {
        console.error(err);
        setLocating(false);
      },
      { enableHighAccuracy: true }
    );
  }, [panTo, setUserLocation, hydrateContext]);

  // Trigger Listener
  useEffect(() => {
    if (triggerLocate) {
      handleFindMyLocation();
      setTriggerLocate(false);
    }
  }, [triggerLocate, handleFindMyLocation, setTriggerLocate]);

  // Focus Point Listener
  useEffect(() => {
    if (focusPoint && !showHotspots) panTo(focusPoint, 20);
  }, [focusPoint, panTo, showHotspots]);

  // Map Click - Dot Placement Logic
  const handleMapClick = (event) => {
    const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };

    if (drawing) {
      // 1. ALWAYS Highlight roads around the click immediately
      hydrateContext(point);

      // 2. Smart Zoom: Ensure user is at MAX zoom before allowing dot placement
      const currentZoom = mapRef.current ? mapRef.current.getZoom() : 0;

      if (currentZoom < 20) {
        panTo(point, 22); // Zoom to MAX (22)
        return; // Stop here. User must click again to place dot.
      }

      // 3. Place Dot
      let finalPoint = point;

      // START DOT SNAP: If it's the first dot, try to snap to a nearby blue road
      if (waypoints.length === 0 && nearbyRoads.length > 0) {
        let bestSnap = null;
        let bestDistSq = Infinity;

        nearbyRoads.forEach(road => {
          try {
            const snap = snapPointToPolyline(point, road);
            if (snap) {
              const dx = snap.lat - point.lat;
              const dy = snap.lng - point.lng;
              const dSq = dx * dx + dy * dy;
              if (dSq < bestDistSq) {
                bestDistSq = dSq;
                bestSnap = snap;
              }
            }
          } catch (err) {
            console.warn("Snap calc failed for a road seg", err);
          }
        });

        // If we found a snap point within reasonable distance (approx ~30-40m in latlng degrees)
        if (bestSnap && bestDistSq < 0.000001) {
          finalPoint = bestSnap;
          console.log('Snapped Start Point to Road');
        }
      }

      setWaypoints(prev => [...prev, finalPoint]);
    } else {
      // Normal mode (selecting saved addresses etc)
      setReferencePoint(point);
      hydrateContext(point);
    }
  };

  if (loadError) return <div>Map Error</div>;
  if (!isLoaded) return <div>Loading Map...</div>;

  const getSymbolPath = () => {
    return window.google && window.google.maps && window.google.maps.SymbolPath ? window.google.maps.SymbolPath.CIRCLE : undefined;
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* View Toggle Overlay (Map Style) */}
      {savedAddress && (
        <div style={{ position: 'absolute', top: 20, right: 60, zIndex: 50, background: 'rgba(255,255,255,0.9)', padding: 4, borderRadius: 24, display: 'flex', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <div
            onClick={() => setMapType('hybrid')}
            style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: mapType === 'hybrid' ? '#1e293b' : 'transparent',
              color: mapType === 'hybrid' ? 'white' : '#64748b',
              transition: 'all 0.2s ease'
            }}
          >
            Satellite 🛰️
          </div>
          <div
            onClick={() => setMapType('roadmap')}
            style={{
              padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: (!mapType || mapType === 'roadmap') ? '#1e293b' : 'transparent',
              color: (!mapType || mapType === 'roadmap') ? 'white' : '#64748b',
              transition: 'all 0.2s ease'
            }}
          >
            Default 🗺
          </div>
        </div>
      )}


      <GoogleMap
        onLoad={onMapLoad}
        onClick={handleMapClick}
        mapContainerStyle={mapContainerStyle}
        center={userLocation || defaultCenter}
        zoom={18}
        options={showHotspots ? { ...mapOptions, styles: hotspotMapStyle } : mapOptions}
      >
        {/* Street View Removed - Satellite Toggle handles MapType */}
        {/* Render Detected Roads (Radius) */}
        <RoadDetection
          roads={nearbyRoads}
          onSelectRoad={(anchor) => {
            // If user clicks explicitly on the blue line, use that point
            if (drawing) {
              setWaypoints(prev => [...prev, anchor]);
            }
          }}
        />

        {/* Generated Polyline (Multi-mode) */}
        {/* Generated Polyline (Multi-mode) */}
        {polylineSegments.length > 0 ? (
          polylineSegments.map((seg, i) => {
            let color = '#4285F4'; // Default (Car)
            if (seg.mode === 'walking') color = '#00E5FF'; // Cyan
            if (seg.mode === 'bike') color = '#FFFF00'; // Yellow
            if (seg.mode === 'car') color = '#4285F4'; // Blue

            return (
              <Polyline
                key={i}
                path={seg.points}
                options={{
                  strokeColor: color,
                  strokeOpacity: 1.0,
                  strokeWeight: 4,
                  icons: seg.mode === 'walking' ? [{
                    icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 }, // Smaller dashes
                    offset: '0', repeat: '16px'
                  }] : undefined
                }}
              />
            );
          })
        ) : (
          // Fallback to simple polyline if segments missing
          polyline.length > 0 && (
            <Polyline
              path={polyline}
              options={{
                strokeColor: '#4285F4',
                strokeOpacity: 1.0,
                strokeWeight: 4,
              }}
            />
          )
        )}

        {/* Waypoint Dots (Trail) */}
        {waypoints.slice(0, waypoints.length - 1).map((pt, i) => (
          <Marker
            key={i}
            position={pt}
            icon={{
              path: getSymbolPath(),
              scale: 4,
              fillColor: '#FF5722',
              fillOpacity: 0.8,
              strokeWeight: 1,
              strokeColor: 'white',
            }}
          />
        ))}

        {/* Animated Head Marker (OverlayView) */}
        {waypoints.length > 0 && (
          (() => {
            const pt = waypoints[waypoints.length - 1];

            // Calculate Heading
            let heading = 0;
            if (waypoints.length > 1) {
              heading = computeHeading(waypoints[waypoints.length - 2], pt);
            } else if (userLocation) {
              heading = 0;
            }

            // Icons Config
            const isCar = currentMode === 'car';
            const rotation = isCar ? heading + 90 : 0;
            const color = isCar ? '#4285F4' : currentMode === 'bike' ? '#FFFF00' : '#00E5FF';

            // Icons
            const carPath = "M12 2a3 3 0 0 0-3 3v1h-1a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h1v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2h4v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2h1a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1V5a3 3 0 0 0-3-3zM9 8h6v8H9z";
            const bikePath = "M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1.2-.4-1.6 0l-4.2 4.2 3.2 3.2c.8.8 1.2 1.8 1.2 2.9h1.5c0-1.4-.6-2.8-1.7-3.8l-1.2-1.2z";
            const walkPath = "M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-4.3c-.3-1.2-1.4-2.1-2.7-2.1H6.8c-1.7 0-3 1.3-3 3v4h2v-4h3l.7 3 2.3 2.3z";

            const path = isCar ? carPath : currentMode === 'bike' ? bikePath : walkPath;

            const emoji = currentMode === 'walking' ? '🚶' : currentMode === 'bike' ? '🚴' : '🚗';

            return (
              <OverlayView
                position={pt}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                getPixelPositionOffset={(x, y) => ({ x: -15, y: -15 })}
              >
                <div className={`marker-icon ${currentMode}`} style={{
                  fontSize: '24px',
                  transform: `rotate(${rotation}deg)`,
                  transition: 'transform 0.3s',
                  filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
                  lineHeight: 1,
                  marginTop: '-2px'
                }}>
                  {emoji}
                </div>
              </OverlayView>
            );
          })()
        )}

        {/* User Location */}
        {userLocation && (
          <Marker
            position={userLocation}
            icon={{
              path: window.google?.maps?.SymbolPath?.CIRCLE,
              scale: 8,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: 'white',
            }}
          />
        )}

        {/* Saved Address Marker (View Mode) */}
        {savedAddress && (savedAddress.destination_point || savedAddress.location) && !showHotspots && (
          <Marker
            position={{
              lat: savedAddress.destination_point?.coordinates ? savedAddress.destination_point.coordinates[1] : savedAddress.location.lat,
              lng: savedAddress.destination_point?.coordinates ? savedAddress.destination_point.coordinates[0] : savedAddress.location.lng
            }}
            animation={window.google?.maps?.Animation?.DROP}
            label={{
              text: "HOME",
              color: "white",
              fontWeight: "bold",
              fontSize: "12px",
              className: "home-label"
            }}
            icon={{
              path: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z", // Simple Home SVG path
              fillColor: '#E91E63', // Pink/Red distinct from generic pins
              fillOpacity: 1,
              strokeWeight: 1,
              strokeColor: '#ffffff',
              scale: 1.5,
              anchor: new window.google.maps.Point(12, 12)
            }}
          />
        )}

        {/* Hotspots Render */}
        {showHotspots && Object.values(useStore.getState().createdAddressesMap).map((item) => {
          const addr = item.address;
          let lat, lng;
          if (addr.destination_point?.coordinates) {
            lat = addr.destination_point.coordinates[1];
            lng = addr.destination_point.coordinates[0];
          } else if (addr.destination_point?.lat) {
            lat = addr.destination_point.lat;
            lng = addr.destination_point.lng;
          } else if (addr.polylineOptimized?.length > 0) {
            lat = addr.polylineOptimized[addr.polylineOptimized.length - 1].lat;
            lng = addr.polylineOptimized[addr.polylineOptimized.length - 1].lng;
          }

          if (!lat || !lng) return null;

          return (
            <OverlayView
              key={addr.smartAddressCode}
              position={{ lat, lng }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              getPixelPositionOffset={(x, y) => ({ x: -10, y: -10 })}
            >
              <div
                className="hotspot-marker"
                onClick={(e) => {
                  e.stopPropagation();
                  onHotspotClick && onHotspotClick(addr.smartAddressCode, mapRef.current ? mapRef.current.getZoom() : 5);
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="hotspot-ring"></div>
                <div className="hotspot-dot"></div>
              </div>
            </OverlayView>
          );
        })}
      </GoogleMap>

      {/* Overlay Status */}
      <div className="map-overlay" style={{ pointerEvents: 'none' }}>
        {/* Add any floating status text here if needed */}
      </div>
    </div>
  );
}