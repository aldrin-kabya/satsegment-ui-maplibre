import React, { useState, useRef, useEffect } from 'react';
import '../css/Sidebar.css';

const Icons = {
  Hamburger: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>),
  Home: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>),
  Year: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>),
  Satellite: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7 9 3 5 7l4 4"></path><path d="m17 11 4 4-4 4-4-4"></path><path d="m8 12 4 4 6-6-4-4Z"></path><path d="m16 8 3-3"></path><path d="M9 21a6 6 0 0 0-6-6"></path></svg>),
  Compare: () => (
    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
      <line x1="12" y1="2" x2="12" y2="22"></line>
      <polyline points="10 10 8 12 10 14" strokeWidth="1.2"></polyline>
      <polyline points="14 10 16 12 14 14" strokeWidth="1.2"></polyline>
    </svg>
  ),
  Institution: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"></line><line x1="6" y1="18" x2="6" y2="11"></line><line x1="10" y1="18" x2="10" y2="11"></line><line x1="14" y1="18" x2="14" y2="11"></line><line x1="18" y1="18" x2="18" y2="11"></line><polygon points="12 2 20 7 4 7 12 2"></polygon></svg>),
  LulcChanges: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 3 4 4-4 4"></path><path d="M20 7H4"></path><path d="m8 21-4-4 4-4"></path><path d="M4 17h16"></path></svg>),
  ActiveLocation: () => (
    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 2v4"></path>
      <path d="M12 18v4"></path>
      <path d="M4 12H2"></path>
      <path d="M22 12h-2"></path>
    </svg>
  ),
  DrawRectangle: () => (
    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="4.5" x2="21" y2="4.5" strokeDasharray="3 3" />
      <line x1="21" y1="4.5" x2="21" y2="19.5" strokeDasharray="3 3" />
      <line x1="21" y1="19.5" x2="1" y2="19.5" strokeDasharray="3 3" />
      <line x1="1" y1="19.5" x2="1" y2="4.5" strokeDasharray="3 3" />
      <line x1="21" y1="16.5" x2="21" y2="22.5" strokeWidth="2" />
      <line x1="18" y1="19.5" x2="24" y2="19.5" strokeWidth="2" />
    </svg>
  ),
  DrawPolygon: () => (
    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="22" y2="9" strokeDasharray="3 3" />
      <line x1="22" y1="9" x2="18" y2="21" strokeDasharray="3 3" />
      <line x1="18" y1="21" x2="6" y2="21" strokeDasharray="3 3" />
      <line x1="6" y1="21" x2="2" y2="9" strokeDasharray="3 3" />
      <line x1="2" y1="9" x2="12" y2="2" strokeDasharray="3 3" />
    </svg>
  ),
  Ruler: () => (
    <svg className="sidebar-icon" viewBox="-3 -3 30 30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="miter">
      <g transform="rotate(-45 12 12)">
        <rect x="0" y="7" width="24" height="10" />
        <line x1="4" y1="7" x2="4" y2="11" />
        <line x1="8" y1="7" x2="8" y2="14" />
        <line x1="12" y1="7" x2="12" y2="11" />
        <line x1="16" y1="7" x2="16" y2="14" />
        <line x1="20" y1="7" x2="20" y2="11" />
      </g>
    </svg>
  )
};

