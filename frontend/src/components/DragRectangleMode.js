// Custom Drag-to-Draw Rectangle Mode for MapboxDraw
const DragRectangleMode = {
  onSetup: function(opts) {
    const rectangle = this.newFeature({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[]]
      }
    });

    this.addFeature(rectangle);
    this.clearSelectedFeatures();
    
    // Force custom white crosshair and disable panning to allow dragging
    setTimeout(() => {
      if (this.map) {
        if (this.map.dragPan) this.map.dragPan.disable();
        const canvas = this.map.getCanvas();
        if (canvas) {
          const whiteCrosshair = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' %3E%3Cline x1='12' y1='2' x2='12' y2='22' stroke='black' stroke-width='3'/%3E%3Cline x1='2' y1='12' x2='22' y2='12' stroke='black' stroke-width='3'/%3E%3Cline x1='12' y1='2' x2='12' y2='22' stroke='white' stroke-width='2'/%3E%3Cline x1='2' y1='12' x2='22' y2='12' stroke='white' stroke-width='2'/%3E%3C/svg%3E") 12 12, crosshair`;
          canvas.style.cursor = whiteCrosshair;
        }
      }
    }, 0);

    this.setActionableState({ trash: true });
    return { rectangle: rectangle };
  },

  onMouseDown: function(state, e) {
    if (e.originalEvent.button !== 0) return; // Only left click
    const startPoint = [e.lngLat.lng, e.lngLat.lat];
    state.startPoint = startPoint;
  },

  onDrag: function(state, e) {
    if (!state.startPoint) return;
    
    state.rectangle.updateCoordinate("0.0", state.startPoint[0], state.startPoint[1]); // minX, minY
    state.rectangle.updateCoordinate("0.1", e.lngLat.lng, state.startPoint[1]); // maxX, minY
    state.rectangle.updateCoordinate("0.2", e.lngLat.lng, e.lngLat.lat); // maxX, maxY
    state.rectangle.updateCoordinate("0.3", state.startPoint[0], e.lngLat.lat); // minX, maxY
    state.rectangle.updateCoordinate("0.4", state.startPoint[0], state.startPoint[1]); // back to minX, minY
  },

  onMouseUp: function(state, e) {
    if (!state.startPoint) return;
    // Finish drawing
    state.endPoint = [e.lngLat.lng, e.lngLat.lat];
    this.changeMode("simple_select", { featureIds: [state.rectangle.id] });
  },

  onKeyUp: function(state, e) {
    if (e.keyCode === 27) return this.changeMode("simple_select");
  },

  onStop: function(state) {
    setTimeout(() => {
      if (this.map) {
        if (this.map.dragPan) this.map.dragPan.enable();
        const canvas = this.map.getCanvas();
        if (canvas) canvas.style.cursor = '';
      }
    }, 0);

    // Check if feature was deleted
    if (this.getFeature(state.rectangle.id) === undefined) return;

    if (state.startPoint) {
      state.rectangle.removeCoordinate("0.4");
    }

    if (state.rectangle.isValid()) {
      this.map.fire("draw.create", {
        features: [state.rectangle.toGeoJSON()]
      });
    } else {
      this.deleteFeature([state.rectangle.id], { silent: true });
      this.changeMode("simple_select", {}, { silent: true });
    }
  },

  toDisplayFeatures: function(state, geojson, display) {
    const isActivePolygon = geojson.properties.id === state.rectangle.id;
    geojson.properties.active = isActivePolygon ? "true" : "false";
    if (!isActivePolygon) return display(geojson);

    // Only render the rectangular polygon if it has a starting point
    if (!state.startPoint) return;
    return display(geojson);
  },

  onTrash: function(state) {
    this.deleteFeature([state.rectangle.id], { silent: true });
    this.changeMode("simple_select");
  }
};

export default DragRectangleMode;
