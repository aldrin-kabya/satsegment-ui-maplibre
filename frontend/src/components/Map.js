"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Compare from '@maplibre/maplibre-gl-compare';
import '@maplibre/maplibre-gl-compare/dist/maplibre-gl-compare.css';
import LayerControls from './LayerControls';
import DistrictSelector from './DistrictSelector';
import BarChart from './BarChart';
import BrickfieldChangeMap from './BrickfieldChangeMap';
import useInstitutions from '../hooks/useInstitutions';
import '../css/BarChart.css';

// --- SUB-COMPONENT: Chart Toggle Container ---
const ChartToggleWrapper = ({ isVisible, toggleVisibility, positionClass, showMinimized = true, children }) => {
  if (isVisible) {
    return (
      <div className={`chart-panel ${positionClass} group fade-in`}>
        {children}
        <button
          onClick={toggleVisibility}
          className="absolute top-3 right-3 w-5 h-5 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-red-500 rounded-full flex items-center justify-center font-bold text-xs transition-colors"
          title="Minimize"
        >
          ✕
        </button>
      </div>
    );
  }

  if (!showMinimized) return null;

  return (
    <button
      onClick={toggleVisibility}
      className={`absolute z-[10001] bg-white px-3 py-2 rounded-full shadow-md hover:bg-gray-50 border border-gray-200 transition-all flex items-center justify-center gap-2 ${positionClass}`}
      style={{ width: 'auto', height: 'auto' }}
      title="Show Statistics"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
      <span className="text-xs font-bold text-gray-700">Stats</span>
    </button>
  );
};

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
    street: { url: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '© OpenStreetMap contributors' },
    satellite: {
      "2019": { url: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default/MapServer/tile/11351/{z}/{y}/{x}", attribution: '© Esri, Wayback (2019)' },
      "2023": { url: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default/MapServer/tile/64776/{z}/{y}/{x}", attribution: '© Esri, Wayback (2023)' }
    }
  };

  const INITIAL_VIEW = { center: [90.419689, 23.7808405], zoom: 12, pitch: 0, bearing: 0 };

  // --- STATE ---
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedYear, setSelectedYear] = useState("2023");
  const [basemapType, setBasemapType] = useState("satellite");
  const [activeLayerName, setActiveLayerName] = useState('all');
  const [isChartVisible, setIsChartVisible] = useState(true);
  const [mapsReady, setMapsReady] = useState(0);

  // Selected District/Upazila GeoJSON
  const [selectedRegionGeoJson, setSelectedRegionGeoJson] = useState(null);

  // Toggle for the full-screen Change Map
  const [showChangeMap, setShowChangeMap] = useState(false);

  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef(null);

  // Institutions layer
  const institutionsGeoJson = useInstitutions();
  const [showInstitutions, setShowInstitutions] = useState(false);

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
    // Insert overlay BELOW institutions layer so pins stay visible
    const beforeId = mapInstance.getLayer('institutions-layer') ? 'institutions-layer' : undefined;
    mapInstance.addLayer({ id: layerId, type: 'raster', source: sourceId, paint: { 'raster-opacity': config.opacity, 'raster-resampling': 'nearest' } }, beforeId);
  };

  const [mapLoaded, setMapLoaded] = useState({ single: false, left: false, right: false });

  // ... (keep existing code)

  useEffect(() => {
    if (showChangeMap) return;

    // Reset loaded state when recompiling maps
    setMapLoaded({ single: false, left: false, right: false });

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

      const setupLeft = () => {
        setMapLoaded(prev => ({ ...prev, left: true }));
        updateBasemap(mapLeft.current, "2019");
        updateOverlay(mapLeft.current, "2019");
      };
      const setupRight = () => {
        setMapLoaded(prev => ({ ...prev, right: true }));
        updateBasemap(mapRight.current, "2023");
        updateOverlay(mapRight.current, "2023");
      };
      mapLeft.current.on('load', setupLeft); mapRight.current.on('load', setupRight);
    } else {
      mapRef.current = new maplibregl.Map({ container: singleMapContainer.current, ...commonOptions });
      mapRef.current.on('load', () => {
        setMapLoaded(prev => ({ ...prev, single: true }));
        updateBasemap(mapRef.current, selectedYear);
        updateOverlay(mapRef.current, selectedYear);
      });
    }

    setMapsReady(prev => prev + 1);
  }, [isCompareMode]);

  useEffect(() => {
    if (isCompareMode) {
      if (mapLeft.current && mapLoaded.left) { updateBasemap(mapLeft.current, "2019"); updateOverlay(mapLeft.current, "2019"); }
      if (mapRight.current && mapLoaded.right) { updateBasemap(mapRight.current, "2023"); updateOverlay(mapRight.current, "2023"); }
    } else {
      if (mapRef.current && mapLoaded.single) { updateBasemap(mapRef.current, selectedYear); updateOverlay(mapRef.current, selectedYear); }
    }
  }, [selectedYear, activeLayerName, basemapType, mapLoaded]);

  // --- INSTITUTIONS LAYER MANAGEMENT ---
  const addInstitutionsLayer = useCallback((mapInstance) => {
    if (!mapInstance || !institutionsGeoJson) return;
    if (mapInstance.getSource('institutions-source')) return; // already added

    // Create an SVG pin icon and add it as a map image
    const size = 36;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    // Pin body
    ctx.beginPath();
    ctx.arc(size / 2, size / 2 - 4, 10, Math.PI, 0, false);
    ctx.lineTo(size / 2, size - 2);
    ctx.closePath();
    ctx.fillStyle = '#E53E3E';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Inner circle
    ctx.beginPath();
    ctx.arc(size / 2, size / 2 - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    if (!mapInstance.hasImage('institution-pin')) {
      mapInstance.addImage('institution-pin', ctx.getImageData(0, 0, size, size), {
        pixelRatio: 2,
      });
    }

    mapInstance.addSource('institutions-source', {
      type: 'geojson',
      data: institutionsGeoJson,
    });

    mapInstance.addLayer({
      id: 'institutions-layer',
      type: 'symbol',
      source: 'institutions-source',
      layout: {
        'icon-image': 'institution-pin',
        'icon-size': 1.0,
        'icon-allow-overlap': false,
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
        'text-optional': true,
        'text-max-width': 12,
      },
      paint: {
        'text-color': '#1a202c',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
      minzoom: 8,
    });
  }, [institutionsGeoJson]);

  const removeInstitutionsLayer = useCallback((mapInstance) => {
    if (!mapInstance) return;
    if (mapInstance.getLayer('institutions-layer')) mapInstance.removeLayer('institutions-layer');
    if (mapInstance.getSource('institutions-source')) mapInstance.removeSource('institutions-source');
  }, []);

  useEffect(() => {
    const shouldShow = showInstitutions && activeLayerName === 'brickfield';
    const activeMaps = isCompareMode
      ? [mapLeft.current, mapRight.current]
      : [mapRef.current];

    activeMaps.forEach(m => {
      if (!m) return;
      if (shouldShow) {
        addInstitutionsLayer(m);
      } else {
        removeInstitutionsLayer(m);
      }
    });
  }, [showInstitutions, activeLayerName, isCompareMode, addInstitutionsLayer, removeInstitutionsLayer, mapLoaded]);

  const getAttributionText = () => {
    if (basemapType === 'street') return BASEMAPS.street.attribution;
    if (isCompareMode) return `Left: ${BASEMAPS.satellite["2019"].attribution} | Right: ${BASEMAPS.satellite["2023"].attribution}`;
    return BASEMAPS.satellite[selectedYear]?.attribution || BASEMAPS.satellite["2023"].attribution;
  };

  // Handle outside clicks for the Year Dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
        setIsYearDropdownOpen(false);
      }
    };

    if (isYearDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isYearDropdownOpen]);

  // --- DYNAMIC POSITIONING LOGIC ---
  const isLeftChartActive = isCompareMode && activeLayerName !== 'brickfield';
  let controlPanelTopClass = 'top-4';
  if (isLeftChartActive) {
    // If Left Chart is visible, push controls down approx 240px
    // If Left Chart is minimized (hidden), buttons return to top-4 default
    controlPanelTopClass = isChartVisible ? 'top-[210px]' : 'top-4';
  }

  // --- CONDITIONAL RENDER: CHANGE MAP ---
  // BrickfieldChangeMap is now rendered as an overlay at the end of the return statement


  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>

      {/* UI LAYERS (Hidden when Change Map is valid) */}
      {!showChangeMap && (
        <>
          {/* 1. DISTRICT SELECTOR */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
            <DistrictSelector
              mapInstance={isCompareMode ? mapLeft.current : mapRef.current}
              mapInstanceRight={isCompareMode ? mapRight.current : null}
              isCompareMode={isCompareMode}
              mapView={basemapType}
              activeLulcLayer={activeLayerName}
              onSelectRegion={setSelectedRegionGeoJson} // Connected for stats
            />
          </div>

          {/* 2. FLOATING BUTTONS (No white box container) */}
          <div
            className={`absolute left-4 z-20 flex flex-col gap-3 transition-all duration-300 ease-in-out items-start ${controlPanelTopClass}`}
          >
            {/* Toggle Compare Button */}
            <button
              onClick={() => setIsCompareMode(!isCompareMode)}
              className={`py-2 px-4 rounded-full shadow-md text-sm font-bold transition-all transform hover:scale-105 border ${isCompareMode
                ? 'bg-white text-red-600 hover:bg-gray-50 border-gray-200'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                }`}
            >
              {isCompareMode ? "Exit Comparison" : "Compare Years"}
            </button>

            {/* Year Dropdown Pill */}
            {!isCompareMode && (
              <div className="bg-white p-1 pr-1.5 rounded-full shadow-md flex items-center gap-1.5 border border-gray-200 transition-all hover:shadow-lg">
                <span className="pl-2 font-bold text-gray-700 text-sm">Year</span>
                <div className="relative" ref={yearDropdownRef}>
                  {/* Custom styled select replacement */}
                  <div
                    className="appearance-none bg-white border border-gray-300 rounded-full py-1 pl-3 pr-8 font-bold text-sm text-gray-800 cursor-pointer transition-colors hover:border-gray-400 relative"
                    onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                  >
                    {selectedYear}

                    {/* Dropdown Menu */}
                    <div className={`absolute top-full left-0 mt-2 w-full bg-white border border-gray-100 rounded-[14px] shadow-lg overflow-hidden transition-all duration-200 z-50 ${isYearDropdownOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                      <div
                        className={`px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm font-bold transition-colors ${selectedYear === "2023" ? 'text-blue-600 bg-blue-50/50' : 'text-gray-700'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedYear("2023");
                          setIsYearDropdownOpen(false);
                        }}
                      >
                        2023
                      </div>
                      <div
                        className={`px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm font-bold transition-colors ${selectedYear === "2019" ? 'text-blue-600 bg-blue-50/50' : 'text-gray-700'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedYear("2019");
                          setIsYearDropdownOpen(false);
                        }}
                      >
                        2019
                      </div>
                    </div>

                  </div>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-600">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
            )}

            {/* INSTITUTIONS TOGGLE (Only for Brickfield) */}
            {activeLayerName === 'brickfield' && (
              <div className="flex items-center gap-2 bg-white pl-3 pr-3 py-1.5 rounded-full shadow-md border border-gray-200">
                <span className="text-sm font-bold text-gray-700">Institutions</span>
                <button
                  onClick={() => setShowInstitutions(prev => !prev)}
                  className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${showInstitutions ? 'bg-red-500' : 'bg-gray-300'}`}
                  role="switch"
                  aria-checked={showInstitutions}
                >
                  <span className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform duration-200 ${showInstitutions ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                </button>
              </div>
            )}

            {/* Show Changes (Only for Brickfield) */}
            {activeLayerName === 'brickfield' && (
              <button
                onClick={() => setShowChangeMap(true)}
                className="py-2 px-4 rounded-full shadow-md text-sm font-bold bg-white text-gray-700 hover:bg-gray-50 transition-transform hover:scale-105 border border-gray-200"
              >
                Show Changes
              </button>
            )}
          </div>

          {/* 3. CHARTS */}
          {activeLayerName !== 'brickfield' && (
            isCompareMode ? (
              <>
                <ChartToggleWrapper
                  isVisible={isChartVisible}
                  toggleVisibility={() => setIsChartVisible(!isChartVisible)}
                  positionClass="chart-panel-left"
                  showMinimized={false}
                >
                  <BarChart map={mapLeft.current} year="2019" activeLayer={activeLayerName} apiUrl={API_URL} selectedRegion={selectedRegionGeoJson} />
                </ChartToggleWrapper>

                <ChartToggleWrapper
                  isVisible={isChartVisible}
                  toggleVisibility={() => setIsChartVisible(!isChartVisible)}
                  positionClass="chart-panel-right"
                >
                  <BarChart map={mapRight.current} year="2023" activeLayer={activeLayerName} apiUrl={API_URL} selectedRegion={selectedRegionGeoJson} />
                </ChartToggleWrapper>
              </>
            ) : (
              <ChartToggleWrapper
                isVisible={isChartVisible}
                toggleVisibility={() => setIsChartVisible(!isChartVisible)}
                positionClass="chart-panel-right"
              >
                <BarChart map={mapRef.current} year={selectedYear} activeLayer={activeLayerName} apiUrl={API_URL} selectedRegion={selectedRegionGeoJson} />
              </ChartToggleWrapper>
            )
          )}

          {/* 4. LAYER CONTROLS */}
          <LayerControls
            mapView={basemapType}
            toggleMapView={toggleMapView}
            activeLulcLayer={activeLayerName}
            handleLayerToggle={handleLayerToggle}
            selectedDataType="lulc"
          />

          {/* 5. ATTRIBUTION */}
          <div className="absolute bottom-0 right-0 z-20 bg-white/80 px-2 py-1 text-xs text-gray-700 pointer-events-none backdrop-blur-sm rounded-tl">
            <span dangerouslySetInnerHTML={{ __html: getAttributionText() }} />
          </div>
        </>
      )}

      {/* 6. MAPS */}
      {isCompareMode ? (
        <div ref={mapContainer} style={{ width: '100%', height: '100%' }}>
          <div ref={leftContainer} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          <div ref={rightContainer} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
        </div>
      ) : (
        <div ref={singleMapContainer} style={{ width: '100%', height: '100%' }} />
      )}

      {/* 7. CHANGE MAP OVERLAY */}
      {showChangeMap && (
        <BrickfieldChangeMap
          onClose={(finalViewState) => {
            setShowChangeMap(false);
            if (finalViewState) {
              if (isCompareMode) {
                if (mapLeft.current) mapLeft.current.jumpTo(finalViewState);
                if (mapRight.current) mapRight.current.jumpTo(finalViewState);
              } else {
                if (mapRef.current) mapRef.current.jumpTo(finalViewState);
              }
            }
          }}
          initialViewState={(() => {
            const activeMap = mapRef.current || mapLeft.current;
            if (activeMap) {
              return { center: activeMap.getCenter(), zoom: activeMap.getZoom() };
            }
            return null;
          })()}
        />
      )}
    </div>
  );
};

export default MapComponent;