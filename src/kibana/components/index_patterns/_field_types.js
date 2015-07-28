define(function (require) {
  return function IndexPatternFieldTypes() {
    var IndexedArray = require('utils/indexed_array/index');

    return new IndexedArray({
      index: ['name'],
      group: ['sortable', 'filterable'],
      immutable: true,
      initialSet: [
        { name: 'ip',         sortable: true,   filterable: true  },
        { name: 'date',       sortable: true,   filterable: true  },
        { name: 'string',     sortable: true,   filterable: true  },
        { name: 'number',     sortable: true,   filterable: true  },
        { name: 'boolean',    sortable: true,   filterable: true  },
        { name: 'conflict',   sortable: false,  filterable: false },
        { name: 'geo_point',  sortable: false,  filterable: false },
        { name: 'geo_shape',  sortable: false,  filterable: false },
        { name: 'attachment', sortable: false,  filterable: false },

        // Solr field types
        // { name: 'tdate',      sortable: true,   filterable: true  },
        // { name: 'long',       sortable: true,   filterable: true  },
        // { name: 'text_en_splitting_tight',       sortable: true,   filterable: true  },
        // { name: 'text_general', sortable: true,   filterable: true  },
        // { name: 'float',      sortable: true,   filterable: true  },
        // { name: 'int',        sortable: true,   filterable: true  },
        // { name: 'location',   sortable: true,   filterable: true  },
        // { name: 'location_rpt',   sortable: true,   filterable: true  },
        // { name: 'text_general_rev', sortable: true,   filterable: true  },
        // { name: 'payloads',   sortable: true,   filterable: true  }
      ]
    });
  };
});