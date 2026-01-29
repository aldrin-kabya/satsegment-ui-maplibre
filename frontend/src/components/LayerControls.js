'use client';

import { useState } from 'react';
import '../css/LayerControls.css';

export default function LayerControls({ 
  mapView,           // 'street' or 'satellite'
  toggleMapView,     // function
  activeLulcLayer,   // string: 'all', 'forest', etc.
  handleLayerToggle, // function(layerName)
  selectedDataType   // 'lulc' or others
}) {

  const [isHovering, setIsHovering] = useState(false);

  // Determine basemap icon (street = satellite icon to switch to, and vice versa)
  const bgImage = mapView === 'street' ? '/satellite-icon.png' : '/default-icon.png';
  const labelText = isHovering ? (mapView === 'street' ? 'Satellite' : 'Map') : 'Layers';

  return (
    <div className="map-layer-controls">
      {/* Basemap Toggle */}
      <button
        onClick={toggleMapView}
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
                <path d="M12 18L3 11L12 4L21 11L12 18Z" stroke="white" strokeWidth="2.8" strokeLinejoin="miter"/>
                <path d="M1.5 16.5L12 25L22.5 16.5" stroke="white" strokeWidth="2.8" strokeLinecap="butt" strokeLinejoin="miter"/>
              </svg>
            )}
            <span className="toggle-text">{labelText}</span>
          </div>
        </div>
      </button>

      {/* Layers Panel */}
      <div className="layer-panel">
        {selectedDataType === 'lulc' ? (
          <>
            <button
              onClick={() => handleLayerToggle('all')}
              className={`layer-option-button ${activeLulcLayer === 'all' ? 'active' : ''}`}
            >
              <img src="/all-classes-icon-2.png" alt="All" />
              <span className="layer-option-text">All</span>
            </button>
            <button
              onClick={() => handleLayerToggle('farmland')}
              className={`layer-option-button ${activeLulcLayer === 'farmland' ? 'active' : ''}`}
            >
              <img src="/farmland-icon.png" alt="Farmland" />
              <span className="layer-option-text">Farmland</span>
            </button>
            <button
              onClick={() => handleLayerToggle('water')}
              className={`layer-option-button ${activeLulcLayer === 'water' ? 'active' : ''}`}
            >
              <img src="/water-icon.png" alt="Water" />
              <span className="layer-option-text">Water</span>
            </button>
            <button
              onClick={() => handleLayerToggle('forest')}
              className={`layer-option-button ${activeLulcLayer === 'forest' ? 'active' : ''}`}
            >
              <img src="/forest-icon.png" alt="Forest" />
              <span className="layer-option-text">Forest</span>
            </button>
            <button
              onClick={() => handleLayerToggle('built-up')}
              className={`layer-option-button ${activeLulcLayer === 'built-up' ? 'active' : ''}`}
            >
              <img src="/built-up-icon.png" alt="Built-up" />
              <span className="layer-option-text">Built-up</span>
            </button>
            <button
              onClick={() => handleLayerToggle('meadow')}
              className={`layer-option-button ${activeLulcLayer === 'meadow' ? 'active' : ''}`}
            >
              <img src="/meadow-icon.png" alt="Meadow" />
              <span className="layer-option-text">Meadow</span>
            </button>
            
            {/* NEW BRICKFIELD BUTTON */}
            <button
              onClick={() => handleLayerToggle('brickfield')}
              className={`layer-option-button ${activeLulcLayer === 'brickfield' ? 'active' : ''}`}
            >
              <img src="/brickfield-icon.png" alt="Brickfield" />
              <span className="layer-option-text">Brickfield</span>
            </button>
          </>
        ) : (
          <div className="text-sm px-2 text-gray-500">No options</div>
        )}
      </div>
    </div>
  );
}