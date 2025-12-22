import React from 'react';
import { Polyline, Marker } from '@react-google-maps/api';
import { useStore } from './useStore';

export default function DrawingLayer({ nearbyRoads, onSelectRoad }) {
  const polyline = useStore((s) => s.polyline);

  return (
    <>
      {/* Render Nearby Roads for Selection */}
      {nearbyRoads && nearbyRoads.map((road, index) => (
        <Polyline
          key={index}
          path={road}
          options={{
            strokeColor: '#3B82F6', // Blue for selectable roads
            strokeWeight: 6,
            strokeOpacity: 0.6,
            clickable: true,
            zIndex: 50
          }}
          onClick={(e) => {
            // Find closest point on this segment
            const clickedLat = e.latLng.lat();
            const clickedLng = e.latLng.lng();
            // Simple approximation: just take the first point of the segment or the clicked location
            // Ideally we project point to segment, but for now:
            onSelectRoad({ lat: clickedLat, lng: clickedLng });
          }}
        />
      ))}

      {/* Main Route Polyline */}
      {polyline && polyline.length > 0 && (
        <>
          <Polyline
            path={polyline}
            options={{
              strokeColor: '#ff6b00',
              strokeWeight: 4,
              clickable: false,
              geodesic: true,
              zIndex: 100
            }}
          />
          <Marker position={polyline[polyline.length - 1]} label="D" />
        </>
      )}
    </>
  );
}