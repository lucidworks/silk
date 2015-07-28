define(function (require) {
  return function MapperService(Private, Promise, es, configFile, $http) {
    var _ = require('lodash');
    var moment = require('moment');

    var IndexPatternMissingIndices = require('errors').IndexPatternMissingIndices;
    // var transformMappingIntoFields = Private(require('components/index_patterns/_transform_mapping_into_fields'));
    var castMappingType = Private(require('components/index_patterns/_cast_mapping_type'));
    var intervals = Private(require('components/index_patterns/_intervals'));
    var patternToWildcard = Private(require('components/index_patterns/_pattern_to_wildcard'));

    var LocalCache = Private(require('components/index_patterns/_local_cache'));

    function Mapper() {

      // Save a reference to mapper
      var self = this;

      // proper-ish cache, keeps a clean copy of the object, only returns copies of it's copy
      var fieldCache = self.cache = new LocalCache();

      /**
       * Gets an object containing all fields with their mappings
       * @param {dataSource} dataSource
       * @param {boolean} skipIndexPatternCache - should we ping the index-pattern objects
       * @returns {Promise}
       * @async
       */
      self.getFieldsForIndexPattern = function (indexPattern, skipIndexPatternCache) {
        // console.log('getFieldsForIndexPattern() indexPattern =', indexPattern);
        // console.log('getFieldsForIndexPattern() skipIndexPatternCache =', skipIndexPatternCache);

        var id = indexPattern.id;

        var cache = fieldCache.get(id);
        if (cache) return Promise.resolve(cache);

        if (!skipIndexPatternCache) {
          // TODO
          return es.get({
            index: configFile.kibana_index,
            type: 'index-pattern',
            id: id,
            _sourceInclude: ['fields']
          })
          .then(function (resp) {
            if (resp.found && resp._source.fields) {
              fieldCache.set(id, JSON.parse(resp._source.fields));
            }
            return self.getFieldsForIndexPattern(indexPattern, true);
          });
        }

        var promise = Promise.resolve(id);
        if (indexPattern.intervalName) {
          promise = self.getIndicesForIndexPattern(indexPattern)
          .then(function (existing) {
            if (existing.matches.length === 0) throw new IndexPatternMissingIndices();
            return existing.matches.slice(-5); // Grab the most recent 5
          });
        }

        // return promise.then(function (indexList) {
        //   return es.indices.getFieldMapping({
        //     index: indexList,
        //     field: '*',
        //     ignoreUnavailable: _.isArray(indexList),
        //     allowNoIndices: false,
        //     includeDefaults: true
        //   });
        // })
        // .catch(function (err) {
        //   if (err.status >= 400) {
        //     // transform specific error type
        //     throw new IndexPatternMissingIndices();
        //   } else {
        //     // rethrow all others
        //     throw err;
        //   }
        // })
        // .then(transformMappingIntoFields)
        // .then(function (fields) {
        //   fieldCache.set(id, fields);
        //   return fieldCache.get(id);
        // });

        return promise.then(function (indexList) {
          // console.log('indexList =', indexList);

          // This API will only get the static (defined) field list from Solr.
          // We also need to get the dynamic fields via another API.
          var solrFieldsUrl = configFile.solr + '/' + indexList + '/schema/fields';
          var solrDynamicFieldsUrl = configFile.solr + '/' + indexList + '/schema/dynamicfields';

          var promiseFields = $http.get(solrFieldsUrl)
          .then(function (resp) {
            // console.log('Static fields resp =', resp);

            // For Solr, we need to manually add _source field.
            var sourceField = {
              "name": "_source",
              "analyzed": false,
              "filterable": false,
              "indexed": false,
              "scripted": false,
              "type": "string"
            };

            resp.data.push(sourceField);
            return resp.data;
          });

          var promiseDynamicFields = $http.get(solrDynamicFieldsUrl)
          .then(function (resp) {
            // console.log('Dynamic fields resp =', resp);

            // Filter out empty indexFields
            var dynamicFields = _.filter(resp.data, function(field) {
              return field.indexFields.length > 0;
            });

            // Transform the result into proper output format
            return _.flatten(_.map(dynamicFields, function(field) {
              var baseProperties = _.omit(field, ['name','indexFields']);
              return _.map(field.indexFields, function(f) {
                return _.merge(f, baseProperties);
              });
            }));
          });

          return Promise.all([promiseFields, promiseDynamicFields])
          .then(function (resp) {
            return _.flatten(resp);
          });
        })
        .catch(function (err) {
          if (err.status >= 400) {
            // transform specific error type
            throw new IndexPatternMissingIndices();
          } else {
            // rethrow all others
            throw err;
          }
        })
        .then(function (fields) {
          _.each(fields, function(f) {
            // casting Solr field types to ES field types so viz will work properly.
            f.type = castMappingType(f.type);
          });

          fieldCache.set(id, fields);
          return fieldCache.get(id);
        });
      };

      self.getIndicesForIndexPattern = function (indexPattern) {
        // TODO
        return es.indices.getAliases({
          index: patternToWildcard(indexPattern.id)
        })
        .then(function (resp) {
          // var all = Object.keys(resp).sort();
          var all = _(resp).map(function (index, key) {
            if (index.aliases) {
              return [Object.keys(index.aliases), key];
            } else {
              return key;
            }
          }).flatten().uniq().value().sort();

          var matches = all.filter(function (existingIndex) {
            var parsed = moment(existingIndex, indexPattern.id);
            return existingIndex === parsed.format(indexPattern.id);
          });

          return {
            all: all,
            matches: matches
          };
        });
      };

      /**
       * Clears mapping caches from elasticsearch and from local object
       * @param {dataSource} dataSource
       * @returns {Promise}
       * @async
       */
      self.clearCache = function (indexPattern) {
        fieldCache.clear(indexPattern);
        return Promise.resolve();
      };
    }

    return new Mapper();
  };
});
