// Custom Mapbox GL Draw theme for MapLibre GL v3+
// Fixes 'Expression name must be a string, but found number instead' caused by line-dasharray

const orange = '#fbb03b';
const white = '#fff';

const theme = [
  {
    'id': 'gl-draw-polygon-fill',
    'type': 'fill',
    'filter': ['all', ['==', '$type', 'Polygon']],
    'paint': {
      'fill-color': white,
      'fill-opacity': 0.0,
    },
  },
  {
    'id': 'gl-draw-lines',
    'type': 'line',
    'filter': ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
    'layout': {
      'line-cap': 'round',
      'line-join': 'round',
    },
    'paint': {
      'line-color': white,
      'line-dasharray': [
        'case',
        ['==', ['get', 'active'], 'true'], ['literal', [2, 2]],
        ['literal', [2, 0]],
      ],
      'line-width': 2,
    },
  },
  {
    'id': 'gl-draw-point-outer',
    'type': 'circle',
    'filter': ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    'paint': {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 7, 5],
      'circle-color': white,
    },
  },
  {
    'id': 'gl-draw-point-inner',
    'type': 'circle',
    'filter': ['all', ['==', '$type', 'Point'], ['==', 'meta', 'feature']],
    'paint': {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 5, 3],
      'circle-color': white,
    },
  },
  {
    'id': 'gl-draw-vertex-outer',
    'type': 'circle',
    'filter': ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'simple_select']],
    'paint': {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 7, 5],
      'circle-color': white,
    },
  },
  {
    'id': 'gl-draw-vertex-inner',
    'type': 'circle',
    'filter': ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex'], ['!=', 'mode', 'simple_select']],
    'paint': {
      'circle-radius': ['case', ['==', ['get', 'active'], 'true'], 5, 3],
      'circle-color': white,
    },
  },
  {
    'id': 'gl-draw-midpoint',
    'type': 'circle',
    'filter': ['all', ['==', 'meta', 'midpoint']],
    'paint': {
      'circle-radius': 3,
      'circle-color': white,
    },
  },
];

export default theme;
