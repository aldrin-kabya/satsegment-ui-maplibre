'use client';

import { useEffect, useRef, useCallback } from 'react';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import DragRectangleMode from './DragRectangleMode';
import CustomPolygonMode from './CustomPolygonMode';
import customTheme from './DrawTheme';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

const AreaSelection = ({
  mapInstance,
  mapInstanceRight,
  isCompareMode,
  drawMode, // 'rectangle', 'polygon', or null
  selectedRegionGeoJson,
  onSelectShape,
  onClearShape
}) => {
  const drawRef = useRef(null);
  const drawRightRef = useRef(null);
  const isDrawingSelectedRef = useRef(false);
  const previousDrawModeRef = useRef(drawMode);
  
  // Keep an up-to-date ref for the region so we can restore it across map instance changes
  const selectedRegionRef = useRef(selectedRegionGeoJson);
  useEffect(() => {
    selectedRegionRef.current = selectedRegionGeoJson;
  }, [selectedRegionGeoJson]);

  // Set up modes
  const initDrawInstance = useCallback(() => {
    const modes = { 
      ...MapboxDraw.modes, 
      draw_rectangle: DragRectangleMode,
      draw_polygon: CustomPolygonMode
    };
    return new MapboxDraw({
      modes,
      styles: customTheme,
      displayControlsDefault: false,
      userProperties: true,
    });
  }, []);

  const clearDrawings = useCallback((map, drawIns) => {
    if (drawIns && map && map.isStyleLoaded()) {
      drawIns.deleteAll();
    }
  }, []);

  const renderMask = useCallback((map, geoJson) => {
    if (!map) return;

    if (!geoJson) {
      if (map.getLayer('layer-draw-mask')) {
        map.setLayoutProperty('layer-draw-mask', 'visibility', 'none');
      }
      return;
    }

    try {
      if (!map.isStyleLoaded()) return;

      const worldRing = [[-180, 90], [180, 90], [180, -90], [-180, -90], [-180, 90]];
      let holes = [];
      const feature = geoJson.features[0];
      
      if (feature && feature.geometry.type === 'Polygon') {
        holes = feature.geometry.coordinates;
      } else if (feature && feature.geometry.type === 'MultiPolygon') {
        // If needed, but draw mostly creates Polygons
        feature.geometry.coordinates.forEach(poly => {
          holes.push(...poly);
        });
      }

      const maskGeoJSON = {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [worldRing, ...holes] }
        }]
      };

      if (!map.getSource('source-draw-mask')) {
        map.addSource('source-draw-mask', { type: 'geojson', data: maskGeoJSON });
      } else {
        map.getSource('source-draw-mask').setData(maskGeoJSON);
      }

      if (!map.getLayer('layer-draw-mask')) {
        map.addLayer({
          id: 'layer-draw-mask',
          type: 'fill',
          source: 'source-draw-mask',
          layout: { 'visibility': 'visible' },
          paint: {
            'fill-color': '#000000',
            'fill-opacity': 0.6
          }
        });
      } else {
        map.setLayoutProperty('layer-draw-mask', 'visibility', 'visible');
      }

      // Move mask above everything except UI overlays, similar to DistrictSelector
      const beforeId = map.getLayer('institutions-layer') ? 'institutions-layer' : undefined;
      map.moveLayer('layer-draw-mask', beforeId);

    } catch (e) {
      console.error("Mask Error:", e);
    }
  }, []);

  const handleUpdate = useCallback((e) => {
    const data = drawRef.current.getAll();
    if (data.features.length > 0) {
      isDrawingSelectedRef.current = true;
      const fg = { ...data };
      
      // Update Right map draw if in compare mode (mirroring the drawn shape)
      if (isCompareMode && drawRightRef.current && mapInstanceRight) {
         drawRightRef.current.deleteAll();
         drawRightRef.current.add(fg);
      }

      // Render Masks
      renderMask(mapInstance, fg);
      if (isCompareMode) renderMask(mapInstanceRight, fg);

      // Trigger callback with properties for the chart
      onSelectShape({
        geometries: [fg.features[0].geometry],
        name: "Selected Area"
      });

      // Switch to simple select mode after finishing drawing to prevent endless drawing
      if (e.type === 'draw.create') {
        setTimeout(() => {
           if (drawRef.current) drawRef.current.changeMode('simple_select');
           if (drawRightRef.current) drawRightRef.current.changeMode('simple_select');
        }, 100);
      }
    } else {
       // if all deleted
       isDrawingSelectedRef.current = false;
       onClearShape();
       renderMask(mapInstance, null);
       if (isCompareMode) renderMask(mapInstanceRight, null);
    }
  }, [mapInstance, mapInstanceRight, isCompareMode, onSelectShape, onClearShape, renderMask]);
  
  const handleContextMenu = useCallback((e) => {
    if (!drawMode) return;
    e.preventDefault();
    if (drawRef.current) {
        drawRef.current.deleteAll();
        if (drawRightRef.current) drawRightRef.current.deleteAll();
        isDrawingSelectedRef.current = false;
        onClearShape();
        renderMask(mapInstance, null);
        if (isCompareMode && mapInstanceRight) renderMask(mapInstanceRight, null);

        // Restart drawing tool
        const modeId = drawMode === 'rectangle' ? 'draw_rectangle' : 'draw_polygon';
        drawRef.current.changeMode(modeId);
        if (drawRightRef.current) drawRightRef.current.changeMode(modeId);
    }
  }, [drawMode, mapInstance, mapInstanceRight, isCompareMode, onClearShape, renderMask]);


  // Initialize and clean up controls
  useEffect(() => {
    if (!mapInstance) return;

    const restoreFeature = (mapIns, drawIns) => {
      const region = selectedRegionRef.current;
      if (region && region.name === "Selected Area") {
         const geom = region.geometries[0];
         const feature = { type: 'Feature', id: 'restored-shape', properties: { active: 'false' }, geometry: geom };
         if (!drawIns.get('restored-shape')) drawIns.add(feature);
         if (drawIns.getMode && drawIns.getMode() !== 'simple_select') drawIns.changeMode('simple_select');
         renderMask(mapIns, { features: [feature] });
         isDrawingSelectedRef.current = true;
      }
    };

    if (drawMode) {
      if (!drawRef.current) {
        drawRef.current = initDrawInstance();
        mapInstance.addControl(drawRef.current, 'top-left');

        // Events
        mapInstance.on('draw.create', handleUpdate);
        mapInstance.on('draw.update', handleUpdate);
        mapInstance.on('draw.delete', handleUpdate);
        mapInstance.on('contextmenu', handleContextMenu);
        
        if (mapInstance.isStyleLoaded()) restoreFeature(mapInstance, drawRef.current);
        else mapInstance.once('idle', () => restoreFeature(mapInstance, drawRef.current));
      }
      
      if (isCompareMode && mapInstanceRight && !drawRightRef.current) {
        drawRightRef.current = initDrawInstance();
        mapInstanceRight.addControl(drawRightRef.current, 'top-left');
        mapInstanceRight.on('contextmenu', handleContextMenu);
        
        if (mapInstanceRight.isStyleLoaded()) restoreFeature(mapInstanceRight, drawRightRef.current);
        else mapInstanceRight.once('idle', () => restoreFeature(mapInstanceRight, drawRightRef.current));
      } else if (!isCompareMode && drawRightRef.current) {
        mapInstanceRight?.removeControl(drawRightRef.current);
        drawRightRef.current = null;
      }

      // If switching draw modes (e.g. rect -> poly), clear the state
      if (previousDrawModeRef.current !== null && previousDrawModeRef.current !== drawMode) {
         if (drawRef.current) drawRef.current.deleteAll();
         if (drawRightRef.current) drawRightRef.current.deleteAll();
         if (selectedRegionRef.current && selectedRegionRef.current.name === "Selected Area") {
           onClearShape();
         }
         renderMask(mapInstance, null);
         if (isCompareMode) renderMask(mapInstanceRight, null);
      }
      previousDrawModeRef.current = drawMode;

      // Always force active tool if no completed shape blocks it
      if (!isDrawingSelectedRef.current) {
        const modeId = drawMode === 'rectangle' ? 'draw_rectangle' : 'draw_polygon';
        drawRef.current.changeMode(modeId);
      }
    } else {
      // Drawmode is null -> Disable & cleanup
      if (drawRef.current) {
        clearDrawings(mapInstance, drawRef.current);
        mapInstance.off('draw.create', handleUpdate);
        mapInstance.off('draw.update', handleUpdate);
        mapInstance.off('draw.delete', handleUpdate);
        mapInstance.off('contextmenu', handleContextMenu);
        try { mapInstance.removeControl(drawRef.current); } catch(e){}
        drawRef.current = null;
      }
      if (drawRightRef.current && mapInstanceRight) {
        clearDrawings(mapInstanceRight, drawRightRef.current);
        mapInstanceRight.off('contextmenu', handleContextMenu);
        try { mapInstanceRight.removeControl(drawRightRef.current); } catch(e){}
        drawRightRef.current = null;
      }

      isDrawingSelectedRef.current = false;
      previousDrawModeRef.current = null;
      if (selectedRegionRef.current && selectedRegionRef.current.name === "Selected Area") {
        onClearShape();
      }
      renderMask(mapInstance, null);
      if (isCompareMode && mapInstanceRight) renderMask(mapInstanceRight, null);
      
      // Explicitly reset cursors and re-enable dragging
      if (mapInstance) {
        mapInstance.getCanvas().style.cursor = '';
        if (mapInstance.dragPan) mapInstance.dragPan.enable();
      }
      if (mapInstanceRight) {
        mapInstanceRight.getCanvas().style.cursor = '';
        if (mapInstanceRight.dragPan) mapInstanceRight.dragPan.enable();
      }
    }

    return () => {
      // Completely tear down Draw instances safely if the dependent mapInstance changes (like entering/exiting compare mode)
      if (drawRef.current) {
        try { mapInstance.removeControl(drawRef.current); } catch(e){}
        mapInstance.off('draw.create', handleUpdate);
        mapInstance.off('draw.update', handleUpdate);
        mapInstance.off('draw.delete', handleUpdate);
        mapInstance.off('contextmenu', handleContextMenu);
        drawRef.current = null;
      }
      if (mapInstance) {
        mapInstance.getCanvas().style.cursor = '';
        if (mapInstance.dragPan) mapInstance.dragPan.enable();
      }
      if (drawRightRef.current && mapInstanceRight) {
        mapInstanceRight.off('contextmenu', handleContextMenu);
        try { mapInstanceRight.removeControl(drawRightRef.current); } catch(e){}
        drawRightRef.current = null;
      }
      if (mapInstanceRight) {
        mapInstanceRight.getCanvas().style.cursor = '';
        if (mapInstanceRight.dragPan) mapInstanceRight.dragPan.enable();
      }
    };
  }, [mapInstance, mapInstanceRight, isCompareMode, drawMode, handleUpdate, initDrawInstance, clearDrawings, renderMask]);

  return null; // Logic-only component
};

export default AreaSelection;
