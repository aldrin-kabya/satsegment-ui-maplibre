'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import bbox from '@turf/bbox';
import '../css/DistrictSelector.css';

const DistrictSelector = ({ mapInstance, mapInstanceRight, isCompareMode, mapView, activeLulcLayer }) => {
  const [geoData, setGeoData] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [upazilaMap, setUpazilaMap] = useState({});
  const [upazilaToDistrict, setUpazilaToDistrict] = useState({});
  
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredDistrict, setHoveredDistrict] = useState(null);
  const [loading, setLoading] = useState(true);

  // Selection State
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null); 
  const [selectedType, setSelectedType] = useState(null);

  const containerRef = useRef(null);

  // --- COLOR LOGIC ---
  const isLulcActive = activeLulcLayer !== null;
  const boundaryColor = isLulcActive 
    ? '#ffffff' 
    : (mapView === 'street' ? '#2563eb' : '#ffffff');

  // 1. Fetch Data
  useEffect(() => {
    fetch('/bgd_admbnda_adm3_bbs_20201113_simplified.json')
      .then((res) => res.json())
      .then((data) => {
        setGeoData(data);
        processGeoData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load boundaries:", err);
        setLoading(false);
      });
  }, []);

  const processGeoData = (data) => {
    const distSet = new Set();
    const upazilaMapping = {};
    const childToParent = {}; 

    data.features.forEach((feature) => {
      const district = feature.properties.ADM2_EN;
      const upazila = feature.properties.ADM3_EN;
      distSet.add(district);
      childToParent[upazila] = district;
      if (!upazilaMapping[district]) upazilaMapping[district] = [];
      if (!upazilaMapping[district].includes(upazila)) upazilaMapping[district].push(upazila);
    });

    setDistricts(Array.from(distSet).sort());
    Object.keys(upazilaMapping).forEach(d => upazilaMapping[d].sort());
    setUpazilaMap(upazilaMapping);
    setUpazilaToDistrict(childToParent);
  };

  // --- CORE RENDERER ---
  const renderBoundary = useCallback((map) => {
    if (!map || !geoData || !selectedLabel) return;

    if (!map.getSource('boundary-source')) {
        map.addSource('boundary-source', { type: 'geojson', data: geoData });
    }

    let filterExpression;
    if (selectedType === 'district') {
        filterExpression = ['==', 'ADM2_EN', selectedLabel];
    } else {
        filterExpression = ['all', ['==', 'ADM3_EN', selectedLabel], ['==', 'ADM2_EN', selectedDistrict]];
    }

    if (!map.getLayer('boundary-layer')) {
        map.addLayer({
            id: 'boundary-layer',
            type: 'line',
            source: 'boundary-source',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': boundaryColor, 'line-width': 3, 'line-opacity': 1 },
            filter: filterExpression
        });
    } else {
        map.setPaintProperty('boundary-layer', 'line-color', boundaryColor);
        map.setFilter('boundary-layer', filterExpression);
        try { map.moveLayer('boundary-layer'); } catch (e) {}
    }
  }, [geoData, selectedLabel, selectedType, selectedDistrict, boundaryColor]);

  // --- PERSISTENCE ---
  useEffect(() => {
    const maps = [mapInstance, mapInstanceRight].filter(Boolean);
    const handleStyleData = (e) => { if (selectedLabel) renderBoundary(e.target); };

    maps.forEach(map => {
        if (map.isStyleLoaded() || map.loaded()) renderBoundary(map);
        else map.once('load', () => renderBoundary(map));
        map.on('styledata', handleStyleData);
    });

    return () => { maps.forEach(map => map.off('styledata', handleStyleData)); };
  }, [mapInstance, mapInstanceRight, renderBoundary, selectedLabel]);

  // --- USER INTERACTION ---
  const highlightRegion = (name, type, parentDistrict = null) => {
    if (!geoData) return;
    
    setSelectedLabel(name);
    setSelectedType(type);
    if (type === 'upazila') setSelectedDistrict(parentDistrict);
    else setSelectedDistrict(name);

    const relevantFeatures = geoData.features.filter(f => {
        if (type === 'district') return f.properties.ADM2_EN === name;
        if (type === 'upazila') return f.properties.ADM3_EN === name && f.properties.ADM2_EN === parentDistrict;
        return false;
    });

    if (relevantFeatures.length > 0) {
        const featureCollection = { type: 'FeatureCollection', features: relevantFeatures };
        const [minX, minY, maxX, maxY] = bbox(featureCollection);
        if (mapInstance) mapInstance.fitBounds([[minX, minY], [maxX, maxY]], { padding: 50 });
        if (isCompareMode && mapInstanceRight) mapInstanceRight.fitBounds([[minX, minY], [maxX, maxY]], { padding: 50 });
    }
    setIsOpen(false);
  };

  const handleClearSelection = (e) => {
    e.stopPropagation();
    setSelectedLabel(null);
    setSelectedDistrict(null);
    setSelectedType(null);
    setHoveredDistrict(null);
    setIsOpen(false);

    const remove = (map) => { if (map && map.getLayer('boundary-layer')) map.removeLayer('boundary-layer'); };
    remove(mapInstance);
    if (isCompareMode) remove(mapInstanceRight);
  };

  // --- FIX: AUTO SCROLL TO SELECTION ---
  useEffect(() => {
    if (isOpen) {
        // Determine which district to show/highlight
        let targetDistrict = hoveredDistrict;
        
        // If we have a selection, that takes priority
        if (selectedType === 'district' && selectedLabel) {
            targetDistrict = selectedLabel;
        } else if (selectedType === 'upazila' && selectedDistrict) {
            targetDistrict = selectedDistrict;
        }

        // 1. Restore the Right Column view (simulate hover)
        if (targetDistrict && targetDistrict !== hoveredDistrict) {
            setHoveredDistrict(targetDistrict);
        }

        // 2. Scroll Logic (Wrapped in timeout to allow render)
        setTimeout(() => {
            // Scroll Left Column (District)
            if (targetDistrict) {
                const distEl = document.getElementById(`dist-item-${targetDistrict}`);
                if (distEl) distEl.scrollIntoView({ block: 'center' });
            }

            // Scroll Right Column (Upazila) - only if Upazila is selected
            if (selectedType === 'upazila' && selectedLabel) {
                const upzEl = document.getElementById(`upz-item-${selectedLabel}`);
                if (upzEl) upzEl.scrollIntoView({ block: 'center' });
            }
        }, 10);
    }
  }, [isOpen]); // Only run when menu opens

  // Click Outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="district-selector-container" ref={containerRef}>
      <button 
        className={`selector-button ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {loading ? 'Loading...' : (selectedLabel || 'Select District / Upazila')}
        </span>

        {!loading && (
          selectedLabel ? (
            <span className="clear-btn" onClick={handleClearSelection}>✕</span>
          ) : (
            <span className="dropdown-arrow">▾</span>
          )
        )}
      </button>

      {isOpen && (
        <div className="dropdown-panel">
          <div className="district-column">
            <div className="column-header">Districts</div>
            <div className="list-wrapper">
              {districts.map(dist => (
                <div 
                  key={dist}
                  id={`dist-item-${dist}`} 
                  className={`list-item ${hoveredDistrict === dist ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredDistrict(dist)}
                  onClick={() => highlightRegion(dist, 'district')}
                >
                  {dist}
                  <span className="arrow">›</span>
                </div>
              ))}
            </div>
          </div>

          <div className="upazila-column">
             <div className="column-header">
               {hoveredDistrict ? `Upazilas of ${hoveredDistrict}` : 'Select a District'}
             </div>
             <div className="list-wrapper">
               {hoveredDistrict && upazilaMap[hoveredDistrict]?.map(upz => (
                 <div 
                   key={upz} 
                   id={`upz-item-${upz}`} 
                   className={`list-item ${selectedLabel === upz ? 'hovered' : ''}`}
                   onClick={() => highlightRegion(upz, 'upazila', hoveredDistrict)}
                 >
                   {upz}
                 </div>
               ))}
               {!hoveredDistrict && (
                 <div className="empty-state">Hover over a district to see sub-regions</div>
               )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistrictSelector;