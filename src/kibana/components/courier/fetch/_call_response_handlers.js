define(function (require) {
  return function CourierFetchCallResponseHandlers(Private, Promise) {
    var ABORTED = Private(require('components/courier/fetch/_req_status')).ABORTED;
    var INCOMPLETE = Private(require('components/courier/fetch/_req_status')).INCOMPLETE;
    var notify = Private(require('components/courier/fetch/_notifier'));

    var SearchTimeout = require('errors').SearchTimeout;
    var RequestFailure = require('errors').RequestFailure;
    var ShardFailure = require('errors').ShardFailure;

    function callResponseHandlers(requests, responses) {

      // console.log('callResponseHandlers requests =', requests);
      // console.log('callResponseHandlers responses =', responses);

      return Promise.map(requests, function (req, i) {
        if (req === ABORTED || req.aborted) {
          return ABORTED;
        }

        // console.log('callResponseHandlers req =', req);
        // console.log('callResponseHandlers i =', i);

        var resp = responses[i];

        // if resp === undefined, assign it to empty obj to avoid runtime errors.
        if (!resp) {
          resp = {};
        }

        if (resp.timed_out) {
          notify.warning(new SearchTimeout());
        }

        if (resp._shards && resp._shards.failed) {
          notify.warning(new ShardFailure(resp));
        }

        function progress() {
          if (req.isIncomplete()) {
            return INCOMPLETE;
          }

          req.complete();
          return resp;
        }

        if (resp.error) {
          if (req.filterError(resp)) {
            return progress();
          } else {
            return req.handleFailure(new RequestFailure(null, resp));
          }
        }

        return Promise.try(function () {
          return req.transformResponse(resp);
        })
        .then(function () {
          resp = arguments[0];
          return req.handleResponse(resp);
        })
        .then(progress);
      });
    }

    return callResponseHandlers;
  };
});