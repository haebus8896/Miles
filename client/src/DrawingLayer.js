import React from 'react';
import { Polyline, Marker } from '@react-google-maps/api';
import { useStore } from './useStore';

export default function DrawingLayer() {
  const polyline = useStore((s) => s.polyline);

  if (!polyline || polyline.length === 0) return null;

  return (
    <>
      <Polyline
        path={polyline}
        options={{
          strokeColor: '#ff6b00',
          strokeWeight: 4,
          clickable: false,
          geodesic: true
        }}
      />
      <Marker position={polyline[polyline.length - 1]} label="D" />
    </>
  );
}