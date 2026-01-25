"use client";

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Compare from '@maplibre/maplibre-gl-compare';
import '@maplibre/maplibre-gl-compare/dist/maplibre-gl-compare.css';
import LayerControls from './LayerControls';
import DistrictSelector from './DistrictSelector';

const MapComponent = () => {
  // --- REFS ---
  const mapContainer = useRef(null);
  const singleMapContainer = useRef(null);
  const leftContainer = useRef(null);
  const rightContainer = useRef(null);
  
  const mapRef = useRef(null);
  const mapLeft = useRef(null);
  const mapRight = useRef(null);
  const compareRef = useRef(null);

  // --- CONFIGURATION ---
  const API_URL = "http://103.81.70.74:8000"; 
  
  const PATHS = {
    lulc: {
      "2019": "/media/drive2/armun/sat-segment/processed_cog/2019_cog.tif",
      "2023": "/media/drive2/armun/sat-segment/processed_cog/2023_cog.tif"
    },
    brickfield: {
      "2019": "/media/drive2/armun/sat-segment/processed_cog/brickfield_2019_cog.tif",
      "2023": "/media/drive2/armun/sat-segment/processed_cog/brickfield_2023_cog.tif"
    }
  };

  const BASEMAPS = {
    street: {
      url: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '© OpenStreetMap contributors'
    },
    satellite: {
      "2019": {
        url: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default/MapServer/tile/11351/{z}/{y}/{x}",
        attribution: '© Esri, Wayback (2019)'
      },
      "2023": {
        url: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default/MapServer/tile/64776/{z}/{y}/{x}",
        attribution: '© Esri, Wayback (2023)'
      }
    }
  };

  const INITIAL_VIEW = {
    center: [90.419689, 23.7808405], 
    zoom: 12,                   
    pitch: 0,
    bearing: 0
  };

  // --- STATE ---
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedYear, setSelectedYear] = useState("2023");
  const [basemapType, setBasemapType] = useState("satellite"); 
  const [activeLayerName, setActiveLayerName] = useState('all');
  
  // --- NEW: State to track if maps are initialized ---
  // This forces a re-render so child components get the valid mapRef
  const [mapsReady, setMapsReady] = useState(0); 

  const LULC_COLORS = { 0: [0, 0, 0, 0], 1: [0, 255, 255, 255], 2: [255, 0, 0, 255], 3: [0, 0, 255, 255], 4: [0, 255, 0, 255], 5: [255, 255, 0, 255] };
  const BRICKFIELD_COLORS = { 0: [0, 0, 0, 0], 1: [255, 0, 0, 255] };

  // --- LOGIC ---
  const handleLayerToggle = (layerName) => {
    if (activeLayerName === layerName) { setActiveLayerName(null); return; }
    setActiveLayerName(layerName);
  };
  const toggleMapView = () => setBasemapType(prev => prev === 'street' ? 'satellite' : 'street');

  const getOverlayConfig = (year) => {
    if (!activeLayerName) return null;
    if (activeLayerName === 'brickfield') {
      const colormap = encodeURIComponent(JSON.stringify(BRICKFIELD_COLORS));
      return { url: `${API_URL}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${PATHS.brickfield[year]}&colormap=${colormap}`, opacity: 0.5 };
    }
    const activeClasses = { 1: false, 2: false, 3: false, 4: false, 5: false };
    switch (activeLayerName) {
      case 'all': Object.keys(activeClasses).forEach(k => activeClasses[k] = true); break;
      case 'forest': activeClasses[1] = true; break;
      case 'built-up': activeClasses[2] = true; break;
      case 'water': activeClasses[3] = true; break;
      case 'farmland': activeClasses[4] = true; break;
      case 'meadow': activeClasses[5] = true; break;
    }
    const dynamicColors = { ...LULC_COLORS };
    Object.keys(activeClasses).forEach(key => { if (!activeClasses[key]) dynamicColors[key] = [0, 0, 0, 0]; });
    const colormap = encodeURIComponent(JSON.stringify(dynamicColors));
    return { url: `${API_URL}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${PATHS.lulc[year]}&colormap=${colormap}`, opacity: 0.5 };
  };

  const getEmptyStyle = () => ({ version: 8, sources: {}, layers: [] });

  const updateBasemap = (mapInstance, yearForSat) => {
    if (!mapInstance) return;
    const sourceId = 'basemap-source'; const layerId = 'basemap-layer';
    let config = BASEMAPS.street;
    if (basemapType === 'satellite') config = BASEMAPS.satellite[yearForSat] || BASEMAPS.satellite["2023"];
    if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
    if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
    mapInstance.addSource(sourceId, { type: 'raster', tiles: [config.url], tileSize: 256 });
    const beforeId = mapInstance.getLayer('overlay-layer') ? 'overlay-layer' : undefined;
    mapInstance.addLayer({ id: layerId, type: 'raster', source: sourceId, paint: {} }, beforeId); 
  };

  const updateOverlay = (mapInstance, year) => {
    if (!mapInstance) return;
    const sourceId = 'overlay-source'; const layerId = 'overlay-layer';
    const config = getOverlayConfig(year);
    if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
    if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
    if (!config) return;
    mapInstance.addSource(sourceId, { type: 'raster', tiles: [config.url], tileSize: 256, minzoom: 0, maxzoom: 24 });
    mapInstance.addLayer({ id: layerId, type: 'raster', source: sourceId, paint: { 'raster-opacity': config.opacity, 'raster-resampling': 'nearest' } });
  };

  useEffect(() => {
    let currentCenter = INITIAL_VIEW.center; let currentZoom = INITIAL_VIEW.zoom;
    const activeMap = mapRef.current || mapLeft.current;
    if (activeMap) { currentCenter = activeMap.getCenter(); currentZoom = activeMap.getZoom(); }
    if (mapRef.current) mapRef.current.remove(); if (compareRef.current) compareRef.current.remove();
    if (mapLeft.current) mapLeft.current.remove(); if (mapRight.current) mapRight.current.remove();
    mapRef.current = null; mapLeft.current = null; mapRight.current = null; compareRef.current = null;
    const commonOptions = { style: getEmptyStyle(), center: currentCenter, zoom: currentZoom, attributionControl: false };

    if (isCompareMode) {
      mapLeft.current = new maplibregl.Map({ container: leftContainer.current, ...commonOptions });
      mapRight.current = new maplibregl.Map({ container: rightContainer.current, ...commonOptions });
      compareRef.current = new Compare(mapLeft.current, mapRight.current, mapContainer.current, {});
      setTimeout(() => { if (mapLeft.current) mapLeft.current.resize(); if (mapRight.current) mapRight.current.resize(); }, 100);
      const setupLeft = () => { updateBasemap(mapLeft.current, "2019"); updateOverlay(mapLeft.current, "2019"); };
      const setupRight = () => { updateBasemap(mapRight.current, "2023"); updateOverlay(mapRight.current, "2023"); };
      mapLeft.current.on('load', setupLeft); mapRight.current.on('load', setupRight);
    } else {
      mapRef.current = new maplibregl.Map({ container: singleMapContainer.current, ...commonOptions });
      mapRef.current.on('load', () => { updateBasemap(mapRef.current, selectedYear); updateOverlay(mapRef.current, selectedYear); });
    }

    // --- FIX: Signal that maps are ready ---
    // This updates the state, forcing a re-render, 
    // which passes the populated refs to DistrictSelector
    setMapsReady(prev => prev + 1);

  }, [isCompareMode]);

  useEffect(() => {
    if (isCompareMode) {
      if (mapLeft.current && mapLeft.current.isStyleLoaded()) { updateBasemap(mapLeft.current, "2019"); updateOverlay(mapLeft.current, "2019"); }
      if (mapRight.current && mapRight.current.isStyleLoaded()) { updateBasemap(mapRight.current, "2023"); updateOverlay(mapRight.current, "2023"); }
    } else {
      if (mapRef.current && mapRef.current.isStyleLoaded()) { updateBasemap(mapRef.current, selectedYear); updateOverlay(mapRef.current, selectedYear); }
    }
  }, [selectedYear, activeLayerName, basemapType]); 

  const getAttributionText = () => {
    if (basemapType === 'street') return BASEMAPS.street.attribution;
    if (isCompareMode) return `Left: ${BASEMAPS.satellite["2019"].attribution} | Right: ${BASEMAPS.satellite["2023"].attribution}`;
    return BASEMAPS.satellite[selectedYear]?.attribution || BASEMAPS.satellite["2023"].attribution;
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      
      {/* 1. TOP CENTER: DISTRICT SELECTOR */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <DistrictSelector 
            // Passing the current refs. Since 'mapsReady' state changed, these will be populated now.
            mapInstance={isCompareMode ? mapLeft.current : mapRef.current}
            mapInstanceRight={isCompareMode ? mapRight.current : null}
            isCompareMode={isCompareMode}
            mapView={basemapType}
            activeLulcLayer={activeLayerName} 
        />
      </div>

      {/* 2. TOP LEFT: CONTROL PANEL */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-3 bg-white p-4 rounded shadow-lg border border-gray-200 w-52">
        <h3 className="font-bold text-gray-800 text-sm border-b pb-1">Control Panel</h3>

        <button 
          onClick={() => setIsCompareMode(!isCompareMode)}
          className={`w-full py-2 rounded text-sm font-bold transition-colors ${
            isCompareMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {isCompareMode ? "Exit Comparison" : "Compare Years"}
        </button>

        {!isCompareMode && (
          <div>
            <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Select Year</label>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full border border-gray-300 rounded p-1.5 text-black bg-white text-sm"
            >
              <option value="2019">2019 View</option>
              <option value="2023">2023 View</option>
            </select>
          </div>
        )}
      </div>

      {/* 3. BOTTOM LEFT: LAYER CONTROLS */}
      <LayerControls 
        mapView={basemapType}
        toggleMapView={toggleMapView}
        activeLulcLayer={activeLayerName}
        handleLayerToggle={handleLayerToggle}
        selectedDataType="lulc"
      />

      {/* 4. BOTTOM RIGHT: ATTRIBUTION */}
      <div className="absolute bottom-0 right-0 z-20 bg-white/80 px-2 py-1 text-xs text-gray-700 pointer-events-none backdrop-blur-sm rounded-tl">
        <span dangerouslySetInnerHTML={{ __html: getAttributionText() }} />
      </div>

      {/* 5. MAP CONTAINER */}
      {isCompareMode ? (
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }}>
          <div ref={leftContainer} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          <div ref={rightContainer} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
        </div>
      ) : (
        <div ref={singleMapContainer} style={{ width: '100%', height: '100%' }} />
      )}
    </div>
  );
};

export default MapComponent;