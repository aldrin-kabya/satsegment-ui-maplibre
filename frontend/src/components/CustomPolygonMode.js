import MapboxDraw from '@mapbox/mapbox-gl-draw';

/**
 * Custom Polygon Mode to prevent the drawing tool from automatically 
 * connecting the first and last points (hiding the "closing" line) 
 * while the shape is being created.
 */
const CustomPolygonMode = {
  ...MapboxDraw.modes.draw_polygon,

  toDisplayFeatures: function (state, geojson, display) {
    const isActivePolygon = geojson.properties.id === state.polygon.id;

    // Use the original draw_polygon's toDisplayFeatures logic but intercept the output
    MapboxDraw.modes.draw_polygon.toDisplayFeatures.call(this, state, geojson, (f) => {
      // If this is the active feature being drawn and it's a Polygon,
      // convert its visual representation to a LineString to hide the closing edge.
      if (isActivePolygon && f.geometry.type === 'Polygon') {
        const coords = f.geometry.coordinates[0];
        // Standard draw_polygon adds the mouse position and closes the ring (last == first).
        // To hide the closing line, we remove the final coordinate that closes the loop.
        if (coords.length > 1) {
          f.geometry.type = 'LineString';
          f.geometry.coordinates = coords.slice(0, -1);
        }
      }
      
      // Pass the modified (or original) feature to the display callback
      display(f);
    });
  },

  onSetup: function(opts) {
    const state = MapboxDraw.modes.draw_polygon.onSetup.call(this, opts);
    setTimeout(() => {
      if (this.map) {
        const whiteCrosshairCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' %3E%3Cline x1='12' y1='2' x2='12' y2='22' stroke='black' stroke-width='3'/%3E%3Cline x1='2' y1='12' x2='22' y2='12' stroke='black' stroke-width='3'/%3E%3Cline x1='12' y1='2' x2='12' y2='22' stroke='white' stroke-width='2'/%3E%3Cline x1='2' y1='12' x2='22' y2='12' stroke='white' stroke-width='2'/%3E%3C/svg%3E") 12 12, crosshair`;
        this.map.getCanvas().style.cursor = whiteCrosshairCursor;
      }
    }, 0);
    return state;
  },

  onStop: function(state) {
    MapboxDraw.modes.draw_polygon.onStop.call(this, state);
    setTimeout(() => {
      if (this.map) {
        this.map.getCanvas().style.cursor = '';
      }
    }, 0);
  }
};

export default CustomPolygonMode;
