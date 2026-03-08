"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Compare from '@maplibre/maplibre-gl-compare';
import '@maplibre/maplibre-gl-compare/dist/maplibre-gl-compare.css';
import '../css/LayerControls.css';
import DistrictSelector from './DistrictSelector';
import useInstitutions from '../hooks/useInstitutions';

const BrickfieldChangeMap = ({ onClose, initialViewState, showInstitutions, onToggleInstitutions, isCompareMode }) => {
  // --- Single-mode refs ---
  const singleMapContainer = useRef(null);
  const map = useRef(null);

  // --- Compare-mode refs ---
  const compareContainer = useRef(null);
  const leftContainer = useRef(null);
  const rightContainer = useRef(null);
  const mapLeft = useRef(null);
  const mapRight = useRef(null);
  const compareControl = useRef(null);

  const [basemap, setBasemap] = useState('satellite');
  const [selectedYear, setSelectedYear] = useState("2023");
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedRegionGeoJson, setSelectedRegionGeoJson] = useState(null);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [satelliteProvider, setSatelliteProvider] = useState("bing"); // 'bing' or 'esri'

  // Institutions layer
  const institutionsGeoJson = useInstitutions();

  // Ref for the year dropdown to handle outside clicks
  const yearDropdownRef = useRef(null);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const providerDropdownRef = useRef(null);

  const API_URL = "http://103.81.70.74:8000";

  const BASEMAPS = {
    street: { url: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '© OpenStreetMap contributors' },
    satellite: {
      "2019": { url: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default/MapServer/tile/11351/{z}/{y}/{x}", attribution: '© Esri, Wayback (2019)' },
      "2023": { url: "https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default/MapServer/tile/64776/{z}/{y}/{x}", attribution: '© Esri, Wayback (2023)' }
    }
  };

  const [isHovering, setIsHovering] = useState(false);
  const bgImage = basemap === 'street' ? '/satellite-icon.png' : '/default-icon.png';
  const buttonLabel = basemap === 'street' ? 'Satellite' : 'Map';

  const getEmptyStyle = () => ({ version: 8, sources: {}, layers: [] });

  const changeTileUrl = `${API_URL}/brickfield_change/{z}/{x}/{y}.png?t=${Date.now()}`;

  const bingUrl = `${API_URL}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=/media/drive2/armun/sat-segment/processed_cog/bing_satellite_2023_cog.tif&nodata=0`;

  // Helper: add basemap + change layer to a map instance
  const setupMapLayers = useCallback((mapInstance, basemapUrl) => {
    mapInstance.addSource('basemap', {
      type: 'raster',
      tiles: [basemapUrl],
      tileSize: 256,
      maxzoom: 19
    });
    mapInstance.addLayer({
      id: 'basemap-layer',
      type: 'raster',
      source: 'basemap'
    });

    mapInstance.addSource('change-source', {
      type: 'raster',
      tiles: [changeTileUrl],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 24
    });
    mapInstance.addLayer({
      id: 'change-layer',
      type: 'raster',
      source: 'change-source',
      paint: {
        'raster-resampling': 'nearest',
        'raster-opacity': 0.6
      }
    });
  }, [changeTileUrl]);

  // ==================== MAP INIT ====================
  useEffect(() => {
    const initCenter = initialViewState?.center || [90.419689, 23.7808405];
    const initZoom = initialViewState?.zoom || 12;
    const commonOptions = {
      style: getEmptyStyle(),
      center: initCenter,
      zoom: initZoom,
      attributionControl: false,
      maxZoom: 24
    };

    if (isCompareMode) {
      // --- COMPARE MODE: two maps with slider ---
      mapLeft.current = new maplibregl.Map({ container: leftContainer.current, ...commonOptions });
      mapRight.current = new maplibregl.Map({ container: rightContainer.current, ...commonOptions });
      compareControl.current = new Compare(mapLeft.current, mapRight.current, compareContainer.current, {});

      setTimeout(() => {
        if (mapLeft.current) mapLeft.current.resize();
        if (mapRight.current) mapRight.current.resize();
      }, 100);

      let leftReady = false;
      let rightReady = false;
      const checkBothReady = () => {
        if (leftReady && rightReady) setIsLoaded(true);
      };

      mapLeft.current.on('load', () => {
        setupMapLayers(mapLeft.current, BASEMAPS.satellite["2019"].url);
        leftReady = true;
        checkBothReady();
      });

      mapRight.current.on('load', () => {
        setupMapLayers(mapRight.current, BASEMAPS.satellite["2023"].url);
        rightReady = true;
        checkBothReady();
      });
    } else {
      // --- SINGLE MODE: existing behavior ---
      map.current = new maplibregl.Map({ container: singleMapContainer.current, ...commonOptions });

      map.current.on('load', () => {
        const basemapConfig = basemap === 'street' ? BASEMAPS.street : BASEMAPS.satellite[selectedYear];
        setupMapLayers(map.current, basemapConfig.url);
        setIsLoaded(true);
      });
    }

    return () => {
      if (compareControl.current) { compareControl.current.remove(); compareControl.current = null; }
      if (mapLeft.current) { mapLeft.current.remove(); mapLeft.current = null; }
      if (mapRight.current) { mapRight.current.remove(); mapRight.current = null; }
      if (map.current) { map.current.remove(); map.current = null; }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Basemap Toggle
  useEffect(() => {
    if (!isLoaded) return;

    const updateBasemapAndBing = (mapInstance, basemapUrl, bYear) => {
      if (!mapInstance) return;
      const source = mapInstance.getSource('basemap');
      if (source) source.setTiles([basemapUrl]);

      const showBing = basemap === 'satellite' && satelliteProvider === 'bing';

      if (showBing && bYear) {
        const cogPath = bYear === "2019"
          ? "/media/drive2/armun/sat-segment/processed_cog/bing_satellite_2019_cog.tif" 
          : "/media/drive2/armun/sat-segment/processed_cog/bing_satellite_2023_cog.tif";
        const urlToUse = `${API_URL}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=${cogPath}&nodata=0`;

        const bSource = mapInstance.getSource('bing-satellite');
        if (bSource) {
          bSource.setTiles([urlToUse]);
        } else {
          mapInstance.addSource('bing-satellite', {
            type: 'raster',
            tiles: [urlToUse],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 24,
            bounds: [88.010, 20.730, 92.680, 26.630] // Approximate bounds of Bangladesh
          });
          const beforeId = mapInstance.getLayer('change-layer') ? 'change-layer' : undefined;
          mapInstance.addLayer({
            id: 'bing-satellite-layer',
            type: 'raster',
            source: 'bing-satellite',
            paint: { 'raster-resampling': 'nearest' }
          }, beforeId);
        }
      } else {
        if (mapInstance.getLayer('bing-satellite-layer')) {
          mapInstance.removeLayer('bing-satellite-layer');
        }
        if (mapInstance.getSource('bing-satellite')) {
          mapInstance.removeSource('bing-satellite');
        }
      }
    };

    if (isCompareMode) {
      if (mapLeft.current && mapRight.current) {
        if (basemap === 'street') {
          updateBasemapAndBing(mapLeft.current, BASEMAPS.street.url, null);
          updateBasemapAndBing(mapRight.current, BASEMAPS.street.url, null);
        } else {
          updateBasemapAndBing(mapLeft.current, BASEMAPS.satellite["2019"].url, "2019");
          updateBasemapAndBing(mapRight.current, BASEMAPS.satellite["2023"].url, "2023");
        }

        // Re-add institutions if active
        if (showInstitutions) {
          [mapLeft.current, mapRight.current].forEach(m => {
            if (m.getSource('institutions-source')) {
              removeInstitutionsFromMap(m);
              setTimeout(() => addInstitutionsToMap(m), 0);
            }
          });
        }
      }
    } else {
      if (map.current) {
        if (basemap === 'street') {
          updateBasemapAndBing(map.current, BASEMAPS.street.url, null);
        } else {
          updateBasemapAndBing(map.current, BASEMAPS.satellite[selectedYear].url, selectedYear);
        }

        // Re-add institutions if active
        if (showInstitutions && map.current.getSource('institutions-source')) {
          removeInstitutionsFromMap(map.current);
          setTimeout(() => addInstitutionsToMap(map.current), 0);
        }
      }
    }
  }, [basemap, selectedYear, isLoaded, satelliteProvider, isCompareMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- INSTITUTIONS LAYER MANAGEMENT ---
  const addInstitutionsToMap = useCallback((mapInstance) => {
    if (!mapInstance || !institutionsGeoJson) return;
    if (!mapInstance.isStyleLoaded()) {
      mapInstance.once('idle', () => addInstitutionsToMap(mapInstance));
      return;
    }
    if (mapInstance.getSource('institutions-source')) return;

    // Create pin icon via canvas
    const size = 36;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(size / 2, size / 2 - 4, 10, Math.PI, 0, false);
    ctx.lineTo(size / 2, size - 2);
    ctx.closePath();
    ctx.fillStyle = '#E53E3E';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
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

  const removeInstitutionsFromMap = useCallback((mapInstance) => {
    if (!mapInstance) return;
    try {
      if (mapInstance.getLayer('institutions-layer')) mapInstance.removeLayer('institutions-layer');
      if (mapInstance.getSource('institutions-source')) mapInstance.removeSource('institutions-source');
    } catch (e) {
      // Map may have been removed or style not loaded — safe to ignore
    }
  }, []);

  useEffect(() => {
    // Get all active map instances
    const activeMaps = isCompareMode
      ? [mapLeft.current, mapRight.current].filter(Boolean)
      : [map.current].filter(Boolean);

    activeMaps.forEach(m => {
      if (showInstitutions) {
        addInstitutionsToMap(m);
      } else {
        removeInstitutionsFromMap(m);
      }
    });
  }, [showInstitutions, addInstitutionsToMap, removeInstitutionsFromMap, isLoaded, institutionsGeoJson, isCompareMode]);

  // Handle outside clicks for the Dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target)) {
        setIsYearDropdownOpen(false);
      }
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target)) {
        setIsProviderDropdownOpen(false);
      }
    };

    if (isYearDropdownOpen || isProviderDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isYearDropdownOpen, isProviderDropdownOpen]);

  // Helper to get current view state from whichever map is active
  const getCurrentViewState = () => {
    const activeMap = map.current || mapLeft.current;
    if (activeMap) {
      return {
        center: activeMap.getCenter(),
        zoom: activeMap.getZoom(),
        pitch: activeMap.getPitch(),
        bearing: activeMap.getBearing()
      };
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-[5000] bg-white">
      {/* HEADER / BACK BUTTON */}
      <div className="absolute top-4 left-4 z-10 flex gap-4">
        <button
          onClick={() => onClose(getCurrentViewState())}
          className="bg-white px-4 py-2 rounded-full shadow font-bold text-red-600 hover:bg-gray-50 flex items-center gap-2 transition-colors"
        >
          <span>← Back</span>
        </button>
      </div>

      {/* DISTRICT SELECTOR */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <DistrictSelector
          mapInstance={isCompareMode ? mapLeft.current : map.current}
          mapInstanceRight={isCompareMode ? mapRight.current : null}
          isCompareMode={isCompareMode}
          mapView={basemap}
          activeLulcLayer="brickfield"
          onSelectRegion={setSelectedRegionGeoJson}
        />
      </div>

      {/* YEAR SELECTOR - Only in single mode with satellite basemap */}
      {!isCompareMode && basemap === 'satellite' && (
        <div className="absolute top-[66px] left-4 z-20 flex flex-col gap-3">
          
          <div className="bg-white p-1 pr-1.5 rounded-full shadow-md flex items-center gap-1.5 border border-gray-200 transition-all hover:shadow-lg w-max">
            <span className="pl-2 font-bold text-gray-700 text-sm">Year</span>
            <div className="relative" ref={yearDropdownRef}>
              <div
                className="appearance-none bg-white border border-gray-300 rounded-full py-1 pl-3 pr-8 font-bold text-sm text-gray-800 cursor-pointer transition-colors hover:border-gray-400 relative"
                onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
              >
                {selectedYear}

                <div className={`absolute top-full left-0 mt-2 w-[120px] bg-white border border-gray-100 rounded-[14px] shadow-lg overflow-hidden transition-all duration-200 z-50 ${isYearDropdownOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
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

            {/* SATELLITE PROVIDER PART */}
            <div className="h-5 w-px bg-gray-300 mx-0.5" />
            <div className="relative" ref={providerDropdownRef}>
              <div
                className="appearance-none bg-white border border-gray-300 rounded-full py-1 pl-3 pr-8 font-bold text-sm text-gray-800 cursor-pointer transition-colors hover:border-gray-400 relative"
                onClick={() => setIsProviderDropdownOpen(!isProviderDropdownOpen)}
              >
                {satelliteProvider === 'bing' ? 'Bing' : 'Esri'}

                <div className={`absolute top-full left-0 mt-2 w-[100px] bg-white border border-gray-100 rounded-[14px] shadow-lg overflow-hidden transition-all duration-200 z-50 ${isProviderDropdownOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
                  <div
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm font-bold transition-colors ${satelliteProvider === "bing" ? 'text-blue-600 bg-blue-50/50' : 'text-gray-700'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSatelliteProvider("bing");
                      setIsProviderDropdownOpen(false);
                    }}
                  >
                    Bing
                  </div>
                  <div
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm font-bold transition-colors ${satelliteProvider === "esri" ? 'text-blue-600 bg-blue-50/50' : 'text-gray-700'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSatelliteProvider("esri");
                      setIsProviderDropdownOpen(false);
                    }}
                  >
                    Esri
                  </div>
                </div>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* INSTITUTIONS TOGGLE - Below Year Selector */}
      <div className={`absolute left-4 z-10 ${!isCompareMode && basemap === 'satellite' ? 'top-[118px]' : 'top-[66px]'}`}>
        <div className="flex items-center gap-2 bg-white pl-3 pr-3 py-1.5 rounded-full shadow-md border border-gray-200">
          <span className="text-sm font-bold text-gray-700">Institutions</span>
          <button
            onClick={() => onToggleInstitutions()}
            className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${showInstitutions ? 'bg-red-500' : 'bg-gray-300'}`}
            role="switch"
            aria-checked={showInstitutions}
          >
            <span className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform duration-200 ${showInstitutions ? 'translate-x-[18px]' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>

      {/* LEGEND - TOP RIGHT */}
      <div className="absolute top-4 right-4 z-10 bg-white p-3.5 rounded-3xl shadow-md border border-gray-100 flex flex-col gap-3.5" style={{ maxWidth: '240px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h4 className="font-bold text-[15px] text-gray-800 border-b pb-1.5 text-center">Change Legend</h4>

        {/* Unchanged */}
        <div className="flex items-center gap-2.5">
          <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ backgroundColor: 'rgb(128, 128, 128)' }}></span>
          <span className="text-[13px] text-gray-700">Unchanged Brickfield</span>
        </div>

        {/* LOST Section */}
        <div>
          <h5 className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Lost (Became...)</h5>
          <div className="space-y-1.5 pl-1">
            <div className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ backgroundColor: 'rgb(0, 255, 255)' }}></span>
              <span className="text-[13px] text-gray-700">Forest</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ backgroundColor: 'rgb(255, 0, 0)' }}></span>
              <span className="text-[13px] text-gray-700">Built-up</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ backgroundColor: 'rgb(0, 0, 255)' }}></span>
              <span className="text-[13px] text-gray-700">Water</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ backgroundColor: 'rgb(0, 255, 0)' }}></span>
              <span className="text-[13px] text-gray-700">Farmland</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ backgroundColor: 'rgb(255, 255, 0)' }}></span>
              <span className="text-[13px] text-gray-700">Meadow</span>
            </div>
          </div>
        </div>

        {/* GAINED Section */}
        <div>
          <h5 className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Gained (From...)</h5>
          <div className="space-y-1.5 pl-1">
            <div className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(0, 255, 255), rgb(0, 255, 255) 3px, #fff 3px, #fff 5px)' }}></span>
              <span className="text-[13px] text-gray-700">Forest</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(255, 0, 0), rgb(255, 0, 0) 3px, #fff 3px, #fff 5px)' }}></span>
              <span className="text-[13px] text-gray-700">Built-up</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(0, 0, 255), rgb(0, 0, 255) 3px, #fff 3px, #fff 5px)' }}></span>
              <span className="text-[13px] text-gray-700">Water</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(0, 255, 0), rgb(0, 255, 0) 3px, #fff 3px, #fff 5px)' }}></span>
              <span className="text-[13px] text-gray-700">Farmland</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(255, 255, 0), rgb(255, 255, 0) 3px, #fff 3px, #fff 5px)' }}></span>
              <span className="text-[13px] text-gray-700">Meadow</span>
            </div>
          </div>
        </div>
      </div>

      {/* BASEMAP TOGGLE */}
      <div className="map-layer-controls">
        <button
          onClick={() => setBasemap(prev => prev === 'street' ? 'satellite' : 'street')}
          className="map-type-button"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div
            className="toggle-bg"
            style={{ backgroundImage: `url(${bgImage})` }}
          >
            <div className="map-type-content">
              {!isHovering && (
                <svg className="map-type-icon-svg" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 18L3 11L12 4L21 11L12 18Z" stroke="white" strokeWidth="2.8" strokeLinejoin="miter" />
                  <path d="M1.5 16.5L12 25L22.5 16.5" stroke="white" strokeWidth="2.8" strokeLinecap="butt" strokeLinejoin="miter" />
                </svg>
              )}
              <span className="toggle-text">{buttonLabel}</span>
            </div>
          </div>
        </button>
      </div>

      {/* MAP CONTAINER(S) */}
      {isCompareMode ? (
        <div ref={compareContainer} className="w-full h-full">
          <div ref={leftContainer} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          <div ref={rightContainer} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
        </div>
      ) : (
        <div ref={singleMapContainer} className="w-full h-full" />
      )}
    </div>
  );
};

export default BrickfieldChangeMap;