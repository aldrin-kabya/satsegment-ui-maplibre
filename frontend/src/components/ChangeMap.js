"use client";

import React, { useEffect, useRef, useState } from 'react';
import '../css/LayerControls.css';
import OpacitySlider from './OpacitySlider';
import DistrictSelector from './DistrictSelector';
import useInstitutions from '../hooks/useInstitutions';
import LayerControls from './LayerControls';


const ChangeMap = ({
  onClose,
  showInstitutions,
  onToggleInstitutions,
  isCompareMode,
  setIsCompareMode,
  activeLayerName,
  setActiveLayerName,
  onChangeLayer,
  onGoHome,
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
  setSelectedRegionGeoJson,
  changeOpacity = 0.6,
  onChangeOpacityChange,
  defaultChangeOpacity = 0.6
}) => {

  // Institutions layer
  const institutionsGeoJson = useInstitutions(); // Retained if needed by DistrictSelector or for references

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
    let isActive = true;

    const activeMaps = isCompareMode
      ? [mapInstanceLeft, mapInstanceRight].filter(Boolean)
      : [mapInstance].filter(Boolean);

    const applyChangeLayer = (mapIns) => {
      if (!isActive) return;

      // Remove the old layer to prevent bleeding through and show instantaneous updates.
      if (mapIns.getLayer('change-layer')) mapIns.removeLayer('change-layer');
      if (mapIns.getSource('change-source')) mapIns.removeSource('change-source');

      if (changeTileUrl) {
        mapIns.addSource('change-source', {
          type: 'raster',
          tiles: [changeTileUrl],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 24
        });

        let beforeId = undefined;
        if (mapIns.getLayer('layer-draw-mask')) beforeId = 'layer-draw-mask';
        else if (mapIns.getLayer('layer-mask')) beforeId = 'layer-mask';
        else if (mapIns.getLayer('layer-adm0')) beforeId = 'layer-adm0';
        else if (mapIns.getLayer('institutions-layer')) beforeId = 'institutions-layer';
        mapIns.addLayer({
          id: 'change-layer',
          type: 'raster',
          source: 'change-source',
          paint: {
            'raster-resampling': 'nearest',
            'raster-opacity': changeOpacity
          }
        }, beforeId);
      }
    };

    activeMaps.forEach(m => {
      if (m.isStyleLoaded()) {
        applyChangeLayer(m);
      } else {
        m.once('idle', () => applyChangeLayer(m));
      }
    });

    // Cleanup when component unmounts
    return () => {
      isActive = false;
      activeMaps.forEach(m => {
        try {
          if (m.getLayer('change-layer')) m.removeLayer('change-layer');
          if (m.getSource('change-source')) m.removeSource('change-source');
        } catch (e) { }
      });
    };
  }, [changeTileUrl, isCompareMode, mapInstance, mapInstanceLeft, mapInstanceRight]);

  // Live-update change-layer opacity when slider moves
  useEffect(() => {
    const activeMaps = isCompareMode
      ? [mapInstanceLeft, mapInstanceRight].filter(Boolean)
      : [mapInstance].filter(Boolean);

    activeMaps.forEach(m => {
      if (m.getLayer && m.getLayer('change-layer')) {
        m.setPaintProperty('change-layer', 'raster-opacity', changeOpacity);
      }
    });
  }, [changeOpacity, isCompareMode, mapInstance, mapInstanceLeft, mapInstanceRight]);



  return (
    <div className="fixed inset-0 z-[5000] bg-transparent flex flex-col pointer-events-none">
      {/* Container wrapper must allow pointer events through to the map.
          All interactive sub-elements must have pointer-events-auto */}







      {/* LEGEND - TOP RIGHT */}
      {activeLayerName && (
        <div className="absolute top-4 right-4 z-10 bg-white/85 backdrop-blur-md px-5 pt-3.5 pb-6 rounded-[19px] shadow-md border border-gray-100 flex flex-col gap-2 pointer-events-auto" style={{ maxWidth: '240px', maxHeight: '90vh', overflowY: 'auto' }}>
          <div className="border-b pb-1.5 text-center">
            <h4 className="font-bold text-[15px] text-gray-800">Change Legend</h4>
            <p className="text-[15px] text-gray-800 font-bold">{activeLayerName === 'brickfield' ? 'Brickfield' : activeLayerName.charAt(0).toUpperCase() + activeLayerName.slice(1)}</p>
          </div>

          {/* Unchanged */}
          <div className="flex items-center gap-2.5 pl-1">
            <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[4px]" style={{ backgroundColor: 'rgb(128, 128, 128)' }}></span>
            <span className="text-[13px] text-gray-700">Unchanged</span>
          </div>

          {/* LOST Section */}
          <div className="mt-1">
            <h5 className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Lost (Became...)</h5>
            <div className="space-y-1.5 pl-1">
              {activeLayerName !== 'forest' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[4px]" style={{ backgroundColor: 'rgb(0, 255, 255)' }}></span>
                  <span className="text-[13px] text-gray-700">Forest</span>
                </div>
              )}
              {activeLayerName !== 'built-up' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[4px]" style={{ backgroundColor: 'rgb(255, 0, 0)' }}></span>
                  <span className="text-[13px] text-gray-700">Built-up</span>
                </div>
              )}
              {activeLayerName !== 'water' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[4px]" style={{ backgroundColor: 'rgb(0, 0, 255)' }}></span>
                  <span className="text-[13px] text-gray-700">Water</span>
                </div>
              )}
              {activeLayerName !== 'farmland' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[4px]" style={{ backgroundColor: 'rgb(0, 255, 0)' }}></span>
                  <span className="text-[13px] text-gray-700">Farmland</span>
                </div>
              )}
              {activeLayerName !== 'meadow' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[4px]" style={{ backgroundColor: 'rgb(255, 255, 0)' }}></span>
                  <span className="text-[13px] text-gray-700">Meadow</span>
                </div>
              )}
            </div>
          </div>

          {/* GAINED Section */}
          <div className="mt-1">
            <h5 className="text-[11px] font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Gained (From...)</h5>
            <div className="space-y-1.5 pl-1">
              {activeLayerName !== 'forest' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[4px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(0, 255, 255), rgb(0, 255, 255) 3px, #fff 3px, #fff 5px)' }}></span>
                  <span className="text-[13px] text-gray-700">Forest</span>
                </div>
              )}
              {activeLayerName !== 'built-up' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[4px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(255, 0, 0), rgb(255, 0, 0) 3px, #fff 3px, #fff 5px)' }}></span>
                  <span className="text-[13px] text-gray-700">Built-up</span>
                </div>
              )}
              {activeLayerName !== 'water' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[4px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(0, 0, 255), rgb(0, 0, 255) 3px, #fff 3px, #fff 5px)' }}></span>
                  <span className="text-[13px] text-gray-700">Water</span>
                </div>
              )}
              {activeLayerName !== 'farmland' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[4px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(0, 255, 0), rgb(0, 255, 0) 3px, #fff 3px, #fff 5px)' }}></span>
                  <span className="text-[13px] text-gray-700">Farmland</span>
                </div>
              )}
              {activeLayerName !== 'meadow' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-[18px] h-[18px] block border border-gray-300 rounded-[4px]" style={{ background: 'repeating-linear-gradient(-45deg, rgb(255, 255, 0), rgb(255, 255, 0) 3px, #fff 3px, #fff 5px)' }}></span>
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

      {/* OPACITY SLIDER for change layer */}
      {activeLayerName && onChangeOpacityChange && (
        <div className="pointer-events-auto">
          <OpacitySlider
            opacity={changeOpacity}
            defaultOpacity={defaultChangeOpacity}
            onOpacityChange={onChangeOpacityChange}
          />
        </div>
      )}
    </div>
  );
};

export default ChangeMap;