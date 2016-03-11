// This file is used to get the list of collection names in system_silkconfig collection.

define(function (require) {
  return function GetIndexPatternIdsFn(es, configFile, $http) {
    var _ = require('lodash');

    // many places may require the id list, so we will cache it seperately
    // didn't incorportate with the indexPattern cache to prevent id collisions.
    var cachedPromise;

    var getIds = function () {
      if (cachedPromise) {
        // retrun a clone of the cached response
        return cachedPromise.then(function (cachedResp) {
          return _.clone(cachedResp);
        });
      }

      // cachedPromise = es.search({
      //   index: configFile.kibana_index,
      //   type: 'index-pattern',
      //   fields: [],
      //   body: {
      //     query: { match_all: {} },
      //     size: 2147483647
      //   }
      // })
      // 
      var solrUrl = configFile.solr + '/' + configFile.kibana_index +
        '/select?q=*:*&fq=_type:index-pattern&fl=_id&wt=json&omitHeader=true';
      cachedPromise = $http.get(solrUrl)
      .then(function (resp) {
        return _.pluck(resp.data.response.docs, '_id');
      }, function (err) {
        // Catch response error
        console.log('ERROR: Something wrong when trying to contact Solr.');
      });

      // ensure that the response stays pristine by cloning it here too
      return cachedPromise.then(function (resp) {
        return _.clone(resp);
      });
    };

    getIds.clearCache = function () {
      cachedPromise = null;
    };

    return getIds;
  };
});
