define(function (require) {
  return function CreateKibanaIndexFn(Private, $http, $q, configFile, Notifier) {
    return function createKibanaIndex() {
      var notify = new Notifier({ location: 'Setup: Kibana Index Creation' });
      var complete = notify.lifecycle('kibana index creation');
      var SetupError = Private(require('components/setup/_setup_error'));

      // return es.indices.create({
      //   index: configFile.kibana_index,
      //   body: {
      //     settings: {
      //       number_of_shards : 1,
      //       number_of_replicas: 1
      //     }
      //   }
      // })
      // .catch(function (err) {
      //   throw new SetupError('Unable to create Kibana index "<%= configFile.kibana_index %>"', err);
      // })
      // .then(function () {
      //   return es.cluster.health({
      //     waitForStatus: 'yellow',
      //     index: configFile.kibana_index
      //   })
      //   .catch(function (err) {
      //     throw new SetupError('Waiting for Kibana index "<%= configFile.kibana_index %>" to come online failed', err);
      //   });
      // })
      // .then(complete, complete.failure);

      // return $http.get(configFile.apollo + '/collections/' + configFile.kibana_index)
      //   .then(complete, complete.failure);

      // //TODO: Get the xml then create the collection and then push the collection
      var schemaText = '';
      var defer = $q.defer();
      $http.get('silkconfig_schema.xml').then(function(resp){
        schemaText = resp.data;
        // console.log("schemaText = ", schemaText);
      }).then(function(){ //Create the collection
        $http.post(configFile.apollo + '/collections/', {
          id: configFile.kibana_index,
          solrNumShards: 1,
          solrReplicationFactor: 1
        }).then(function(){
          var req = {
           method: 'PUT',
           url: configFile.apollo + '/collections/' + configFile.kibana_index + '/solr-config/schema.xml?reload=true',
           headers: {
             'Content-Type': 'application/xml'
           },
           data: schemaText
          };
          $http(req).success(function(){
            defer.resolve(true);
          }).error(function(){
            //TODO: Do something about this
          });
        });
      }); 

      return defer.promise;

      // return true;
    };
  };
});
