import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

// Haversine formula to calculate the distance between two points in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

const MapRuler = ({ mapInstance, mapInstanceRight, isCompareMode, isActive, onClose }) => {
  const pointsRef = useRef([]);
  const cumulativeDistanceRef = useRef(0);

  const hoverPointRef = useRef(null);

  // Clean up features
  const removeRulerLayers = useCallback((map) => {
    if (!map) return;
    try {
      if (map.getLayer('ruler-label')) map.removeLayer('ruler-label');
      if (map.getLayer('ruler-line')) map.removeLayer('ruler-line');
      if (map.getLayer('ruler-points')) map.removeLayer('ruler-points');
      if (map.getSource('ruler-source')) map.removeSource('ruler-source');
    } catch (e) {
      // ignore
    }
  }, []);

  const addOrUpdateRulerSource = useCallback((map, currentPoints, hoverPoint, distanceLabelText = '') => {
    if (!map || !map.getStyle()) return;

    const coords = currentPoints.map(p => [p.lng, p.lat]);
    // Only apply hover if we haven't finalized the second point yet
    if (hoverPoint && currentPoints.length === 1) {
      coords.push([hoverPoint.lng, hoverPoint.lat]);
    }

    const features = [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords
        }
      },
      ...coords.map(coord => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: coord
        }
      }))
    ];

    if (coords.length > 1 && distanceLabelText) {
       const pt1 = coords[0];
       const pt2 = coords[coords.length - 1];
       const midLng = (pt1[0] + pt2[0]) / 2;
       const midLat = (pt1[1] + pt2[1]) / 2;
       
       features.push({
           type: 'Feature',
           properties: { distanceLabel: distanceLabelText, isMidpoint: true },
           geometry: { type: 'Point', coordinates: [midLng, midLat] }
       });
    }

    const geojsonData = {
      type: 'FeatureCollection',
      features
    };

    if (map.getSource('ruler-source')) {
      map.getSource('ruler-source').setData(geojsonData);
    } else {
      if (!map.isStyleLoaded()) return;

      map.addSource('ruler-source', {
        type: 'geojson',
        data: geojsonData
      });

      const beforeId = map.getLayer('institutions-layer') ? 'institutions-layer' : undefined;

      map.addLayer({
        id: 'ruler-line',
        type: 'line',
        source: 'ruler-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#ffffff', // white
          'line-width': 3,
          'line-dasharray': [2, 2]
        }
      }, beforeId);

      map.addLayer({
        id: 'ruler-label',
        type: 'symbol',
        source: 'ruler-source',
        filter: ['has', 'distanceLabel'],
        layout: {
          'text-field': ['get', 'distanceLabel'],
          'text-font': ['Open Sans Bold'],
          'text-size': 14,
          'text-anchor': 'bottom',
          'text-offset': [0, -0.5],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': '#000000',
          'text-halo-width': 1.5
        }
      }, beforeId);

      map.addLayer({
        id: 'ruler-points',
        type: 'circle',
        source: 'ruler-source',
        filter: ['!', ['has', 'isMidpoint']],
        paint: {
          'circle-radius': 5,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 2
        }
      }, beforeId);
    }
  }, []);

  useEffect(() => {
    if (!mapInstance) return;

    const whiteCrosshairCursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>') 12 12, crosshair`;

    if (isActive) {
      mapInstance.getCanvas().style.cursor = whiteCrosshairCursor;
      if (mapInstanceRight) mapInstanceRight.getCanvas().style.cursor = whiteCrosshairCursor;

      const handleMapClick = (e) => {
         if (pointsRef.current.length >= 2) {
             return;
         }

         const newPoints = [...pointsRef.current, e.lngLat];
         let finalDist = '';
         
         if (pointsRef.current.length === 1) {
           const lastPt = pointsRef.current[0];
           const dist = calculateDistance(lastPt.lat, lastPt.lng, e.lngLat.lat, e.lngLat.lng);
           
           if (dist < 1) finalDist = `${(dist * 1000).toFixed(0)} m`;
           else finalDist = `${dist.toFixed(2)} km`;
         }
         
         if (newPoints.length === 2) {
           e.target.getCanvas().style.cursor = '';
         }
         
         pointsRef.current = newPoints;
         
         addOrUpdateRulerSource(mapInstance, newPoints, null, finalDist);
         if (isCompareMode && mapInstanceRight) addOrUpdateRulerSource(mapInstanceRight, newPoints, null, finalDist);
      };

      const handleMouseMove = (e) => {
          if (pointsRef.current.length < 2) {
             e.target.getCanvas().style.cursor = whiteCrosshairCursor;
          } else {
             e.target.getCanvas().style.cursor = '';
          }

          if (pointsRef.current.length === 1) {
            const lastPt = pointsRef.current[0];
            const dist = calculateDistance(lastPt.lat, lastPt.lng, e.lngLat.lat, e.lngLat.lng);
            
            let displayDist = "";
            if (dist < 1) {
              displayDist = `${(dist * 1000).toFixed(0)} m`;
            } else {
              displayDist = `${dist.toFixed(2)} km`;
            }

            hoverPointRef.current = e.lngLat;
            addOrUpdateRulerSource(mapInstance, pointsRef.current, e.lngLat, displayDist);
            if (isCompareMode && mapInstanceRight) addOrUpdateRulerSource(mapInstanceRight, pointsRef.current, e.lngLat, displayDist);
          }
      };

      const handleContextMenu = (e) => {
         e.preventDefault();
         // clear current measurement but stay in ruler mode
         pointsRef.current = [];
         hoverPointRef.current = null;
         
         e.target.getCanvas().style.cursor = whiteCrosshairCursor;
         
         removeRulerLayers(mapInstance);
         if (isCompareMode && mapInstanceRight) removeRulerLayers(mapInstanceRight);
      };

      mapInstance.on('click', handleMapClick);
      mapInstance.on('mousemove', handleMouseMove);
      mapInstance.on('contextmenu', handleContextMenu);
      
      if (isCompareMode && mapInstanceRight) {
        mapInstanceRight.on('click', handleMapClick);
        mapInstanceRight.on('mousemove', handleMouseMove);
        mapInstanceRight.on('contextmenu', handleContextMenu);
      }

      return () => {
        mapInstance.off('click', handleMapClick);
        mapInstance.off('mousemove', handleMouseMove);
        mapInstance.off('contextmenu', handleContextMenu);
        mapInstance.getCanvas().style.cursor = '';
        
        if (mapInstanceRight) {
           mapInstanceRight.off('click', handleMapClick);
           mapInstanceRight.off('mousemove', handleMouseMove);
           mapInstanceRight.off('contextmenu', handleContextMenu);
           mapInstanceRight.getCanvas().style.cursor = '';
        }
      };
     } else {
       // Cleanup if inactive
       pointsRef.current = [];
       
       removeRulerLayers(mapInstance);
       if (mapInstanceRight) removeRulerLayers(mapInstanceRight);
       
       if (mapInstance) mapInstance.getCanvas().style.cursor = '';
       if (mapInstanceRight) mapInstanceRight.getCanvas().style.cursor = '';
    }
  }, [isActive, mapInstance, mapInstanceRight, isCompareMode, addOrUpdateRulerSource, removeRulerLayers]);

  return null;
};

export default MapRuler;
