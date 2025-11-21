import React from 'react';
import { Marker, Circle } from '@react-google-maps/api';
import { useStore } from './useStore';

export default function RoadDetection({ onSelectRoad }) {
  const nearestRoad = useStore((s) => s.nearestRoad);

  if (!nearestRoad) return null;

  return (
    <>
      <Circle
        center={nearestRoad}
        radius={15}
        options={{
          fillColor: '#1976D2',
          fillOpacity: 0.4,
          strokeColor: '#1976D2',
          strokeWeight: 3,
          strokeOpacity: 1,
          zIndex: 10,
          clickable: true
        }}
        onClick={() => onSelectRoad(nearestRoad)}
      />
      <Marker
        position={nearestRoad}
        label={{ text: 'ROAD', color: '#fff', fontWeight: '700', fontSize: '11px' }}
        icon={{
          path: 'M0,0 L0,-10 L-5,-15 L5,-15 Z',
          fillColor: '#1976D2',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          scale: 1.2,
          anchor: window.google?.maps ? new window.google.maps.Point(0, 0) : undefined
        }}
        onClick={() => onSelectRoad(nearestRoad)}
      />
    </>
  );
}