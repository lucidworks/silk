define(function (require) {
  var _ = require('lodash');
  var $ = require('jquery');

  require('components/notify/notify');

  require('modules').get('components/setup', ['kibana', 'kibana/notify', 'kibana/config'])
  .service('kbnSetup', function (Private, Promise, Notifier, es, configFile, $http, $q) {
    // setup steps
    var checkForEs = Private(require('components/setup/steps/check_for_es'));
    var checkEsVersion = Private(require('components/setup/steps/check_es_version'));
    var checkForKibanaIndex = Private(require('components/setup/steps/check_for_kibana_index'));
    // We have to manually create system_silkconfig collection.
    // var createKibanaIndex = Private(require('components/setup/steps/create_kibana_index'));

    var notify = new Notifier({ location: 'Setup' });

    // return _.once(function () {
    //   var complete = notify.lifecycle('bootstrap');
    //
    //   return checkForEs()
    //   .then(checkEsVersion)
    //   .then(checkForKibanaIndex)
    //   .then(function (exists) {
    //     if (!exists) return createKibanaIndex();
    //   })
    //   .then(complete, complete.failure);
    // });
    return _.once(function () {
      // var complete = notify.lifecycle('bootstrap');
      var defer = $q.defer();
      checkForEs()
      .then(checkForKibanaIndex)
      .then(function () {
        $http.get(configFile.solr + '/' + configFile.kibana_index + '/select?wt=json&q=_id:@@version')
        .then(function (stuff) {
          defer.resolve(stuff);
        }, function (error) {
          defer.reject('Cannot find '
            + configFile.kibana_index
            + ' collection. Check your network connection or create the collection first.');
        });
      }, function (error) {
        // Solr Schema API does not support uploading a schema.xml file to create a new collection.
        // So a user will have to manually create a system_silkconfig collection before starting Silk.
        //
        // createKibanaIndex().then(function(){
        //   $http.get(configFile.solr + '/' + configFile.kibana_index + '/select?wt=json&q=_id:@@version').then(function(stuff){
        //     defer.resolve(stuff);
        //   },function(error){
        //     defer.reject();
        //   });
        // });
        defer.reject('Cannot find '
          + configFile.kibana_index
          + ' collection. Check your network connection or create the collection first.');
      });
      return defer.promise;
    });
  });
});
