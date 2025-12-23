import React, { useState, useEffect } from 'react';
import { Polyline } from '@react-google-maps/api';
import { snapPointToPolyline } from './PolylineUtils';

const SmartRoad = ({ segment, onSelectRoad }) => {
  // segment is now a clean polyline from backend directions API
  // No need for client-side DirectionService calls or clipping logic as backend handles 150m radius search

  if (!segment || segment.length < 2) return null;

  return (
    <Polyline
      path={segment}
      options={{
        strokeColor: '#000000', // Color doesn't matter much if opacity is 0, but useful for debug
        strokeOpacity: 0,       // Invisible
        strokeWeight: 22,       // Wide hit area
        zIndex: 5,
        clickable: true
      }}
      onClick={(e) => {
        const anchor = snapPointToPolyline(e.latLng, segment);
        if (anchor) {
          onSelectRoad(anchor, segment);
        }
      }}
    />
  );
};

export default function RoadDetection({ roads, onSelectRoad }) {
  if (!roads || roads.length === 0) return null;

  return (
    <>
      {roads.map((road, index) => (
        <SmartRoad
          key={`road-${index}`}
          segment={road}
          onSelectRoad={onSelectRoad}
        />
      ))}
    </>
  );
}