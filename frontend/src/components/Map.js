"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Compare from '@maplibre/maplibre-gl-compare';
import '@maplibre/maplibre-gl-compare/dist/maplibre-gl-compare.css';
import LayerControls from './LayerControls';
import DistrictSelector from './DistrictSelector';
import BarChart from './BarChart';
import ChangeMap from './ChangeMap';
import useInstitutions from '../hooks/useInstitutions';
import Sidebar from './Sidebar';
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
      className={`absolute z-[10001] bg-white/85 backdrop-blur-md px-3 py-2 rounded-full shadow-md hover:bg-white/95 border border-gray-200 transition-all flex items-center justify-center gap-2 ${positionClass}`}
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
  const districtSelectorRef = useRef(null);

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
  const [satelliteProvider, setSatelliteProvider] = useState("bing"); // 'bing' or 'esri'
  const [activeLayerName, setActiveLayerName] = useState('all');
  const [isChartVisible, setIsChartVisible] = useState(true);
  const [mapsReady, setMapsReady] = useState(0);

  // Selected District/Upazila GeoJSON
  const [selectedRegionGeoJson, setSelectedRegionGeoJson] = useState(null);

  // Toggle for the full-screen Change Map
  const [showChangeMap, setShowChangeMap] = useState(false);

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

    // Check if everything is off
    const isAnyActive = Object.values(activeClasses).some(val => val);
    if (!isAnyActive) return null;

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

    const beforeId = mapInstance.getLayer('overlay-layer') ? 'overlay-layer' :
      (mapInstance.getLayer('layer-adm0') ? 'layer-adm0' :
        (mapInstance.getLayer('institutions-layer') ? 'institutions-layer' : undefined));

    const basemapSource = mapInstance.getSource(sourceId);
    if (basemapSource) {
      basemapSource.setTiles([config.url]);
    } else {
      mapInstance.addSource(sourceId, { type: 'raster', tiles: [config.url], tileSize: 256, maxzoom: 19 });
      mapInstance.addLayer({ id: layerId, type: 'raster', source: sourceId, paint: {} }, beforeId);
    }

    if (basemapType === 'satellite' && satelliteProvider === 'bing') {
      const cogPath = yearForSat === "2019"
        ? "/media/drive2/armun/sat-segment/processed_cog/bing_satellite_2019_cog.tif"
        : "/media/drive2/armun/sat-segment/processed_cog/bing_satellite_2023_cog.tif";
      const bingUrl = `${API_URL}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${cogPath}&nodata=0`;
      const bingSource = mapInstance.getSource('bing-satellite-source');
      if (bingSource) {
        bingSource.setTiles([bingUrl]);
      } else {
        mapInstance.addSource('bing-satellite-source', {
          type: 'raster',
          tiles: [bingUrl],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 24,
          bounds: [88.010, 20.730, 92.680, 26.630] // Approximate bounds of Bangladesh
        });
        mapInstance.addLayer({ id: 'bing-satellite-layer', type: 'raster', source: 'bing-satellite-source', paint: { 'raster-resampling': 'nearest' } }, beforeId);
      }
    } else {
      if (mapInstance.getLayer('bing-satellite-layer')) mapInstance.removeLayer('bing-satellite-layer');
      if (mapInstance.getSource('bing-satellite-source')) mapInstance.removeSource('bing-satellite-source');
    }
  };

  const updateOverlay = (mapInstance, year) => {
    if (!mapInstance) return;
    const sourceId = 'overlay-source'; const layerId = 'overlay-layer';
    const config = getOverlayConfig(year);

    if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
    if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);

    if (!config) return;

    mapInstance.addSource(sourceId, { type: 'raster', tiles: [config.url], tileSize: 256, minzoom: 0, maxzoom: 24 });
    const beforeId = mapInstance.getLayer('layer-mask') ? 'layer-mask' :
      (mapInstance.getLayer('layer-adm0') ? 'layer-adm0' :
        (mapInstance.getLayer('institutions-layer') ? 'institutions-layer' : undefined));
      
    mapInstance.addLayer({ 
      id: layerId, 
      type: 'raster', 
      source: sourceId, 
      layout: { visibility: showChangeMap ? 'none' : 'visible' },
      paint: { 'raster-opacity': config.opacity, 'raster-resampling': 'nearest' } 
    }, beforeId);
  };

  const updateCountryBorder = useCallback((mapInstance, currentBasemapType) => {
    if (!mapInstance) return;
    const sourceId = 'source-adm0';
    const layerId = 'layer-adm0';
    const boundaryColor = currentBasemapType === 'street' ? '#000000' : '#ffffff';

    if (!mapInstance.getSource(sourceId)) {
      mapInstance.addSource(sourceId, { type: 'geojson', data: '/bgd_admbnda_adm0_bbs_20201113_simplified.json' });
    }

    if (!mapInstance.getLayer(layerId)) {
      const beforeId = mapInstance.getLayer('institutions-layer') ? 'institutions-layer' : undefined;
      mapInstance.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': boundaryColor, 'line-width': 1 }
      }, beforeId);
    } else {
      mapInstance.setPaintProperty(layerId, 'line-color', boundaryColor);
    }
  }, []);

  const [mapLoaded, setMapLoaded] = useState({ single: false, left: false, right: false });

  // ... (keep existing code)

  useEffect(() => {
    // Reset loaded state when recompiling maps
    setMapLoaded({ single: false, left: false, right: false });

    let currentCenter = INITIAL_VIEW.center; let currentZoom = INITIAL_VIEW.zoom;
    const activeMap = mapRef.current || mapLeft.current;
    if (activeMap) { currentCenter = activeMap.getCenter(); currentZoom = activeMap.getZoom(); }
    if (mapRef.current) mapRef.current.remove(); if (compareRef.current) compareRef.current.remove();
    if (mapLeft.current) mapLeft.current.remove(); if (mapRight.current) mapRight.current.remove();
    mapRef.current = null; mapLeft.current = null; mapRight.current = null; compareRef.current = null;
    const commonOptions = { style: getEmptyStyle(), center: currentCenter, zoom: currentZoom, attributionControl: false, maxZoom: 24 };

    if (isCompareMode) {
      mapLeft.current = new maplibregl.Map({ container: leftContainer.current, ...commonOptions });
      mapRight.current = new maplibregl.Map({ container: rightContainer.current, ...commonOptions });
      compareRef.current = new Compare(mapLeft.current, mapRight.current, mapContainer.current, {});
      setTimeout(() => { if (mapLeft.current) mapLeft.current.resize(); if (mapRight.current) mapRight.current.resize(); }, 100);

      const setupLeft = () => {
        setMapLoaded(prev => ({ ...prev, left: true }));
        updateOverlay(mapLeft.current, "2019");
        updateBasemap(mapLeft.current, "2019");
        updateCountryBorder(mapLeft.current, basemapType);
      };
      const setupRight = () => {
        setMapLoaded(prev => ({ ...prev, right: true }));
        updateOverlay(mapRight.current, "2023");
        updateBasemap(mapRight.current, "2023");
        updateCountryBorder(mapRight.current, basemapType);
      };
      mapLeft.current.on('load', setupLeft); mapRight.current.on('load', setupRight);
    } else {
      mapRef.current = new maplibregl.Map({ container: singleMapContainer.current, ...commonOptions });
      mapRef.current.on('load', () => {
        setMapLoaded(prev => ({ ...prev, single: true }));
        updateOverlay(mapRef.current, selectedYear);
        updateBasemap(mapRef.current, selectedYear);
        updateCountryBorder(mapRef.current, basemapType);
      });
    }

    setMapsReady(prev => prev + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompareMode]);

  useEffect(() => {
    if (isCompareMode) {
      if (mapLeft.current && mapLoaded.left) { updateOverlay(mapLeft.current, "2019"); }
      if (mapRight.current && mapLoaded.right) { updateOverlay(mapRight.current, "2023"); }
    } else {
      if (mapRef.current && mapLoaded.single) { updateOverlay(mapRef.current, selectedYear); }
    }
  }, [selectedYear, activeLayerName, mapLoaded, isCompareMode]);

  // Hide overlay-layer while Change Map is overlaying the screen
  useEffect(() => {
    const activeMaps = isCompareMode
      ? [mapLeft.current, mapRight.current].filter(Boolean)
      : [mapRef.current].filter(Boolean);

    activeMaps.forEach(m => {
      if (m.getLayer('overlay-layer')) {
        m.setLayoutProperty('overlay-layer', 'visibility', showChangeMap ? 'none' : 'visible');
      }
    });
  }, [showChangeMap, isCompareMode]);

  useEffect(() => {
    if (isCompareMode) {
      if (mapLeft.current && mapLoaded.left) { updateBasemap(mapLeft.current, "2019"); updateCountryBorder(mapLeft.current, basemapType); }
      if (mapRight.current && mapLoaded.right) { updateBasemap(mapRight.current, "2023"); updateCountryBorder(mapRight.current, basemapType); }
    } else {
      if (mapRef.current && mapLoaded.single) { updateBasemap(mapRef.current, selectedYear); updateCountryBorder(mapRef.current, basemapType); }
    }
  }, [selectedYear, basemapType, satelliteProvider, mapLoaded, isCompareMode, updateCountryBorder]);

  // --- INSTITUTIONS LAYER MANAGEMENT ---
  const addInstitutionsLayer = useCallback((mapInstance) => {
    if (!mapInstance || !institutionsGeoJson) return;
    if (!mapInstance.isStyleLoaded()) {
      // Wait for the map to be idle (style loaded + tiles rendered), then try again
      mapInstance.once('idle', () => addInstitutionsLayer(mapInstance));
      return;
    }
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
        'text-field': [
          'step',
          ['zoom'],
          '',
          16,
          ['get', 'name']
        ],
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
    try {
      if (mapInstance.getLayer('institutions-layer')) mapInstance.removeLayer('institutions-layer');
      if (mapInstance.getSource('institutions-source')) mapInstance.removeSource('institutions-source');
    } catch (e) {
      // Map may have been removed or style not loaded — safe to ignore
    }
  }, []);

  useEffect(() => {
    const shouldShow = showInstitutions;
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
  }, [showInstitutions, activeLayerName, isCompareMode, addInstitutionsLayer, removeInstitutionsLayer, mapLoaded, institutionsGeoJson]);

  const getAttributionText = () => {
    if (basemapType === 'street') return BASEMAPS.street.attribution;

    // Dynamic generation based on selected provider and years
    if (satelliteProvider === 'bing') {
      if (isCompareMode) return `Left: © Bing (2019) | Right: © Bing (2023)`;
      return `© Bing (${selectedYear})`;
    } else {
      if (isCompareMode) return `Left: ${BASEMAPS.satellite["2019"].attribution} | Right: ${BASEMAPS.satellite["2023"].attribution}`;
      return BASEMAPS.satellite[selectedYear]?.attribution || BASEMAPS.satellite["2023"].attribution;
    }
  };



  // --- CONDITIONAL RENDER: CHANGE MAP ---
  // BrickfieldChangeMap is now rendered as an overlay at the end of the return statement


  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>

      {/* 1. DISTRICT SELECTOR (ALWAYS VISIBLE) */}
      <div className="absolute top-[10px] left-1/2 -translate-x-1/2 z-[10005] pointer-events-auto">
        <DistrictSelector
          ref={districtSelectorRef}
          mapInstance={isCompareMode ? mapLeft.current : mapRef.current}
          mapInstanceRight={isCompareMode ? mapRight.current : null}
          isCompareMode={isCompareMode}
          mapView={basemapType}
          activeLulcLayer={activeLayerName}
          onSelectRegion={setSelectedRegionGeoJson} // Connected for stats
        />
      </div>

      {/* 2. SIDEBAR (always rendered to preserve pin state) */}
      <Sidebar 
        inChangeMap={showChangeMap}
        isCompareMode={isCompareMode}
        setIsCompareMode={setIsCompareMode}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        satelliteProvider={satelliteProvider}
        setSatelliteProvider={setSatelliteProvider}
        showInstitutions={showInstitutions}
        onToggleInstitutions={() => setShowInstitutions(prev => !prev)}
        activeLayerName={activeLayerName}
        setActiveLayerName={setActiveLayerName}
        basemapType={basemapType}
        setShowChangeMap={setShowChangeMap}
        onGoHome={() => {
          if (districtSelectorRef.current) districtSelectorRef.current.clearSelection();
          setShowInstitutions(false);
        }}
      />

      {/* UI LAYERS (Hidden when Change Map is active) */}
      {!showChangeMap && (
        <>
          {/* 3. CHARTS */}
          {activeLayerName && activeLayerName !== 'brickfield' && (
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
        <ChangeMap
          onClose={() => setShowChangeMap(false)}
          showInstitutions={showInstitutions}
          onToggleInstitutions={() => setShowInstitutions(prev => !prev)}
          isCompareMode={isCompareMode}
          setIsCompareMode={setIsCompareMode}
          activeLayerName={activeLayerName}
          setActiveLayerName={setActiveLayerName}
          onChangeLayer={(layerName) => {
            if (layerName === 'all') {
              setActiveLayerName('all');
              setShowChangeMap(false);
            } else if (layerName === activeLayerName) {
              setActiveLayerName(null);
            } else {
              setActiveLayerName(layerName);
            }
          }}
          mapInstance={mapRef.current}
          mapInstanceLeft={mapLeft.current}
          mapInstanceRight={mapRight.current}
          basemap={basemapType}
          setBasemap={setBasemapType}
          selectedYear={selectedYear}
          setSelectedYear={setSelectedYear}
          satelliteProvider={satelliteProvider}
          setSatelliteProvider={setSatelliteProvider}
          selectedRegionGeoJson={selectedRegionGeoJson}
          setSelectedRegionGeoJson={setSelectedRegionGeoJson}
          onGoHome={() => {
             if (districtSelectorRef.current) districtSelectorRef.current.clearSelection();
             setShowInstitutions(false);
          }}
        />
      )}
    </div>
  );
};

export default MapComponent;