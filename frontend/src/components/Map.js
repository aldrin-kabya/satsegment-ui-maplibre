"use client";

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Compare from '@maplibre/maplibre-gl-compare';
import '@maplibre/maplibre-gl-compare/dist/maplibre-gl-compare.css';
import Legend from './Legend';

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
    "2019": "/media/drive2/armun/sat-segment/processed_cog/2019_cog.tif",
    "2023": "/media/drive2/armun/sat-segment/processed_cog/2023_cog.tif"
  };

  const BASEMAPS = {
    street: {
      url: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
      label: "© OpenStreetMap contributors"
    },
    satellite: {
      "2019": {
        url: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default/MapServer/tile/11351/{z}/{y}/{x}",
        label: "© Esri, Wayback (2019)"
      },
      "2023": {
        url: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default/MapServer/tile/64776/{z}/{y}/{x}",
        label: "© Esri, Wayback (2023)"
      }
    }
  };

  const INITIAL_VIEW = {
    center: [90.419689, 23.7808405], 
    zoom: 12,                   
    pitch: 0,
    bearing: 0
  };

  // --- STATE (Defaults Changed: 2023 & Satellite) ---
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedYear, setSelectedYear] = useState("2023"); // CHANGED
  const [basemapType, setBasemapType] = useState("satellite"); // CHANGED
  const [activeClasses, setActiveClasses] = useState({
    1: true, 2: true, 3: true, 4: true, 5: true
  });

  const BASE_COLORS = {
    0: [0, 0, 0, 0],       
    1: [0, 255, 255, 255], 
    2: [255, 0, 0, 255],   
    3: [0, 0, 255, 255],   
    4: [0, 255, 0, 255],   
    5: [255, 255, 0, 255]  
  };

  // --- HELPERS ---
  const getEncodedColormap = () => {
    const dynamicColors = { ...BASE_COLORS };
    Object.keys(activeClasses).forEach(key => {
      if (!activeClasses[key]) dynamicColors[key] = [0, 0, 0, 0];
    });
    return encodeURIComponent(JSON.stringify(dynamicColors));
  };

  const getTileUrl = (year) => {
    const path = PATHS[year];
    return `${API_URL}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${path}&colormap=${getEncodedColormap()}`;
  };

  const getEmptyStyle = () => ({
    version: 8,
    sources: {},
    layers: []
  });

  // --- ROBUST BASEMAP UPDATE ---
  const updateBasemap = (mapInstance, yearForSat) => {
    if (!mapInstance) return;

    const sourceId = 'basemap-source';
    const layerId = 'basemap-layer';
    
    let config = BASEMAPS.street;
    if (basemapType === 'satellite') {
      config = BASEMAPS.satellite[yearForSat] || BASEMAPS.satellite["2023"];
    }

    if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
    if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);

    mapInstance.addSource(sourceId, {
      type: 'raster',
      tiles: [config.url],
      tileSize: 256,
      // attribution: ... // DISABLED HERE to prevent flashing
    });
    
    const beforeId = mapInstance.getLayer('lulc-layer') ? 'lulc-layer' : undefined;

    mapInstance.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: {}
    }, beforeId); 
  };

  // --- ROBUST LULC UPDATE ---
  const updateLULC = (mapInstance, year) => {
    if (!mapInstance) return;
    
    const sourceId = 'lulc-source';
    const layerId = 'lulc-layer';
    const url = getTileUrl(year);

    if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
    if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);

    mapInstance.addSource(sourceId, {
      type: 'raster',
      tiles: [url],
      tileSize: 256,
      minzoom: 0, maxzoom: 24
    });

    mapInstance.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: {
        'raster-opacity': 0.5,
        'raster-resampling': 'nearest'
      }
    });
  };

  // --- INITIALIZATION EFFECT ---
  useEffect(() => {
    let currentCenter = INITIAL_VIEW.center;
    let currentZoom = INITIAL_VIEW.zoom;
    
    const activeMap = mapRef.current || mapLeft.current;
    if (activeMap) {
        currentCenter = activeMap.getCenter();
        currentZoom = activeMap.getZoom();
    }

    if (mapRef.current) mapRef.current.remove();
    if (compareRef.current) compareRef.current.remove();
    if (mapLeft.current) mapLeft.current.remove();
    if (mapRight.current) mapRight.current.remove();
    
    mapRef.current = null;
    mapLeft.current = null;
    mapRight.current = null;
    compareRef.current = null;

    const commonOptions = {
      style: getEmptyStyle(), 
      center: currentCenter,
      zoom: currentZoom,
      attributionControl: false // Disable internal attribution to fix flashing
    };

    if (isCompareMode) {
      mapLeft.current = new maplibregl.Map({ container: leftContainer.current, ...commonOptions });
      mapRight.current = new maplibregl.Map({ container: rightContainer.current, ...commonOptions });

      compareRef.current = new Compare(mapLeft.current, mapRight.current, mapContainer.current, {});

      setTimeout(() => {
        if (mapLeft.current) mapLeft.current.resize();
        if (mapRight.current) mapRight.current.resize();
      }, 100);

      const setupLeft = () => {
        updateBasemap(mapLeft.current, "2019"); 
        updateLULC(mapLeft.current, "2019");
      };
      const setupRight = () => {
        updateBasemap(mapRight.current, "2023");
        updateLULC(mapRight.current, "2023");
      };

      mapLeft.current.on('load', setupLeft);
      mapRight.current.on('load', setupRight);

    } else {
      mapRef.current = new maplibregl.Map({ container: singleMapContainer.current, ...commonOptions });
      
      mapRef.current.on('load', () => {
        updateBasemap(mapRef.current, selectedYear);
        updateLULC(mapRef.current, selectedYear);
      });
    }
  }, [isCompareMode]);

  // --- CONTENT UPDATE EFFECT ---
  useEffect(() => {
    if (isCompareMode) {
      if (mapLeft.current && mapLeft.current.isStyleLoaded()) {
        updateBasemap(mapLeft.current, "2019");
        updateLULC(mapLeft.current, "2019");
      }
      if (mapRight.current && mapRight.current.isStyleLoaded()) {
        updateBasemap(mapRight.current, "2023");
        updateLULC(mapRight.current, "2023");
      }
    } else {
      if (mapRef.current && mapRef.current.isStyleLoaded()) {
        updateBasemap(mapRef.current, selectedYear);
        updateLULC(mapRef.current, selectedYear);
      }
    }
  }, [selectedYear, activeClasses, basemapType]); 

  const toggleClass = (id) => setActiveClasses(prev => ({ ...prev, [id]: !prev[id] }));

  // --- DYNAMIC ATTRIBUTION TEXT GENERATOR ---
  const getAttributionText = () => {
    if (basemapType === 'street') return BASEMAPS.street.label;
    
    if (isCompareMode) {
        return `Left: ${BASEMAPS.satellite["2019"].label} | Right: ${BASEMAPS.satellite["2023"].label}`;
    }
    return BASEMAPS.satellite[selectedYear]?.label || BASEMAPS.satellite["2023"].label;
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      
      {/* CONTROL PANEL */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-3 bg-white p-4 rounded shadow-lg border border-gray-200 w-48">
        <h3 className="font-bold text-gray-800 text-sm border-b pb-1">Control Panel</h3>
        
        <button 
          onClick={() => setIsCompareMode(!isCompareMode)}
          className={`w-full py-2 rounded text-sm font-bold transition-colors ${
            isCompareMode 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
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

        <div>
            <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Basemap Style</label>
            <select 
              value={basemapType} 
              onChange={(e) => setBasemapType(e.target.value)}
              className="w-full border border-gray-300 rounded p-1.5 text-black bg-white text-sm"
            >
              <option value="street">Street (OSM)</option>
              <option value="satellite">Satellite (Wayback)</option>
            </select>
        </div>

        {isCompareMode && (
           <div className="mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded">
             <div className="flex justify-between"><span>Left:</span> <b>2019</b></div>
             <div className="flex justify-between"><span>Right:</span> <b>2023</b></div>
           </div>
        )}
      </div>

      <Legend activeClasses={activeClasses} onToggle={toggleClass} />

      {/* CUSTOM ATTRIBUTION BAR (Prevents flashing) */}
      <div className="absolute bottom-0 right-0 z-20 bg-white/80 px-2 py-1 text-xs text-gray-700 pointer-events-none backdrop-blur-sm rounded-tl">
        {getAttributionText()}
      </div>

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