define(function (require) {
  return function RefreshKibanaIndexFn(es, configFile) {
    return function () {

      console.log('refresh kibana index');

      // TODO
      // return es.indices.refresh({
      //   index: configFile.kibana_index
      // });
    };
  };
});
