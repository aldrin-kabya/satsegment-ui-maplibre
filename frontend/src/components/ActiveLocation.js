import React, { useEffect, useRef, useCallback } from 'react';

const formatCoords = (lngLat) => {
  return `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`;
};

const ActiveLocation = ({ mapInstance, mapInstanceRight, isCompareMode, isActive, onClose }) => {
  const pinsRef = useRef([]);
  const hoverPointRef = useRef(null);

  const removeActiveLocationLayers = useCallback((map) => {
    if (!map) return;
    try {
      if (map.getLayer('active-loc-hover-label')) map.removeLayer('active-loc-hover-label');
      if (map.getLayer('active-loc-hover-point')) map.removeLayer('active-loc-hover-point');
      if (map.getLayer('active-loc-pins-point')) map.removeLayer('active-loc-pins-point');
      if (map.getSource('active-loc-source')) map.removeSource('active-loc-source');
    } catch (e) {
      // ignore
    }
  }, []);

  const addOrUpdateSource = useCallback((map, currentPins, hoverPoint) => {
    if (!map || !map.getStyle()) return;

    const features = [];

    // Hover point (active cursor)
    if (hoverPoint) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [hoverPoint.lng, hoverPoint.lat] },
        properties: { isHover: true, label: formatCoords(hoverPoint) }
      });
    }

    // Pinned points
    currentPins.forEach(pin => {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [pin.lng, pin.lat] },
        properties: { isPinned: true, label: formatCoords(pin) }
      });
    });

    const geojsonData = { type: 'FeatureCollection', features };

    if (map.getSource('active-loc-source')) {
      map.getSource('active-loc-source').setData(geojsonData);
    } else {
      map.addSource('active-loc-source', {
        type: 'geojson',
        data: geojsonData
      });

      const beforeId = map.getLayer('institutions-layer') ? 'institutions-layer' : undefined;

      // Hover point (the circle tracking the mouse)
      map.addLayer({
        id: 'active-loc-hover-point',
        type: 'circle',
        source: 'active-loc-source',
        filter: ['has', 'isHover'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#3B82F6', // Blue color for active cursor
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      }, beforeId);

      // Pins (the dropped points)
      map.addLayer({
        id: 'active-loc-pins-point',
        type: 'circle',
        source: 'active-loc-source',
        filter: ['has', 'isPinned'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#EF4444', // Red color for dropped pins
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2
        }
      }, beforeId);

      // Labels for both hover and pinned
      map.addLayer({
        id: 'active-loc-hover-label',
        type: 'symbol',
        source: 'active-loc-source',
        filter: ['has', 'label'],
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Open Sans Bold'],
          'text-size': 13,
          'text-anchor': 'bottom',
          'text-offset': [0, -1],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2
        }
      }, beforeId);
    }
  }, []);

  useEffect(() => {
    if (!mapInstance) return;

    const crosshairCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' %3E%3Cline x1='12' y1='2' x2='12' y2='22' stroke='black' stroke-width='3'/%3E%3Cline x1='2' y1='12' x2='22' y2='12' stroke='black' stroke-width='3'/%3E%3Cline x1='12' y1='2' x2='12' y2='22' stroke='white' stroke-width='2'/%3E%3Cline x1='2' y1='12' x2='22' y2='12' stroke='white' stroke-width='2'/%3E%3C/svg%3E") 12 12, crosshair`;

    if (isActive) {
      mapInstance.getCanvas().style.cursor = crosshairCursor;
      if (mapInstanceRight) mapInstanceRight.getCanvas().style.cursor = crosshairCursor;

      const handleMapClick = (e) => {
        pinsRef.current = [...pinsRef.current, e.lngLat];
        addOrUpdateSource(mapInstance, pinsRef.current, hoverPointRef.current);
        if (isCompareMode && mapInstanceRight) {
            addOrUpdateSource(mapInstanceRight, pinsRef.current, hoverPointRef.current);
        }
      };

      const handleMouseMove = (e) => {
        hoverPointRef.current = e.lngLat;
        addOrUpdateSource(mapInstance, pinsRef.current, hoverPointRef.current);
        if (isCompareMode && mapInstanceRight) {
            addOrUpdateSource(mapInstanceRight, pinsRef.current, hoverPointRef.current);
        }
      };

      const handleContextMenu = (e) => {
        e.preventDefault();
        // Right click clears all pins
        pinsRef.current = [];
        addOrUpdateSource(mapInstance, pinsRef.current, hoverPointRef.current);
        if (isCompareMode && mapInstanceRight) {
            addOrUpdateSource(mapInstanceRight, pinsRef.current, hoverPointRef.current);
        }
      };
      
      const handleMouseOut = () => {
        // When mouse leaves the map container, we remove hover coords
        hoverPointRef.current = null;
        addOrUpdateSource(mapInstance, pinsRef.current, null);
        if (isCompareMode && mapInstanceRight) {
            addOrUpdateSource(mapInstanceRight, pinsRef.current, null);
        }
      };

      mapInstance.on('click', handleMapClick);
      mapInstance.on('mousemove', handleMouseMove);
      mapInstance.on('mouseout', handleMouseOut);
      mapInstance.on('contextmenu', handleContextMenu);

      if (isCompareMode && mapInstanceRight) {
        mapInstanceRight.on('click', handleMapClick);
        mapInstanceRight.on('mousemove', handleMouseMove);
        mapInstanceRight.on('mouseout', handleMouseOut);
        mapInstanceRight.on('contextmenu', handleContextMenu);
      }

      return () => {
        mapInstance.off('click', handleMapClick);
        mapInstance.off('mousemove', handleMouseMove);
        mapInstance.off('mouseout', handleMouseOut);
        mapInstance.off('contextmenu', handleContextMenu);
        mapInstance.getCanvas().style.cursor = '';

        if (mapInstanceRight) {
          mapInstanceRight.off('click', handleMapClick);
          mapInstanceRight.off('mousemove', handleMouseMove);
          mapInstanceRight.off('mouseout', handleMouseOut);
          mapInstanceRight.off('contextmenu', handleContextMenu);
          mapInstanceRight.getCanvas().style.cursor = '';
        }
      };
    } else {
      // Cleanup if inactive
      pinsRef.current = [];
      hoverPointRef.current = null;

      removeActiveLocationLayers(mapInstance);
      if (mapInstanceRight) removeActiveLocationLayers(mapInstanceRight);

      if (mapInstance) mapInstance.getCanvas().style.cursor = '';
      if (mapInstanceRight) mapInstanceRight.getCanvas().style.cursor = '';
    }
  }, [isActive, mapInstance, mapInstanceRight, isCompareMode, addOrUpdateSource, removeActiveLocationLayers]);

  return null;
};

export default ActiveLocation;