const Sidebar = ({
  inChangeMap = false,
  isCompareMode,
  setIsCompareMode,
  selectedYear,
  setSelectedYear,
  satelliteProvider,
  setSatelliteProvider,
  showInstitutions,
  onToggleInstitutions,
  activeLayerName,
  setActiveLayerName,
  basemapType,
  setBasemapType,
  setShowChangeMap,
  selectedDrawMode,
  setSelectedDrawMode,
  lastDrawMode,
  onGoHome,
  isRulerMode,
  setIsRulerMode,
  isActiveLocationMode,
  setIsActiveLocationMode,
  measureType,
  setMeasureType
}) => {
  const [isPinned, setIsPinned] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [tempCollapsed, setTempCollapsed] = useState(false);

  const handleAction = () => {
    if (!isPinned) setTempCollapsed(true);
  };

  const handleMouseEnter = () => {
    if (!tempCollapsed) setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTempCollapsed(false);
  };

  const isHoverActive = isHovered && !tempCollapsed;
  const yearWrapperRef = useRef(null);
  const providerWrapperRef = useRef(null);
  const drawWrapperRef = useRef(null);
  const measureWrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown === 'year' && yearWrapperRef.current && !yearWrapperRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
      if (openDropdown === 'provider' && providerWrapperRef.current && !providerWrapperRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
      if (openDropdown === 'draw' && drawWrapperRef.current && !drawWrapperRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
      if (openDropdown === 'measure' && measureWrapperRef.current && !measureWrapperRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    if (openDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  const toggleDropdown = (name) => {
    setOpenDropdown(prev => prev === name ? null : name);
  };

  return (
    <div
      className={`sidebar-container ${isHoverActive ? 'hover-active' : ''} ${isPinned ? 'pinned' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hamburger Pin Toggle */}
      <div className="sidebar-item-wrapper">
        <button
          className={`sidebar-btn-reset sidebar-button ${isPinned ? 'pinned-active' : ''}`}
          onClick={() => { setIsPinned(!isPinned); handleAction(); }}
          title={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
        >
          <Icons.Hamburger />
        </button>
      </div>

      {/* Home Menu */}
      <div className="sidebar-item-wrapper">
        <button
          className={`sidebar-btn-reset sidebar-button ${(!inChangeMap && !isCompareMode && activeLayerName === 'all' && !selectedDrawMode && !isRulerMode && !isActiveLocationMode) ? 'active' : ''}`}
          onClick={() => {
            if (setShowChangeMap) setShowChangeMap(false);
            if (setIsCompareMode) setIsCompareMode(false);
            if (setActiveLayerName) setActiveLayerName('all');
            if (setIsRulerMode) setIsRulerMode(false);
            if (setIsActiveLocationMode) setIsActiveLocationMode(false);
            if (onGoHome) onGoHome();
            handleAction();
          }}
          title="Return to default map"
        >
          <Icons.Home />
          <span className="sidebar-text">Home</span>
        </button>
      </div>

      {/* Year Selector */}
      <div className={`sidebar-item-wrapper ${openDropdown === 'year' ? 'force-expand' : ''}`} ref={yearWrapperRef}>
        <button
          className="sidebar-btn-reset sidebar-button"
          onClick={() => toggleDropdown('year')}
        >
          <Icons.Year />
          <span className="sidebar-text">Year</span>
          <div className="dropdown-anchor">
            <span className="value-preview-box">{selectedYear}<span className="dropdown-arrow-small">▼</span></span>
            <div className={`sidebar-dropdown ${openDropdown === 'year' ? 'open' : ''}`}>
              {['2023', '2019'].map(yr => (
                <div
                  key={yr}
                  className={`dropdown-item ${selectedYear === yr ? 'selected' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedYear(yr); setOpenDropdown(null); handleAction(); }}
                >
                  {yr}
                </div>
              ))}
            </div>
          </div>
        </button>
      </div>

      {/* Satellite Provider */}
      <div className={`sidebar-item-wrapper ${openDropdown === 'provider' ? 'force-expand' : ''}`} ref={providerWrapperRef}>
        <button
          className="sidebar-btn-reset sidebar-button"
          onClick={() => toggleDropdown('provider')}
        >
          <Icons.Satellite />
          <span className="sidebar-text">Satellite</span>
          <div className="dropdown-anchor">
            <span className="value-preview-box">
              {satelliteProvider === 'bing' ? 'Bing' : 'Esri'}
              <span className="dropdown-arrow-small">▼</span>
            </span>
            <div className={`sidebar-dropdown ${openDropdown === 'provider' ? 'open' : ''}`}>
              {['bing', 'esri'].map(prov => (
                <div
                  key={prov}
                  className={`dropdown-item ${satelliteProvider === prov ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSatelliteProvider(prov);
                    if (setBasemapType) setBasemapType('satellite'); // Switch to satellite if OSM was selected
                    setOpenDropdown(null);
                    handleAction();
                  }}
                >
                  {prov === 'bing' ? 'Bing' : 'Esri'}
                </div>
              ))}
            </div>
          </div>
        </button>
      </div>

      {/* Draw Shape */}
      <div className={`sidebar-item-wrapper ${openDropdown === 'draw' ? 'force-expand' : ''}`} ref={drawWrapperRef}>
        <button
          className={`sidebar-btn-reset sidebar-button ${selectedDrawMode ? 'active' : ''}`}
          onClick={(e) => {
            // If clicking explicitly on the dropdown arrow part, just toggle the dropdown
            if (e.target.closest('.dropdown-anchor')) {
              toggleDropdown('draw');
              return;
            }
            if (selectedDrawMode) {
              if (setSelectedDrawMode) setSelectedDrawMode(null);
            } else {
              // Default to last used mode (Rectangle vs Polygon) if switching on
              if (setSelectedDrawMode) setSelectedDrawMode(lastDrawMode);
            }
            setOpenDropdown(null);
            handleAction();
          }}
        >
          {lastDrawMode === 'polygon' ? <Icons.DrawPolygon /> : <Icons.DrawRectangle />}
          <span className="sidebar-text">Select Area</span>
          <div className="dropdown-anchor">
            <span className="value-preview-box">
              {lastDrawMode === 'rectangle' ? 'Rectangle' : 'Polygon'}
              <span className="dropdown-arrow-small">▼</span>
            </span>
            <div className={`sidebar-dropdown ${openDropdown === 'draw' ? 'open' : ''}`}>
              {['rectangle', 'polygon'].map(mode => (
                <div
                  key={mode}
                  className={`dropdown-item ${selectedDrawMode === mode ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (setSelectedDrawMode) setSelectedDrawMode(mode);
                    setOpenDropdown(null);
                    handleAction();
                  }}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </div>
              ))}
            </div>
          </div>
        </button>
      </div>

      {/* Compare Years */}
      <div className={`sidebar-item-wrapper ${isCompareMode ? 'force-expand' : ''}`}>
        <button
          className={`sidebar-btn-reset sidebar-button ${isCompareMode ? 'active' : ''}`}
          onClick={() => { setIsCompareMode(!isCompareMode); handleAction(); }}
        >
          <Icons.Compare />
          <span className="sidebar-text">Compare</span>
        </button>
      </div>

      {/* LULC Changes */}
      <div className="sidebar-item-wrapper">
        <button
          className={`sidebar-btn-reset sidebar-button ${inChangeMap ? 'active' : ''}`}
          onClick={() => {
            if (inChangeMap) {
              if (setShowChangeMap) setShowChangeMap(false);
            } else {
              if (!activeLayerName || activeLayerName === 'all') {
                if (setActiveLayerName) setActiveLayerName('farmland');
              }
              if (setShowChangeMap) setShowChangeMap(true);
            }
            handleAction();
          }}
        >
          <Icons.LulcChanges />
          <span className="sidebar-text">LULC Changes</span>
        </button>
      </div>

      {/* Institutions Toggle */}
      <div className="sidebar-item-wrapper">
        <button
          className={`sidebar-btn-reset sidebar-button ${showInstitutions ? 'active' : ''}`}
          onClick={() => {
            if (onToggleInstitutions) onToggleInstitutions();
            handleAction();
          }}
        >
          <Icons.Institution />
          <span className="sidebar-text">Institutions</span>
          <div className="switch-container">
            <div className={`switch-track ${showInstitutions ? 'bg-red-500' : 'bg-gray-300'}`}>
              <div className={`switch-thumb ${showInstitutions ? 'translate-x-[18px]' : 'translate-x-0'}`} />
            </div>
          </div>
        </button>
      </div>

      {/* Active Location */}
      <div className="sidebar-item-wrapper">
        <button
          className={`sidebar-btn-reset sidebar-button ${isActiveLocationMode ? 'active' : ''}`}
          onClick={() => {
            if (setIsActiveLocationMode) setIsActiveLocationMode(!isActiveLocationMode);
            if (!isActiveLocationMode) {
              if (setSelectedDrawMode) setSelectedDrawMode(null);
              if (setIsRulerMode) setIsRulerMode(false);
            }
            handleAction();
          }}
          title="Coordinates"
        >
          <Icons.ActiveLocation />
          <span className="sidebar-text">Coordinates</span>
        </button>
      </div>

      {/* Measure / Ruler */}
      <div className={`sidebar-item-wrapper ${openDropdown === 'measure' ? 'force-expand' : ''}`} ref={measureWrapperRef}>
        <button
          className={`sidebar-btn-reset sidebar-button ${isRulerMode ? 'active' : ''}`}
          onClick={(e) => {
            if (e.target.closest('.dropdown-anchor')) {
              toggleDropdown('measure');
              return;
            }
            if (setIsRulerMode) setIsRulerMode(!isRulerMode);
            // Disable other draw modes if we enter ruler mode
            if (!isRulerMode) {
                if (setSelectedDrawMode) setSelectedDrawMode(null);
                if (setIsActiveLocationMode) setIsActiveLocationMode(false);
            }
            setOpenDropdown(null);
            handleAction();
          }}
          title="Measure distance, perimeter, or area"
        >
          <Icons.Ruler />
          <span className="sidebar-text">Measure</span>
          <div className="dropdown-anchor">
            <span className="value-preview-box">
              {measureType.charAt(0).toUpperCase() + measureType.slice(1)}
              <span className="dropdown-arrow-small">▼</span>
            </span>
            <div className={`sidebar-dropdown ${openDropdown === 'measure' ? 'open' : ''}`}>
              {['distance', 'perimeter', 'area'].map(type => (
                <div
                  key={type}
                  className={`dropdown-item ${measureType === type ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (setMeasureType) setMeasureType(type);
                    if (!isRulerMode && setIsRulerMode) {
                      setIsRulerMode(true);
                      if (setSelectedDrawMode) setSelectedDrawMode(null);
                    }
                    setOpenDropdown(null);
                    handleAction();
                  }}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </div>
              ))}
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
