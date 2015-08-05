define(function (require) {
  var module = require('modules').get('kibana/config', [
    'kibana/notify'
  ]);

  var configFile = JSON.parse(require('text!config'));
  configFile.collectionsApi = '/admin/collections';
  // Define Solr URL in config
  configFile.solr = (function() {
    //   Cannot specify query-pipelines here because we use configFile.solr to check for Solr
    //   in the setup init phase. Refer to /component/setup/steps/check_for_es.js
    //   The URL location here needs to return status 200 in order to pass the check. Otherwise,
    //   the dashboard will not load.
    //
    //   For example, this is not gonna work:
    //     var solrUrl = window.location.origin + '/api/apollo/query-pipelines/default/collections';

    // Need to use double /solr because of the proxy code in server side.
    var solrUrl = window.location.origin + '/solr/solr';
    return solrUrl;
  }());

  // allow the rest of the app to get the configFile easily
  module.constant('configFile', configFile);

  // service for delivering config variables to everywhere else
  module.service('config', function (Private, Notifier, kbnVersion, kbnSetup, $rootScope, buildNum) {
    var config = this;

    var angular = require('angular');
    var _ = require('lodash');
    var defaults = require('components/config/defaults');
    var DelayedUpdater = Private(require('components/config/_delayed_updater'));
    var vals = Private(require('components/config/_vals'));

    var notify = new Notifier({
      location: 'Config'
    });

    // active or previous instance of DelayedUpdater. This will log and then process an
    // update once it is requested by calling #set() or #clear().
    var updater;

    var DocSource = Private(require('components/courier/data_source/doc_source'));
    var doc = (new DocSource())
      .index(configFile.kibana_index)
      .type('config')
      .id(kbnVersion);

    /******
     * PUBLIC API
     ******/

    config.file = configFile;

    /**
     * Executes once and returns a promise that is resolved once the
     * config has loaded for the first time.
     *
     * @return {Promise} - Resolved when the config loads initially
     */
    config.init = _.once(function () {
      var complete = notify.lifecycle('config init');
      return kbnSetup()
      .then(function getDoc(resp) {

        // used to apply an entire es response to the vals, silentAndLocal will prevent
        // event/notifications/writes from occuring.
        var applyMassUpdate = function (resp, silentAndLocal) {
          _.union(_.keys(resp._source), _.keys(vals)).forEach(function (key) {
            change(key, resp._source[key], silentAndLocal);
          });
        };

        // return doc.fetch().then(function initDoc(resp) {
        //   if (!resp.found) {
        //     return doc.doIndex({
        //       buildNum: buildNum
        //     }).then(getDoc);
        //   } else {
        //     // apply update, and keep it quiet the first time
        //     applyMassUpdate(resp, true);

        //     // don't keep it quiet other times
        //     doc.onUpdate(function (resp) {
        //       applyMassUpdate(resp, false);
        //     });
        //   }
        // });
        var savedSettings;
        try {
          savedSettings = resp.data.response.docs[0];
          var defaultIndex = JSON.parse(savedSettings['_source']).defaultIndex;
          config.set('defaultIndex', defaultIndex);
        } catch (error) {
          savedSettings = {
            '_id': '@@version',
            '_index': this.kibana_index,
            '_source': {'buildNum': 9999, 'defaultIndex': 'logs'},
            '_type': 'config',
            '_version': 2,
            'found': true
          };
        }

        return savedSettings;
      })
      .then(function () {
        $rootScope.$broadcast('init:config');
      })
      .then(complete, complete.failure);
    });

    config.get = function (key, defaultVal) {
      var keyVal;
      if (vals[key] == null) {
        if (defaultVal == null) {
          keyVal = defaults[key].value;
        } else {
          keyVal = _.cloneDeep(defaultVal);
        }
      } else {
        keyVal = vals[key];
      }

      if (defaults[key] && defaults[key].type === 'json') {
        return JSON.parse(keyVal);
      }
      return keyVal;
    };

    // sets a value in the config
    config.set = function (key, val) {
      if (_.isPlainObject(val)) {
        return change(key, angular.toJson(val));
      } else {
        return change(key, val);
      }
    };

    // clears a value from the config
    config.clear = function (key) {
      return change(key);
    };
    // alias for clear
    config.delete = config.clear;

    config.close = function () {
      if (updater) updater.fire();
    };

    /*****
     * PRIVATE API
     *****/
    var change = function (key, val, silentAndLocal) {
      // if the previous updater has already fired, then start over with null
      if (updater && updater.fired) updater = null;
      // create a new updater
      if (!updater) updater = new DelayedUpdater(doc);
      // return a promise that will be resolved once the action is eventually done
      return updater.update(key, val, silentAndLocal);
    };

    config._vals = function () {
      return _.cloneDeep(vals);
    };

  });
});
