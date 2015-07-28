// Register vis types that will be available in the Visualize page.

define(function (require) {
  var visTypes = require('registry/vis_types');
  visTypes.register(require('plugins/vis_types/vislib/histogram'));
  visTypes.register(require('plugins/vis_types/vislib/line'));
  visTypes.register(require('plugins/vis_types/vislib/pie'));
  visTypes.register(require('plugins/vis_types/vislib/area'));
  // Disable tile_map, it's not working with Solr geospatial search yet.
  // visTypes.register(require('plugins/vis_types/vislib/tile_map'));
});