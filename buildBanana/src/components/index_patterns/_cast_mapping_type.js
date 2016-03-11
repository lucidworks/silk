define(function (require) {
  return function CastMappingTypeFn() {
    var IndexedArray = require('utils/indexed_array/index');

    castMappingType.types = new IndexedArray({
      index: ['name'],
      group: ['type'],
      immutable: true,
      initialSet: [
        { name: 'string',       type: 'string',     group: 'base'   },
        { name: 'date',         type: 'date',       group: 'base'   },
        { name: 'boolean',      type: 'boolean',    group: 'base'   },
        { name: 'float',        type: 'number',     group: 'number' },
        { name: 'double',       type: 'number',     group: 'number' },
        { name: 'integer',      type: 'number',     group: 'number' },
        { name: 'long',         type: 'number',     group: 'number' },
        { name: 'short',        type: 'number',     group: 'number' },
        { name: 'byte',         type: 'number',     group: 'number' },
        { name: 'token_count',  type: 'number',     group: 'number' },
        { name: 'geo_point',    type: 'geo_point',  group: 'geo'    },
        { name: 'geo_shape',    type: 'geo_shape',  group: 'geo'    },
        { name: 'ip',           type: 'ip',         group: 'other'  },
        { name: 'attachment',   type: 'attachment', group: 'other'  },
        // Solr field types that will be cast to ES types
        { name: 'int',          type: 'number',     group: 'number' },
        { name: 'tint',         type: 'number',     group: 'number' },
        { name: 'tfloat',       type: 'number',     group: 'number' },
        { name: 'tlong',        type: 'number',     group: 'number' },
        { name: 'tdouble',      type: 'number',     group: 'number' },
        { name: 'tdate',        type: 'date',       group: 'base'   },
        { name: 'binary',       type: 'number',     group: 'number' },
        { name: 'random',       type: 'string',     group: 'base'   },
        { name: 'text_ws',      type: 'string',     group: 'base'   },
        { name: 'managed_en',   type: 'string',     group: 'base'   },
        { name: 'text_general', type: 'string',     group: 'base'   },
        { name: 'text_en',      type: 'string',     group: 'base'   },
        { name: 'text_en_splitting', type: 'string', group: 'base'  },
        { name: 'text_en_splitting_tight', type: 'string', group: 'base' },
        { name: 'text_general_rev', type: 'string', group: 'base'   },
        { name: 'alphaOnlySort',type: 'string',     group: 'base'   },
        { name: 'phonetic',     type: 'string',     group: 'base'   },
        { name: 'payloads',     type: 'string',     group: 'base'   },
        { name: 'lowercase',    type: 'string',     group: 'base'   },
        { name: 'descendent_path', type: 'string',  group: 'base'   },
        { name: 'ancestor_path',type: 'string',     group: 'base'   },
        { name: 'ignored',      type: 'string',     group: 'base'   },
        { name: 'point',        type: 'geo_point',  group: 'geo'    },
        { name: 'location',     type: 'geo_point',  group: 'geo'    },
        { name: 'location_rpt', type: 'geo_shape',  group: 'geo'    },
        { name: 'bbox',         type: 'geo_shape',  group: 'geo'    },
        { name: '_bbox_coord',  type: 'geo_shape',  group: 'geo'    },
        { name: 'currency',     type: 'string',     group: 'base' },
        { name: 'text_ar',      type: 'string',     group: 'base' },
        { name: 'text_bg',      type: 'string',     group: 'base' },
        { name: 'text_ca',      type: 'string',     group: 'base' },
        { name: 'text_cjk',     type: 'string',     group: 'base' },
        { name: 'text_ckb',     type: 'string',     group: 'base' },
        { name: 'text_cz',      type: 'string',     group: 'base' },
        { name: 'text_da',      type: 'string',     group: 'base' },
        { name: 'text_de',      type: 'string',     group: 'base' },
        { name: 'text_el',      type: 'string',     group: 'base' },
        { name: 'text_es',      type: 'string',     group: 'base' },
        { name: 'text_eu',      type: 'string',     group: 'base' },
        { name: 'text_fa',      type: 'string',     group: 'base' },
        { name: 'text_fi',      type: 'string',     group: 'base' },
        { name: 'text_fr',      type: 'string',     group: 'base' },
        { name: 'text_ga',      type: 'string',     group: 'base' },
        { name: 'text_gl',      type: 'string',     group: 'base' },
        { name: 'text_hi',      type: 'string',     group: 'base' },
        { name: 'text_hu',      type: 'string',     group: 'base' },
        { name: 'text_hy',      type: 'string',     group: 'base' },
        { name: 'text_id',      type: 'string',     group: 'base' },
        { name: 'text_it',      type: 'string',     group: 'base' },
        { name: 'text_ja',      type: 'string',     group: 'base' },
        { name: 'text_lv',      type: 'string',     group: 'base' },
        { name: 'text_nl',      type: 'string',     group: 'base' },
        { name: 'text_no',      type: 'string',     group: 'base' },
        { name: 'text_pt',      type: 'string',     group: 'base' },
        { name: 'text_ro',      type: 'string',     group: 'base' },
        { name: 'text_ru',      type: 'string',     group: 'base' },
        { name: 'text_sv',      type: 'string',     group: 'base' },
        { name: 'text_th',      type: 'string',     group: 'base' },
        { name: 'text_tr',      type: 'string',     group: 'base' }
      ]
    });

    /**
     * Accepts a mapping type, and converts it into it's js equivilent
     * @param  {String} type - the type from the mapping's 'type' field
     * @return {String} - the most specific type that we care for
     */
    function castMappingType(name) {
      var match = castMappingType.types.byName[name];

      if (match) return match.type;
      return 'string';
    }

    return castMappingType;
  };
});