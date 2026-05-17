import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import area from '@turf/area';
import bbox from '@turf/bbox';
import { polygon } from '@turf/helpers';

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

const MapRuler = ({ mapInstance, mapInstanceRight, isCompareMode, isActive, measureType = 'distance', onClose }) => {
  const pointsRef = useRef([]);
  const hoverPointRef = useRef(null);
  const isFinalizedRef = useRef(false);

  // Clean up features
  const removeRulerLayers = useCallback((map) => {
    if (!map) return;
    try {
      if (map.getLayer('ruler-label')) map.removeLayer('ruler-label');
      if (map.getLayer('ruler-line')) map.removeLayer('ruler-line');
      if (map.getLayer('ruler-fill')) map.removeLayer('ruler-fill');
      if (map.getLayer('ruler-points')) map.removeLayer('ruler-points');
      if (map.getSource('ruler-source')) map.removeSource('ruler-source');
    } catch (e) {
      // ignore
    }
  }, []);

  const addOrUpdateRulerSource = useCallback((map, currentPoints, hoverPoint, measureMode, isFinalized) => {
    if (!map || !map.getStyle()) return;

    let coords = currentPoints.map(p => [p.lng, p.lat]);
    if (hoverPoint && (measureMode !== 'distance' || currentPoints.length === 1)) {
      coords.push([hoverPoint.lng, hoverPoint.lat]);
    }

    if (coords.length === 0) {
      if (map.getSource('ruler-source')) {
        map.getSource('ruler-source').setData({ type: 'FeatureCollection', features: [] });
      }
      return;
    }

    const isPolygonParams = (measureMode === 'perimeter' || measureMode === 'area') && coords.length >= 3;
    let labelText = '';
    let labelPoint = null;

    if (measureMode === 'distance') {
      if (coords.length === 2) {
        const dist = calculateDistance(coords[0][1], coords[0][0], coords[1][1], coords[1][0]);
        labelText = dist < 1 ? `${(dist * 1000).toFixed(0)} m` : `${dist.toFixed(2)} km`;
        labelPoint = [(coords[0][0] + coords[1][0]) / 2, (coords[0][1] + coords[1][1]) / 2];
      }
    } else if (measureMode === 'perimeter') {
      if (coords.length >= 2) {
        let totalDist = 0;
        for (let i = 0; i < coords.length - 1; i++) {
          totalDist += calculateDistance(coords[i][1], coords[i][0], coords[i+1][1], coords[i+1][0]);
        }
        if (isFinalized && isPolygonParams) {
          totalDist += calculateDistance(coords[coords.length-1][1], coords[coords.length-1][0], coords[0][1], coords[0][0]);
        }
        labelText = totalDist < 1 ? `${(totalDist * 1000).toFixed(0)} m` : `${totalDist.toFixed(2)} km`;
        
        if (isFinalized && isPolygonParams) {
          const polyCoords = [...coords, coords[0]];
          const polyInstance = polygon([polyCoords]);
          const box = bbox(polyInstance);
          labelPoint = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
        } else {
          labelPoint = coords[coords.length - 1];
        }
      }
    } else if (measureMode === 'area') {
      if (isPolygonParams) {
        const polyCoords = [...coords, coords[0]];
        try {
          const polyInstance = polygon([polyCoords]);
          const areaSqMeters = area(polyInstance);
          if (areaSqMeters > 100000) {
            labelText = `${(areaSqMeters / 1000000).toFixed(3)} km²`;
          } else {
            labelText = `${areaSqMeters.toFixed(0)} m²`;
          }
          const box = bbox(polyInstance);
          labelPoint = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
        } catch (e) {
          console.error("Invalid polygon for area calculation", e);
          labelPoint = coords[coords.length - 1]; 
        }
      }
    }

    const features = [];

    // Add lines depending on mode
    if (isPolygonParams) {
      const lineCoords = isFinalized ? [...coords, coords[0]] : coords;
      if (measureMode === 'area') {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[...coords, coords[0]]]
          },
          properties: { isFill: true }
        });
      }
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: lineCoords
        }
      });
    } else if (coords.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coords
        }
      });
    }

    // Add point markers
    coords.forEach(coord => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: coord
        }
      });
    });

    // Add label
    if (labelText && labelPoint) {
      features.push({
        type: 'Feature',
        properties: { distanceLabel: labelText, isLabel: true },
        geometry: { type: 'Point', coordinates: labelPoint }
      });
    }

    const geojsonData = {
      type: 'FeatureCollection',
      features
    };

    if (map.getSource('ruler-source')) {
      map.getSource('ruler-source').setData(geojsonData);
    } else {
      map.addSource('ruler-source', {
        type: 'geojson',
        data: geojsonData
      });

      const beforeId = map.getLayer('institutions-layer') ? 'institutions-layer' : undefined;

      map.addLayer({
        id: 'ruler-fill',
        type: 'fill',
        source: 'ruler-source',
        filter: ['has', 'isFill'],
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': 0.3
        }
      }, beforeId);

      map.addLayer({
        id: 'ruler-line',
        type: 'line',
        source: 'ruler-source',
        filter: ['!', ['has', 'isFill']],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#ffffff', // white
          'line-width': 2.5,
          'line-dasharray': [2, 2]
        }
      }, beforeId);

      map.addLayer({
        id: 'ruler-points',
        type: 'circle',
        source: 'ruler-source',
        filter: ['!', ['has', 'distanceLabel']],
        paint: {
          'circle-radius': 5,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 2
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
    }
  }, []);

  // When changing mode, clear current drawn shape
  useEffect(() => {
    pointsRef.current = [];
    hoverPointRef.current = null;
    isFinalizedRef.current = false;
    if (mapInstance) addOrUpdateRulerSource(mapInstance, [], null, measureType, false);
    if (mapInstanceRight) addOrUpdateRulerSource(mapInstanceRight, [], null, measureType, false);
  }, [measureType, mapInstance, mapInstanceRight, addOrUpdateRulerSource]);

  useEffect(() => {
    if (!mapInstance) return;

    const whiteCrosshairCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' %3E%3Cline x1='12' y1='2' x2='12' y2='22' stroke='black' stroke-width='3'/%3E%3Cline x1='2' y1='12' x2='22' y2='12' stroke='black' stroke-width='3'/%3E%3Cline x1='12' y1='2' x2='12' y2='22' stroke='white' stroke-width='2'/%3E%3Cline x1='2' y1='12' x2='22' y2='12' stroke='white' stroke-width='2'/%3E%3C/svg%3E") 12 12, crosshair`;

    if (isActive) {
      mapInstance.getCanvas().style.cursor = whiteCrosshairCursor;
      if (mapInstanceRight) mapInstanceRight.getCanvas().style.cursor = whiteCrosshairCursor;

      const handleMapClick = (e) => {
        if (isFinalizedRef.current) return;

        // Distance mode is limited to 2 points max
        if (measureType === 'distance' && pointsRef.current.length >= 2) {
          return;
        }

        // Check if user clicked the first point to finalize the polygon
        if ((measureType === 'perimeter' || measureType === 'area') && pointsRef.current.length >= 3) {
           const firstPoint = pointsRef.current[0];
           const p1 = mapInstance.project(firstPoint);
           const p2 = e.point;
           const distPx = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
           
           if (distPx <= 7) {
               hoverPointRef.current = null;
               isFinalizedRef.current = true;
               addOrUpdateRulerSource(mapInstance, pointsRef.current, null, measureType, true);
               if (isCompareMode && mapInstanceRight) addOrUpdateRulerSource(mapInstanceRight, pointsRef.current, null, measureType, true);
               e.target.getCanvas().style.cursor = '';
               return;
           }
        }

        const newPoints = [...pointsRef.current, e.lngLat];

        // Only clear cursor for distance mode once finished. For others, keep crosshair until finalized.
        if (measureType === 'distance' && newPoints.length === 2) {
          e.target.getCanvas().style.cursor = '';
          isFinalizedRef.current = true;
        }

        pointsRef.current = newPoints;
        addOrUpdateRulerSource(mapInstance, newPoints, null, measureType, isFinalizedRef.current);
        if (isCompareMode && mapInstanceRight) addOrUpdateRulerSource(mapInstanceRight, newPoints, null, measureType, isFinalizedRef.current);
      };

      const handleMouseMove = (e) => {
        if (isFinalizedRef.current) return;

        if (measureType === 'distance' && pointsRef.current.length >= 2) {
          e.target.getCanvas().style.cursor = '';
          return;
        } else {
          e.target.getCanvas().style.cursor = whiteCrosshairCursor;
        }

        if (pointsRef.current.length >= 1) {
          hoverPointRef.current = e.lngLat;
          addOrUpdateRulerSource(mapInstance, pointsRef.current, e.lngLat, measureType, false);
          if (isCompareMode && mapInstanceRight) addOrUpdateRulerSource(mapInstanceRight, pointsRef.current, e.lngLat, measureType, false);
        }
      };

      const handleContextMenu = (e) => {
        e.preventDefault();
        // clear current measurement but stay in ruler mode
        pointsRef.current = [];
        hoverPointRef.current = null;
        isFinalizedRef.current = false;

        e.target.getCanvas().style.cursor = whiteCrosshairCursor;

        removeRulerLayers(mapInstance);
        if (isCompareMode && mapInstanceRight) removeRulerLayers(mapInstanceRight);
      };

      const handleDblClick = (e) => {
        if (isFinalizedRef.current) return;
        if (measureType === 'perimeter' || measureType === 'area') {
           e.preventDefault(); // Stop zoom
           hoverPointRef.current = null;
           isFinalizedRef.current = true;
           addOrUpdateRulerSource(mapInstance, pointsRef.current, null, measureType, true);
           if (isCompareMode && mapInstanceRight) addOrUpdateRulerSource(mapInstanceRight, pointsRef.current, null, measureType, true);
           e.target.getCanvas().style.cursor = '';
        }
      };

      mapInstance.on('click', handleMapClick);
      mapInstance.on('mousemove', handleMouseMove);
      mapInstance.on('contextmenu', handleContextMenu);
      mapInstance.on('dblclick', handleDblClick);

      if (isCompareMode && mapInstanceRight) {
        mapInstanceRight.on('click', handleMapClick);
        mapInstanceRight.on('mousemove', handleMouseMove);
        mapInstanceRight.on('contextmenu', handleContextMenu);
        mapInstanceRight.on('dblclick', handleDblClick);
      }

      return () => {
        mapInstance.off('click', handleMapClick);
        mapInstance.off('mousemove', handleMouseMove);
        mapInstance.off('contextmenu', handleContextMenu);
        mapInstance.off('dblclick', handleDblClick);
        mapInstance.getCanvas().style.cursor = '';

        if (mapInstanceRight) {
          mapInstanceRight.off('click', handleMapClick);
          mapInstanceRight.off('mousemove', handleMouseMove);
          mapInstanceRight.off('contextmenu', handleContextMenu);
          mapInstanceRight.off('dblclick', handleDblClick);
          mapInstanceRight.getCanvas().style.cursor = '';
        }
      };
    } else {
      // Cleanup if inactive
      pointsRef.current = [];
      isFinalizedRef.current = false;

      removeRulerLayers(mapInstance);
      if (mapInstanceRight) removeRulerLayers(mapInstanceRight);

      if (mapInstance) mapInstance.getCanvas().style.cursor = '';
      if (mapInstanceRight) mapInstanceRight.getCanvas().style.cursor = '';
    }
  }, [isActive, measureType, mapInstance, mapInstanceRight, isCompareMode, addOrUpdateRulerSource, removeRulerLayers]);

  return null;
};

export default MapRuler;

