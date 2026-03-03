"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../css/LayerControls.css';
import DistrictSelector from './DistrictSelector';
import useInstitutions from '../hooks/useInstitutions';

const BrickfieldChangeMap = ({ onClose, initialViewState }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [basemap, setBasemap] = useState('satellite');
  const [selectedYear, setSelectedYear] = useState("2023");
  // New state to track if map is ready
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedRegionGeoJson, setSelectedRegionGeoJson] = useState(null);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);

  // Institutions layer
  const institutionsGeoJson = useInstitutions();
  const [showInstitutions, setShowInstitutions] = useState(false);

  // Ref for the year dropdown to handle outside clicks
  const yearDropdownRef = useRef(null);

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

  useEffect(() => {
    if (map.current) return;

    // Use initialViewState if provided, otherwise default
    const initCenter = initialViewState?.center || [90.419689, 23.7808405];
    const initZoom = initialViewState?.zoom || 12;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: { version: 8, sources: {}, layers: [] },
      center: initCenter,
      zoom: initZoom,
      attributionControl: false
    });

    map.current.on('load', () => {
      // 1. Basemap Source
      const basemapConfig = basemap === 'street' ? BASEMAPS.street : BASEMAPS.satellite[selectedYear];
      map.current.addSource('basemap', {
        type: 'raster',
        tiles: [basemapConfig.url],
        tileSize: 256
      });
      map.current.addLayer({
        id: 'basemap-layer',
        type: 'raster',
        source: 'basemap'
      });

      // 2. Change Detection Source
      map.current.addSource('change-source', {
        type: 'raster',
        // ADDED: ?t=${Date.now()}
        tiles: [`${API_URL}/brickfield_change/{z}/{x}/{y}.png?t=${Date.now()}`],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 24
      });
      map.current.addLayer({
        id: 'change-layer',
        type: 'raster',
        source: 'change-source',
        paint: {
          'raster-resampling': 'nearest',
          'raster-opacity': 0.6
        }
      });

      // Mark map as ready
      setIsLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Handle Basemap Toggle (Safe Version)
  useEffect(() => {
    // Only run if map is fully loaded
    if (!isLoaded || !map.current) return;

    const source = map.current.getSource('basemap');
    if (source) {
      const basemapConfig = basemap === 'street' ? BASEMAPS.street : BASEMAPS.satellite[selectedYear];
      source.setTiles([basemapConfig.url]);
    }

    // Re-add institutions layer if it was active (ensures it stays on top)
    if (showInstitutions && map.current.getSource('institutions-source')) {
      if (map.current.getLayer('institutions-layer')) map.current.removeLayer('institutions-layer');
      if (map.current.getSource('institutions-source')) map.current.removeSource('institutions-source');
      // Let the effect re-add it
      setTimeout(() => addInstitutionsLayer(), 0);
    }
  }, [basemap, selectedYear, isLoaded]);

  // --- INSTITUTIONS LAYER MANAGEMENT ---
  const addInstitutionsLayer = useCallback(() => {
    if (!map.current || !institutionsGeoJson || !isLoaded) return;
    if (map.current.getSource('institutions-source')) return;

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

    if (!map.current.hasImage('institution-pin')) {
      map.current.addImage('institution-pin', ctx.getImageData(0, 0, size, size), {
        pixelRatio: 2,
      });
    }

    map.current.addSource('institutions-source', {
      type: 'geojson',
      data: institutionsGeoJson,
    });

    map.current.addLayer({
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
  }, [institutionsGeoJson, isLoaded]);

  const removeInstitutionsLayer = useCallback(() => {
    if (!map.current) return;
    if (map.current.getLayer('institutions-layer')) map.current.removeLayer('institutions-layer');
    if (map.current.getSource('institutions-source')) map.current.removeSource('institutions-source');
  }, []);

  useEffect(() => {
    if (showInstitutions) {
      addInstitutionsLayer();
    } else {
      removeInstitutionsLayer();
    }
  }, [showInstitutions, addInstitutionsLayer, removeInstitutionsLayer]);

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

  return (
    <div className="fixed inset-0 z-[5000] bg-white">
      {/* HEADER / BACK BUTTON */}
      <div className="absolute top-4 left-4 z-10 flex gap-4">
        <button
          onClick={() => {
            if (map.current) {
              const center = map.current.getCenter();
              const zoom = map.current.getZoom();
              const pitch = map.current.getPitch();
              const bearing = map.current.getBearing();
              onClose({ center, zoom, pitch, bearing });
            } else {
              onClose(null);
            }
          }}
          className="bg-white px-4 py-2 rounded-full shadow font-bold text-red-600 hover:bg-gray-50 flex items-center gap-2 transition-colors"
        >
          <span>← Back</span>
        </button>
      </div>

      {/* DISTRICT SELECTOR */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
        <DistrictSelector
          mapInstance={map.current}
          isCompareMode={false}
          mapView={basemap}
          activeLulcLayer="brickfield"
          onSelectRegion={setSelectedRegionGeoJson}
        />
      </div>

      {/* YEAR SELECTOR - TOP LEFT (Below Back Button) */}
      {basemap === 'satellite' && (
        <div className="absolute top-[66px] left-4 z-20 bg-white p-1 pr-1.5 rounded-full shadow-md flex items-center gap-1.5 border border-gray-200 transition-all hover:shadow-lg">
          <span className="pl-2 font-bold text-gray-700 text-sm">Year</span>
          <div className="relative" ref={yearDropdownRef}>
            <div
              className="appearance-none bg-white border border-gray-300 rounded-full py-1 pl-3 pr-8 font-bold text-sm text-gray-800 cursor-pointer transition-colors hover:border-gray-400 relative"
              onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
            >
              {selectedYear}

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

      {/* INSTITUTIONS TOGGLE - Below Year Selector */}
      <div className={`absolute left-4 z-10 ${basemap === 'satellite' ? 'top-[116px]' : 'top-[66px]'}`}>
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

      {/* BASEMAP TOGGLE - BOTTOM LEFT (Styled like LayerControls) */}
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

      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};

export default BrickfieldChangeMap;