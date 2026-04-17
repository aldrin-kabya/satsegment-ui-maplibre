"use client";

import React from 'react';

const ZoomControls = ({ mapInstance, mapInstanceLeft, mapInstanceRight, isCompareMode }) => {
  const handleZoomIn = (e) => {
    e.stopPropagation();
    if (isCompareMode) {
      // In compare mode, the maps are synced, so zooming one usually zooms both
      if (mapInstanceLeft) mapInstanceLeft.zoomIn();
    } else {
      if (mapInstance) mapInstance.zoomIn();
    }
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    if (isCompareMode) {
      if (mapInstanceLeft) mapInstanceLeft.zoomOut();
    } else {
      if (mapInstance) mapInstance.zoomOut();
    }
  };

  return (
    <div className="absolute bottom-[38px] right-2 z-[10006] flex flex-col items-center bg-white/70 backdrop-blur rounded-full shadow-md border border-gray-200/40 pointer-events-auto overflow-hidden">
      <button
        onClick={handleZoomIn}
        className="w-8 h-8 flex items-center justify-center text-gray-800 hover:bg-white/40 transition-all active:scale-90"
        title="Zoom In"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <div className="w-5 h-[1px] bg-gray-400/20" />
      <button
        onClick={handleZoomOut}
        className="w-8 h-8 flex items-center justify-center text-gray-800 hover:bg-white/40 transition-all active:scale-90"
        title="Zoom Out"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
  );
};

export default ZoomControls;
