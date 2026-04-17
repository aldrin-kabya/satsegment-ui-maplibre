"use client";

import React from 'react';
import '../css/OpacitySlider.css';

const OpacitySlider = ({ opacity, defaultOpacity, onOpacityChange }) => {
  const pct = Math.round(opacity * 100);
  const fillPct = ((opacity - 0) / (1 - 0)) * 100; // 0–1 range

  return (
    <div className="opacity-slider-container">
      {/* Reset button */}
      <button
        className="opacity-slider-reset"
        onClick={() => onOpacityChange(defaultOpacity)}
        title="Reset"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 2v6h6"></path>
          <path d="M2.5 8C5 4 9 2 13 2.5c5 .6 8.5 5 8 10s-5 8.5-10 8a9 9 0 0 1-6.5-3"></path>
        </svg>
      </button>

      {/* Slider track wrapper */}
      <div className="opacity-slider-track-wrapper">
        <span className="opacity-slider-label">Opacity</span>

        <input
          type="range"
          className="opacity-slider-input"
          min="0"
          max="100"
          value={pct}
          onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          style={{ '--slider-fill': `${fillPct}%` }}
          title={`Opacity: ${pct}%`}
        />

        <span className="opacity-slider-value">{pct}%</span>
      </div>
    </div>
  );
};

export default OpacitySlider;
