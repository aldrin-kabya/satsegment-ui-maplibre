"use client";

import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const Map = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  const API_URL = "http://103.81.70.74:8000";
  const TIF_PATH = "/media/drive2/armun/sat-segment/processed_cog/2019_cog.tif";

  // DEFINING YOUR COLORS
  // Format: [Red, Green, Blue, Alpha]
  const LULC_COLORS = {
    0: [0, 0, 0, 0],       // No Data (Transparent)
    1: [0, 255, 255, 255], // Forest (Cyan)
    2: [255, 0, 0, 255],   // Urban (Red)
    3: [0, 0, 255, 255],   // Water (Blue)
    4: [0, 255, 0, 255],   // Farmland (Green)
    5: [255, 255, 0, 255]  // Meadow (Yellow)
  };

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [90.35, 23.68],
      zoom: 7
    });

    map.current.on('load', () => {
      
      const colormapParams = JSON.stringify(LULC_COLORS);
      const encodedColormap = encodeURIComponent(colormapParams);

      // FIXED: Removed rescale parameter
      const tileUrl = `${API_URL}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png` +
                      `?url=${TIF_PATH}` +
                      `&colormap=${encodedColormap}`;

      console.log("Fetching tiles with custom colors...");

      map.current.addSource('lulc-2019-source', {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 24
      });

      map.current.addLayer({
        id: 'lulc-2019-layer',
        type: 'raster',
        source: 'lulc-2019-source',
        paint: {
          'raster-opacity': 0.8,
          'raster-resampling': 'nearest'
        }
      });
    });

  }, []);

  return (
    <div ref={mapContainer} style={{ width: '100%', height: '100vh' }} />
  );
};

export default Map;