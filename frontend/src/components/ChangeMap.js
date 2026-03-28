"use client";

import React, { useEffect, useRef, useState } from 'react';
import '../css/LayerControls.css';
import DistrictSelector from './DistrictSelector';
import useInstitutions from '../hooks/useInstitutions';
import LayerControls from './LayerControls';

const ChangeMap = ({ 
  onClose, 
  showInstitutions, 
  onToggleInstitutions, 
  isCompareMode, 
  activeLayerName, 
  onChangeLayer,
  mapInstance,
  mapInstanceLeft,
  mapInstanceRight,
  basemap,
  setBasemap,
  selectedYear,
  setSelectedYear,
  satelliteProvider,
  setSatelliteProvider,
  selectedRegionGeoJson,
  setSelectedRegionGeoJson
}) => {

  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);

  // Institutions layer
  const institutionsGeoJson = useInstitutions(); // Retained if needed by DistrictSelector or for references

  // Ref for the year dropdown to handle outside clicks
  const yearDropdownRef = useRef(null);
  const providerDropdownRef = useRef(null);

  const API_URL = "http://103.81.70.74:8000";

  const LULC_CLASS_MAPPING = {
    'forest': 1,
    'built-up': 2,
    'water': 3,
    'farmland': 4,
    'meadow': 5
  };

  const changeTileUrl = activeLayerName === 'brickfield'
    ? `${API_URL}/brickfield_change/{z}/{x}/{y}.png`
    : (activeLayerName ? `${API_URL}/lulc_change/${LULC_CLASS_MAPPING[activeLayerName]}/{z}/{x}/{y}.png` : null);

  // Handle Dynamic Layer Update directly on parent map instances
  useEffect(() => {
    const activeMaps = isCompareMode
      ? [mapInstanceLeft, mapInstanceRight].filter(Boolean)
      : [mapInstance].filter(Boolean);

    activeMaps.forEach(m => {
      // Remove the old layer to prevent bleeding through and show instantaneous updates.
      if (m.getLayer('change-layer')) m.removeLayer('change-layer');
      if (m.getSource('change-source')) m.removeSource('change-source');

      if (changeTileUrl) {
        m.addSource('change-source', {
          type: 'raster',
          tiles: [changeTileUrl],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 24
        });

        const beforeId = m.getLayer('institutions-layer') ? 'institutions-layer' : undefined;
        m.addLayer({
          id: 'change-layer',
          type: 'raster',
          source: 'change-source',
          paint: {
            'raster-resampling': 'nearest',
            'raster-opacity': 0.6
          }
        }, beforeId);
      }
    });

    // Cleanup when component unmounts
    return () => {
      activeMaps.forEach(m => {
        if (m.getLayer('change-layer')) m.removeLayer('change-layer');
        if (m.getSource('change-source')) m.removeSource('change-source');
      });
    };
  }, [changeTileUrl, isCompareMode, mapInstance, mapInstanceLeft, mapInstanceRight]);

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

  return (
    <div className="fixed inset-0 z-[5000] bg-transparent flex flex-col pointer-events-none">
      {/* Container wrapper must allow pointer events through to the map.
          All interactive sub-elements must have pointer-events-auto */}
          
      {/* HEADER / BACK BUTTON */}
      <div className="absolute top-4 left-4 z-10 flex gap-4 pointer-events-auto">
        <button
          onClick={() => onClose()}
          className="bg-white px-4 py-2 rounded-full shadow font-bold text-red-600 hover:bg-gray-50 flex items-center gap-2 transition-colors"
        >
          <span>← Back</span>
        </button>
      </div>

      {/* DISTRICT SELECTOR */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <DistrictSelector
          mapInstance={isCompareMode ? mapInstanceLeft : mapInstance}
          mapInstanceRight={isCompareMode ? mapInstanceRight : null}
          isCompareMode={isCompareMode}
          mapView={basemap}
          activeLulcLayer={activeLayerName}
          onSelectRegion={setSelectedRegionGeoJson}
        />
      </div>

      {/* YEAR SELECTOR - Only in single mode with satellite basemap */}
      {!isCompareMode && basemap === 'satellite' && (
        <div className="absolute top-[66px] left-4 z-20 flex flex-col gap-3 pointer-events-auto">
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
                    onClick={(e) => { e.stopPropagation(); setSelectedYear("2023"); setIsYearDropdownOpen(false); }}
                  >2023</div>
                  <div
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm font-bold transition-colors ${selectedYear === "2019" ? 'text-blue-600 bg-blue-50/50' : 'text-gray-700'}`}
                    onClick={(e) => { e.stopPropagation(); setSelectedYear("2019"); setIsYearDropdownOpen(false); }}
                  >2019</div>
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
                    onClick={(e) => { e.stopPropagation(); setSatelliteProvider("bing"); setIsProviderDropdownOpen(false); }}
                  >Bing</div>
                  <div
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-50 text-sm font-bold transition-colors ${satelliteProvider === "esri" ? 'text-blue-600 bg-blue-50/50' : 'text-gray-700'}`}
                    onClick={(e) => { e.stopPropagation(); setSatelliteProvider("esri"); setIsProviderDropdownOpen(false); }}
                  >Esri</div>
                </div>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-600">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INSTITUTIONS TOGGLE */}
      {activeLayerName === 'brickfield' && (
        <div className={`absolute left-4 z-10 pointer-events-auto ${!isCompareMode && basemap === 'satellite' ? 'top-[118px]' : 'top-[66px]'}`}>
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
      )}

      {/* LEGEND - TOP RIGHT */}
      {activeLayerName && (
        <div className="absolute top-4 right-4 z-10 bg-white p-3.5 rounded-3xl shadow-md border border-gray-100 flex flex-col gap-3.5 pointer-events-auto" style={{ maxWidth: '240px', maxHeight: '90vh', overflowY: 'auto' }}>
          <h4 className="font-bold text-[15px] text-gray-800 border-b pb-1.5 text-center">Change Legend</h4>

          {/* Unchanged */}
          <div className="flex items-center gap-2.5">
            <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ backgroundColor: 'rgb(128, 128, 128)' }}></span>
            <span className="text-[13px] text-gray-700">Unchanged {activeLayerName === 'brickfield' ? 'Brickfield' : activeLayerName.charAt(0).toUpperCase() + activeLayerName.slice(1)}</span>
          </div>

          {/* LOST Section */}
          <div>
            <h5 className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Lost (Became...)</h5>
            <div className="space-y-1.5 pl-1">
              {activeLayerName !== 'forest' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ backgroundColor: 'rgb(0, 255, 255)' }}></span>
                  <span className="text-[13px] text-gray-700">Forest</span>
                </div>
              )}
              {activeLayerName !== 'built-up' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ backgroundColor: 'rgb(255, 0, 0)' }}></span>
                  <span className="text-[13px] text-gray-700">Built-up</span>
                </div>
              )}
              {activeLayerName !== 'water' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ backgroundColor: 'rgb(0, 0, 255)' }}></span>
                  <span className="text-[13px] text-gray-700">Water</span>
                </div>
              )}
              {activeLayerName !== 'farmland' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ backgroundColor: 'rgb(0, 255, 0)' }}></span>
                  <span className="text-[13px] text-gray-700">Farmland</span>
                </div>
              )}
              {activeLayerName !== 'meadow' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ backgroundColor: 'rgb(255, 255, 0)' }}></span>
                  <span className="text-[13px] text-gray-700">Meadow</span>
                </div>
              )}
            </div>
          </div>

          {/* GAINED Section */}
          <div>
            <h5 className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Gained (From...)</h5>
            <div className="space-y-1.5 pl-1">
              {activeLayerName !== 'forest' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(0, 255, 255), rgb(0, 255, 255) 3px, #fff 3px, #fff 5px)' }}></span>
                  <span className="text-[13px] text-gray-700">Forest</span>
                </div>
              )}
              {activeLayerName !== 'built-up' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(255, 0, 0), rgb(255, 0, 0) 3px, #fff 3px, #fff 5px)' }}></span>
                  <span className="text-[13px] text-gray-700">Built-up</span>
                </div>
              )}
              {activeLayerName !== 'water' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(0, 0, 255), rgb(0, 0, 255) 3px, #fff 3px, #fff 5px)' }}></span>
                  <span className="text-[13px] text-gray-700">Water</span>
                </div>
              )}
              {activeLayerName !== 'farmland' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(0, 255, 0), rgb(0, 255, 0) 3px, #fff 3px, #fff 5px)' }}></span>
                  <span className="text-[13px] text-gray-700">Farmland</span>
                </div>
              )}
              {activeLayerName !== 'meadow' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[2px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(255, 255, 0), rgb(255, 255, 0) 3px, #fff 3px, #fff 5px)' }}></span>
                  <span className="text-[13px] text-gray-700">Meadow</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* BASEMAP AND LAYER TOGGLE */}
      <div className="pointer-events-auto">
        <LayerControls
          mapView={basemap}
          toggleMapView={() => setBasemap(prev => prev === 'street' ? 'satellite' : 'street')}
          activeLulcLayer={activeLayerName}
          handleLayerToggle={onChangeLayer}
          selectedDataType="lulc"
        />
      </div>
    </div>
  );
};

export default ChangeMap;