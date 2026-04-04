import React, { useState, useRef, useEffect } from 'react';
import '../css/Sidebar.css';

const Icons = {
  Hamburger: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>),
  Home: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>),
  Year: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="2"></rect><line x1="16" y1="2" x2="16" y2="6" strokeWidth="2"></line><line x1="8" y1="2" x2="8" y2="6" strokeWidth="2"></line><line x1="3" y1="10" x2="21" y2="10" strokeWidth="2"></line></svg>),
  Satellite: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7 9 3 5 7l4 4"></path><path d="m17 11 4 4-4 4-4-4"></path><path d="m8 12 4 4 6-6-4-4Z"></path><path d="m16 8 3-3"></path><path d="M9 21a6 6 0 0 0-6-6"></path></svg>),
  Compare: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth="2"></rect><line x1="12" y1="3" x2="12" y2="21" strokeWidth="2"></line></svg>),
  Institution: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18" strokeWidth="2"></path><path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" strokeWidth="2"></path><path d="M9 10h6" strokeWidth="2"></path><path d="M9 14h6" strokeWidth="2"></path><path d="M9 7h6" strokeWidth="2"></path></svg>),
  LulcChanges: () => (<svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeWidth="2"></polyline></svg>)
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
  setShowChangeMap,
  onGoHome
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown === 'year' && yearWrapperRef.current && !yearWrapperRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
      if (openDropdown === 'provider' && providerWrapperRef.current && !providerWrapperRef.current.contains(event.target)) {
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
          className={`sidebar-btn-reset sidebar-button ${(!inChangeMap && !isCompareMode && activeLayerName === 'all') ? 'active' : ''}`}
          onClick={() => {
            if (setShowChangeMap) setShowChangeMap(false);
            if (setIsCompareMode) setIsCompareMode(false);
            if (setActiveLayerName) setActiveLayerName('all');
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
      {basemapType === 'satellite' && (
        <div className={`sidebar-item-wrapper ${openDropdown === 'year' ? 'force-expand' : ''}`} ref={yearWrapperRef}>
          <button className="sidebar-btn-reset sidebar-button" onClick={() => toggleDropdown('year')}>
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
      )}

      {/* Satellite Provider */}
      {basemapType === 'satellite' && (
        <div className={`sidebar-item-wrapper ${openDropdown === 'provider' ? 'force-expand' : ''}`} ref={providerWrapperRef}>
          <button className="sidebar-btn-reset sidebar-button" onClick={() => toggleDropdown('provider')}>
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
                    onClick={(e) => { e.stopPropagation(); setSatelliteProvider(prov); setOpenDropdown(null); handleAction(); }}
                  >
                    {prov === 'bing' ? 'Bing' : 'Esri'}
                  </div>
                ))}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Compare Years */}
      {basemapType === 'satellite' && (
        <div className={`sidebar-item-wrapper ${isCompareMode ? 'force-expand' : ''}`}>
          <button 
            className={`sidebar-btn-reset sidebar-button ${isCompareMode ? 'active' : ''}`} 
            onClick={() => { setIsCompareMode(!isCompareMode); handleAction(); }}
          >
            <Icons.Compare />
            <span className="sidebar-text">Compare</span>
          </button>
        </div>
      )}

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
    </div>
  );
};

export default Sidebar;
