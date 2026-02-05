'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import bbox from '@turf/bbox';
import '../css/DistrictSelector.css';

const DistrictSelector = ({ 
  mapInstance, 
  mapInstanceRight, 
  isCompareMode, 
  mapView, 
  activeLulcLayer,
  onSelectRegion 
}) => {
  const [geoDataADM3, setGeoDataADM3] = useState(null); // Upazilas
  const [geoDataADM2, setGeoDataADM2] = useState(null); // Districts
  
  const [districts, setDistricts] = useState([]);
  const [upazilaMap, setUpazilaMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredDistrict, setHoveredDistrict] = useState(null);

  // Selection State
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null); 
  const [selectedType, setSelectedType] = useState(null); // 'district' or 'upazila'

  const containerRef = useRef(null);

  // --- COLOR LOGIC UPDATE ---
  // Street View -> Black (Always). Satellite -> White (Always).
  // This overrides the previous LULC logic as requested.
  const boundaryColor = mapView === 'street' ? '#000000' : '#ffffff';

  // 1. Fetch Both Datasets
  useEffect(() => {
    Promise.all([
      fetch('/bgd_admbnda_adm3_bbs_20201113_simplified.json').then(r => r.json()),
      fetch('/bgd_admbnda_adm2_bbs_20201113_simplified.json').then(r => r.json())
    ]).then(([adm3Data, adm2Data]) => {
      setGeoDataADM3(adm3Data);
      setGeoDataADM2(adm2Data);
      processMenuStructure(adm3Data); // Use ADM3 to build the parent-child menu
      setLoading(false);
    }).catch(err => {
      console.error("Failed to load boundaries:", err);
      setLoading(false);
    });
  }, []);

  // 2. Build Menu (Using ADM3 because it links Upazila to District)
  const processMenuStructure = (data) => {
    const distSet = new Set();
    const upazilaMapping = {};

    data.features.forEach((feature) => {
      const district = feature.properties.ADM2_EN;
      const upazila = feature.properties.ADM3_EN;
      distSet.add(district);
      if (!upazilaMapping[district]) upazilaMapping[district] = [];
      if (!upazilaMapping[district].includes(upazila)) upazilaMapping[district].push(upazila);
    });

    setDistricts(Array.from(distSet).sort());
    Object.keys(upazilaMapping).forEach(d => upazilaMapping[d].sort());
    setUpazilaMap(upazilaMapping);
  };

  // --- CORE RENDERER ---
  const renderBoundary = useCallback((map) => {
    if (!map || !geoDataADM3 || !geoDataADM2 || !selectedLabel) return;

    // A. Add ADM2 Source (Districts)
    if (!map.getSource('source-adm2')) {
        map.addSource('source-adm2', { type: 'geojson', data: geoDataADM2 });
    }
    // B. Add ADM3 Source (Upazilas)
    if (!map.getSource('source-adm3')) {
        map.addSource('source-adm3', { type: 'geojson', data: geoDataADM3 });
    }

    // --- LOGIC: Which layer to show? ---
    const showAdm2 = selectedType === 'district';
    
    // C. Handle ADM2 Layer
    if (!map.getLayer('layer-adm2')) {
        map.addLayer({
            id: 'layer-adm2', type: 'line', source: 'source-adm2',
            layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': showAdm2 ? 'visible' : 'none' },
            paint: { 'line-color': boundaryColor, 'line-width': 3 }
        });
    } else {
        map.setLayoutProperty('layer-adm2', 'visibility', showAdm2 ? 'visible' : 'none');
        map.setPaintProperty('layer-adm2', 'line-color', boundaryColor);
        if (showAdm2) map.setFilter('layer-adm2', ['==', 'ADM2_EN', selectedLabel]);
    }

    // D. Handle ADM3 Layer
    if (!map.getLayer('layer-adm3')) {
        map.addLayer({
            id: 'layer-adm3', type: 'line', source: 'source-adm3',
            layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': !showAdm2 ? 'visible' : 'none' },
            paint: { 'line-color': boundaryColor, 'line-width': 3 }
        });
    } else {
        map.setLayoutProperty('layer-adm3', 'visibility', !showAdm2 ? 'visible' : 'none');
        map.setPaintProperty('layer-adm3', 'line-color', boundaryColor);
        if (!showAdm2) {
            // Filter by Upazila Name AND Parent District to ensure uniqueness
            map.setFilter('layer-adm3', ['all', ['==', 'ADM3_EN', selectedLabel], ['==', 'ADM2_EN', selectedDistrict]]);
        }
    }

    // Force active layer to top
    try {
        if (showAdm2) map.moveLayer('layer-adm2');
        else map.moveLayer('layer-adm3');
    } catch(e) {}

  }, [geoDataADM2, geoDataADM3, selectedLabel, selectedType, selectedDistrict, boundaryColor]);


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


  // --- HIGHLIGHT REGION (UPDATED LOGIC) ---
  const highlightRegion = (name, type, parentDistrict = null) => {
    if (!geoDataADM2 || !geoDataADM3) return;
    
    setSelectedLabel(name);
    setSelectedType(type);
    
    let targetFeature = null;

    if (type === 'district') {
        setSelectedDistrict(name); // Context is itself
        // Find in ADM2 File
        targetFeature = geoDataADM2.features.find(f => f.properties.ADM2_EN === name);
    } else {
        setSelectedDistrict(parentDistrict); // Context is parent
        // Find in ADM3 File
        targetFeature = geoDataADM3.features.find(f => f.properties.ADM3_EN === name && f.properties.ADM2_EN === parentDistrict);
    }

    if (targetFeature) {
        // --- Pass geometry to Parent for Statistics ---
        // We wrap it in an array because our BarChart logic expects { geometries: [...] }
        // Note: ADM2 districts are often MultiPolygons (1 feature), so this works perfectly.
        if (onSelectRegion) {
            onSelectRegion({ 
                geometries: [targetFeature.geometry],
                name: name 
            });
        }

        // --- ZOOM ---
        const featureCollection = { type: 'FeatureCollection', features: [targetFeature] };
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

    if (onSelectRegion) onSelectRegion(null);

    const remove = (map) => { 
        if (map && map.getLayer('layer-adm2')) map.setLayoutProperty('layer-adm2', 'visibility', 'none');
        if (map && map.getLayer('layer-adm3')) map.setLayoutProperty('layer-adm3', 'visibility', 'none');
    };
    remove(mapInstance);
    if (isCompareMode) remove(mapInstanceRight);
  };

  // Auto Scroll
  useEffect(() => {
    if (isOpen) {
        let target = hoveredDistrict;
        if (selectedType === 'district' && selectedLabel) target = selectedLabel;
        else if (selectedType === 'upazila' && selectedDistrict) target = selectedDistrict;
        
        if (target && target !== hoveredDistrict) setHoveredDistrict(target);

        setTimeout(() => {
            if (target) document.getElementById(`dist-item-${target}`)?.scrollIntoView({ block: 'center' });
            if (selectedType === 'upazila' && selectedLabel) document.getElementById(`upz-item-${selectedLabel}`)?.scrollIntoView({ block: 'center' });
        }, 10);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="district-selector-container" ref={containerRef}>
      <button className={`selector-button ${isOpen ? 'active' : ''}`} onClick={() => setIsOpen(!isOpen)} disabled={loading}>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {loading ? 'Loading...' : (selectedLabel || 'Select District / Upazila')}
        </span>
        {!loading && (selectedLabel ? <span className="clear-btn" onClick={handleClearSelection}>✕</span> : <span className="dropdown-arrow">▾</span>)}
      </button>
      {isOpen && (
        <div className="dropdown-panel">
          <div className="district-column">
            <div className="column-header">Districts</div>
            <div className="list-wrapper">
              {districts.map(dist => (
                <div key={dist} id={`dist-item-${dist}`} className={`list-item ${hoveredDistrict === dist ? 'hovered' : ''}`} onMouseEnter={() => setHoveredDistrict(dist)} onClick={() => highlightRegion(dist, 'district')}>
                  {dist}<span className="arrow">›</span>
                </div>
              ))}
            </div>
          </div>
          <div className="upazila-column">
             <div className="column-header">{hoveredDistrict ? `Upazilas of ${hoveredDistrict}` : 'Select a District'}</div>
             <div className="list-wrapper">
               {hoveredDistrict && upazilaMap[hoveredDistrict]?.map(upz => (
                 <div key={upz} id={`upz-item-${upz}`} className={`list-item ${selectedLabel === upz ? 'hovered' : ''}`} onClick={() => highlightRegion(upz, 'upazila', hoveredDistrict)}>
                   {upz}
                 </div>
               ))}
               {!hoveredDistrict && <div className="empty-state">Hover over a district to see sub-regions</div>}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DistrictSelector;