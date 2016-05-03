/* globals angular:false */
define(function (require) {
  return function CourierFetchCallClient(Private, Promise, es, configFile, sessionId, $http) {
    var _ = require('lodash');
    var latlonGeohash = require('latlon-geohash');

    var isRequest = Private(require('components/courier/fetch/_is_request'));
    var mergeDuplicateRequests = Private(require('components/courier/fetch/_merge_duplicate_requests'));

    var ABORTED = Private(require('components/courier/fetch/_req_status')).ABORTED;
    var DUPLICATE = Private(require('components/courier/fetch/_req_status')).DUPLICATE;

    function callClient(strategy, requests) {
      // merging docs can change status to DUPLICATE, capture new statuses
      var statuses = mergeDuplicateRequests(requests);

      // get the actual list of requests that we will be fetching
      var executable = statuses.filter(isRequest);
      var execCount = executable.length;

      // resolved by respond()
      var esPromise;
      var defer = Promise.defer();

      // attach abort handlers, close over request index
      statuses.forEach(function (req, i) {
        if (!isRequest(req)) return;
        req.whenAborted(function () {
          requestWasAborted(req, i).catch(defer.reject);
        });
      });

      // handle a request being aborted while being fetched
      var requestWasAborted = Promise.method(function (req, i) { // jshint ignore:line
        if (statuses[i] === ABORTED) {
          defer.reject(new Error('Request was aborted twice?'));
        }

        execCount -= 1;
        if (execCount > 0) {
          // the multi-request still contains other requests
          return;
        }

        if (esPromise && _.isFunction(esPromise.abort)) {
          esPromise.abort();
        }

        esPromise = ABORTED;

        return respond();
      });

      // for each respond with either the response or ABORTED
      var respond = function (responses) { // jshint ignore:line
        responses = responses || [];
        return Promise.map(requests, function (req, i) {
          switch (statuses[i]) {
          case ABORTED:
            return ABORTED;
          case DUPLICATE:
            return req._uniq.resp;
          default:
            return responses[_.findIndex(executable, req)];
          }
        })
        .then(defer.resolve, defer.reject);
      };

      // Now that all of THAT^^^ is out of the way, lets actually
      // call out to elasticsearch
      Promise.map(executable, function (req) {
        // console.log('Promise.map(executable) req =', req);

        return Promise.try(req.getFetchParams, void 0, req)
        .then(function (fetchParams) {
          return (req.fetchParams = fetchParams);
        });
      })
      .then(function (reqsFetchParams) {
        // return strategy.reqsFetchParamsToBody(reqsFetchParams);
        /*
         * NOTES:
         *   ES strategy will either be: mget or msearch
         *   mget - is used for retrieving another doc from ES.
         *   msearch - is a query to search ES directly.
         */
        var parseQueryString = function (query) { //TODO: Make the pattern better, maybe, sometimes?
          if(query.replace(/\s/, '') === ''){
            return '*:*';
          } else {
            return query;
          }
        };

        /**
         * Parse ES filter queries into Solr fq queries.
         * @param {ES filter object} filter
         * @returns {array} contains string of fq queries
         */
        var parseFilterQuery = function (filtered) {
          var fqArray = [];
          var filterMust = _.get(filtered, 'filter.bool.must');
          var filterMustNot = _.get(filtered, 'filter.bool.must_not');

          function parseFilter(filterObj, boolCondition) {
            /**
             * Each filterObj can have different filter types.
             *   For examples:
             *     query
             *     range
             */
            var prefix = '';
            // We will add a prefix '-' for negative filter fq.
            // For positive filter, no need to do anything.
            if (!boolCondition) {
              prefix = '-'; // must_not
            }

            var field;

            if (filterObj.query) {
              var query;
              // Inside query, there could be different possible property values for the nested json.
              field = _.keys(filterObj.query.match)[0];

              if (field) {
                // Take care of the 'match' filter condition.
                query = filterObj.query.match[field].query;
                return 'fq=' + prefix + field + ':"' + query + '"';
              } else {
                // In case query === '*' or '*:*', we will not need to include fq, just return ''.
                // For query_string, we should not put double quotes around the filter.
                query = filterObj.query.query_string.query;
                if (query === '*' || query === '*:*') {
                  return '';
                } else {
                  return 'fq=' + query;
                }
              }
            }
            // range will usually be the time field.
            // For Quick and Relative time modes, the filter value will be string like now, now-15m, and etc.
            // However, for Absolute time mode, the filter value will be a Time object.
            if (filterObj.range) {
              field = _.keys(filterObj.range)[0];

              return 'fq=' + prefix + field + ':[' + convertTime(filterObj.range[field].from) +
                ' TO ' + convertTime(filterObj.range[field].to) + ']';
            }
            return '';
          }

          // check for must (equal) conditions in the query
          if (filterMust.length > 0) {
            fqArray = fqArray.concat(_.map(filterMust, function (f) {
              return parseFilter(f, true);
            }));
          }

          // check for must_not (not equal) conditions in the query
          if (filterMustNot.length > 0) {
            fqArray = fqArray.concat(_.map(filterMustNot, function (f) {
              return parseFilter(f, false);
            }));
          }

          return fqArray;
        };

        // TODO: This function overlaps with convertToSolrDateTime(), need refactor
        var convertTimeUnit = function (timeString) {
          var unit, numeral, newUnit;
          timeString.replace(/(\d+)(\w)/, function (m, m1, m2) {
            numeral = m1;
            unit = m2;
          });
          switch (unit) {
            case 's':
              newUnit = 'SECOND';
              break;
            case 'm':
              newUnit = 'MINUTE';
              break;
            case 'h':
              newUnit = 'HOUR';
              break;
            case 'd':
              newUnit = 'DAY';
              break;
            case 'w':
              newUnit = '7DAY';
              numeral = '';
              break;
            case 'M':
              newUnit = 'MONTH';
              break;
            case 'y':
              newUnit = 'YEAR';
              break;
            default:
              newUnit = '';
          }
          return '+' + numeral + newUnit;
        };

        var getTimeUnit = function (timeString) {
          var timeUnits = ['YEAR','MONTH','DAY','HOUR','MINUTE','SECOND'];
          var unit = timeString.split('/')[1];
          if (!unit) {
            unit = timeString.split(/\-\d+/)[1];
          }
          var unitIndex = _.findIndex(timeUnits, function (i) {
            return i === unit;
          });
          var newUnit = timeUnits[unitIndex + 1];

          return '+1' + newUnit;
        };

        /**
         * Function to convert time shorthand to full string (e.g. m => MINUTE)
         * If timeString is already in Solr DateTime format, do nothing.
         *   ISO 8601 DateTime format: 2015-06-25T00:00:00.000Z
         *
         * For Absolute time mode, timeString will be a time object, not string.
         * TODO: Think about refactor and combine this function with convertTime().
         *
         * @param {string} ES time string (e.g. m, now, now-15m)
         * @returns {string} Solr time string (e.g. MINUTE, NOW, NOW-15MINUTE)
         */
        var convertToSolrDateTime = function (timeString) {
          function convertUnit(timeunit) {
            var unit = timeunit.substr(-1);
            var unitIndex = timeunit.search(/\D/);
            var num;

            if (unitIndex > 0) {
              num = timeunit.substr(0, unitIndex);
            }

            switch (unit) {
              case 's':
                if (num) {
                  return num + 'SECOND';
                } else {
                  return 'SECOND';
                }
                break;
              case 'm':
                if (num) {
                  return num + 'MINUTE';
                } else {
                  return 'MINUTE';
                }
                break;
              case 'h':
                if (num) {
                  return num + 'HOUR';
                } else {
                  return 'HOUR';
                }
                break;
              case 'd':
                if (num) {
                  return num + 'DAY';
                } else {
                  return 'DAY';
                }
                break;
              case 'w':
                if (num) {
                  num = num * 7;
                  return num + 'DAY';
                } else {
                  return '7DAY';
                }
                break;
              case 'M':
                if (num) {
                  return num + 'MONTH';
                } else {
                  return 'MONTH';
                }
                break;
              case 'y':
                if (num) {
                  return num + 'YEAR';
                } else {
                  return 'YEAR';
                }
                break;
              default:
                return timeunit;
            }
          }

          if (timeString === 'now') return timeString.toUpperCase();

          if (timeString.substr(0,3) === 'now') {
            var unitFullString;
            if (timeString.substr(3,1) === '-' || timeString.substr(3,1) === '+') {
              // e.g. now-1d OR now-1d/d
              var timeArray = timeString.substr(4).split('/');

              if (timeArray.length === 1) {
                // e.g. now-1d, now-15m
                unitFullString = convertUnit(timeArray[0]);
                return 'NOW' + timeString.substr(3,1) + unitFullString;
              } else {
                // e.g. now-1d/d, now-15m/m
                var unit1 = convertUnit(timeArray[0]);
                var unit2 = convertUnit(timeArray[1]);
                return 'NOW' + timeString.substr(3,1) + unit1 + '/' + unit2;
              }
            } else if (timeString.substr(3,1) === '/') {
              // e.g. now/d
              unitFullString = convertUnit(timeString.substr(4,1));
              return 'NOW/' + unitFullString;
            }
          }

          return timeString;
        };

        var roundOff = function (number, roundToN) {
          var rounded = '';
          var numberLength = number.toString().length;
          for(var i = numberLength; i < roundToN; i+=1){
            rounded += '0';
          }
          rounded += number.toString();
          return rounded;
        };

        // This function will also take care of the non-moment objects.
        // Function to convert time object to DateMathParser type string.
        var convertTime = function (timeObject) { // jshint ignore:line
          // console.log("timeObject = ", timeObject);
          if (timeObject._isAMomentObject) {
            var i = timeObject._d;
            // console.log("i = ", i);
            if (i instanceof Date) {
              // console.log("i.toUTCString() = ", i.toUTCString());
              var dateString = i.getUTCFullYear() + '-' +
                roundOff(i.getUTCMonth() + 1,2) + '-' +
                roundOff(i.getUTCDate(),2) + 'T' +
                roundOff(i.getUTCHours(),2) + ':' +
                roundOff(i.getUTCMinutes(),2) + ':' +
                roundOff(i.getUTCSeconds(),2) + '.' +
                i.getUTCMilliseconds() + 'Z';
              // console.log("dateString = ", dateString);
              return dateString;
            } else {
              return i;
            }
          } else {
            return convertToSolrDateTime(timeObject);
          }
        };

        /************** Now we start to parse reqsFetchParams **************/
        // reqsFetchParams is an array of requests, we have to process them all.
        var clientPromises = _.map(reqsFetchParams, function (req) {
          // console.log('reqsFetchParams req =', req);
          var solrReqUrl;
          var solrReqData;
          var aggregationType = []; // Determine what kinds of aggregation are. Can be more than one at a time.
          var metricId; // Each aggregate will contain metricId.
          var metricIdForBucket; // Used for storing subMetricId in Filters bucket agg.
          var aggType; // Determine stats func inside aggs object.
          var locationField; // For geospatial search.
          var precision; // For geohash encode.
          var q;

          //Facet check
          if (strategy.clientMethod === 'msearch') {
            var timeField,from,to;
            var reqBodyQuery = req.body.query;
            var reqFiltered = reqBodyQuery.filtered;
            var isMatchAll = _.get(reqFiltered, 'query.match_all') || _.get(req.body, 'query.match_all');
            var reqFieldData = req.body.fielddata_fields;
            var reqQueryString = '';

            if (isMatchAll) {
              reqQueryString = '*:*';
            } else {
              reqQueryString = reqBodyQuery.query_string || reqFiltered.query.query_string.query;
            }

            var aggs = req.body.aggs;
            var fqTimefilter = '';
            var facetQuery = '';
            var statsQuery = ''; // For calculating stats (Aggregations in Visualize page)

            //Extra query for dashboard etc.
            var fqQueries = '';
            if (reqFiltered) {
              fqQueries = parseFilterQuery(reqFiltered).join('&');
              fqQueries = fqQueries.replace(/^&|&$/g, '');
              // console.log('fqQueries =', fqQueries);
            }

            var getTimeRangeObject = function getTimeRangeObject() {
              return _.filter(reqFiltered.filter.bool.must, function (item, key) { //TODO: not sure if this will work all the time
                if (_.has(item, 'range')) {
                  return true;
                } else {
                  return false;
                }
              })[0];
            };

            // These ifs are very imparative. please check the values that are already on the params before doing anything rash! 
            if (!_.isEmpty(aggs)) { //Aggregations
              _.forEach(aggs, function (item, key) {
                /**
                 * Aggregations:
                 *   For metrics:
                 *     avg
                 *     sum
                 *     min
                 *     max
                 *     extended_stats (standard deviation)
                 *
                 *   For buckets:
                 *     date_histogram
                 *     range
                 *     terms
                 *     filters
                 *     geohash_grid
                 *
                 * NOTES: If the request contains both buckets and metrics (for example, to compute stats on facet.range),
                 *        then item will contain another 'aggs' obj with its own metricIds for each of the metrics that
                 *        needed to be computed.
                 */
                // console.log('item, key (metricId) =', item, key);
                var bucketFacet; // JSON API bucketing facets
                metricId = key;

                /*************** Buckets *****************/
                if (_.has(item, 'date_histogram')) {
                  aggregationType.push('date_histogram');
                  bucketFacet = 'range';
                  timeField = item.date_histogram.field;

                  try {
                    from = getTimeRangeObject().range[timeField].from;
                    to = getTimeRangeObject().range[timeField].to;
                  } catch (error) {
                    var timeField2 = _.map(getTimeRangeObject().range,function(item, key){
                      return key;
                    })[0];
                    from = getTimeRangeObject().range[timeField2].from;
                    to = getTimeRangeObject().range[timeField2].to;
                  }

                  from = convertTime(from);
                  to = convertTime(to);
                  var interval = aggs[metricId].date_histogram.interval;
                  facetQuery = 'facet=true&facet.range=' + timeField +
                      '&facet.range.start=' + from +
                      '&facet.range.end=' + to +
                      '&facet.range.gap=' + encodeURIComponent(convertTimeUnit(interval));
                }

                if (_.has(item, 'range')) { // Only work with numbers
                  aggregationType.push('range');
                  bucketFacet = 'range';
                  facetQuery = 'facet=true';
                  _.each(item.range.ranges, function (rangeObj) {
                    facetQuery += '&facet.query=' + item.range.field + ':[' + rangeObj.from + ' TO ' + rangeObj.to + ']';
                  });
                }

                if (_.has(item, 'terms')) {
                  // TODO: sorting
                  aggregationType.push('terms');
                  bucketFacet = 'terms';
                  facetQuery = 'facet=true&facet.field=' + item.terms.field + '&facet.limit=' + item.terms.size;
                }

                if (_.has(item, 'filters')) {
                  aggregationType.push('filters');
                  bucketFacet = 'query';
                  facetQuery = 'facet=true';
                  _.each(item.filters.filters, function (filterObj) {
                    facetQuery += '&facet.query=' + filterObj.query.query_string.query;
                  });
                }

                if (_.has(item, 'geohash_grid')) {
                  aggregationType.push('geohash_grid');
                  bucketFacet = 'geohash_grid';
                  locationField = item.geohash_grid.field;
                  precision = item.geohash_grid.precision;
                  // TESTING
                  // Use facetQuery variable for geo query. BUT we currently have no way to specify bbox and d in UI.
                  // facetQuery = '&spatial=true&fq=%7B!bbox%7D&pt=35%2C-97&d=10&sfield=' + locationField;
                }
                /************** end of Buckets **************/
                /************** Metrics *******************/
                if (_.has(item, 'avg')) {
                  aggregationType.push('avg');
                  statsQuery = '&stats=true&stats.field=' + item.avg.field;
                }

                if (_.has(item, 'sum')) {
                  aggregationType.push('sum');
                  statsQuery = '&stats=true&stats.field=' + item.sum.field;
                }

                if (_.has(item, 'min')) {
                  aggregationType.push('min');
                  statsQuery = '&stats=true&stats.field=' + item.min.field;
                }

                if (_.has(item, 'max')) {
                  aggregationType.push('max');
                  statsQuery = '&stats=true&stats.field=' + item.max.field;
                }

                if (_.has(item, 'extended_stats')) { // stddev
                  aggregationType.push('extended_stats');
                  statsQuery = '&stats=true&stats.field=' + item.extended_stats.field;
                }

                // For computing stats in each bucket, we will use Solr's JSON API Faceted Search
                // https://cwiki.apache.org/confluence/display/solr/Faceted+Search
                if (_.has(item, 'aggs')) {
                  aggregationType.push('aggs');
                  _.each(item.aggs, function (aggObj, subMetricId) {
                    // console.log('aggObj, subMetricId', aggObj, subMetricId);
                    // NOTE: JSON API does not support stddev yet.
                    if (aggObj.avg) {
                      aggType = 'avg';
                    } else if (aggObj.sum) {
                      aggType = 'sum';
                    } else if (aggObj.min) {
                      aggType = 'min';
                    } else if (aggObj.max) {
                      aggType = 'max';
                    } else {
                      defer.reject(new Error('Unsupported stats operation. Try to select a different metric or bucket.'));
                    }

                    statsQuery += '&json.facet=';
                    var jsonFacet = {};

                    if (bucketFacet === 'terms') {
                      jsonFacet[subMetricId] = {};
                      jsonFacet[subMetricId][bucketFacet] = {
                        field: item.terms.field,
                        limit: item.terms.size,
                        facet: {}
                      };
                      jsonFacet[subMetricId][bucketFacet].facet[aggType] = aggType + '(' + aggObj[aggType].field + ')';

                    } else if (bucketFacet === 'query') {
                      metricIdForBucket = subMetricId;
                      _.each(item.filters.filters, function (filterObj) {
                        var filterQ = filterObj.query.query_string.query;
                        jsonFacet[filterQ] = { query: {} };
                        jsonFacet[filterQ].query.q = filterQ;
                        jsonFacet[filterQ].query.facet = {};
                        jsonFacet[filterQ].query.facet[aggType] = aggType + '(' + aggObj[aggType].field + ')';
                      });

                    } else if (bucketFacet === 'range') {
                      // for data_histogram and range buckets
                      if (aggregationType.indexOf('date_histogram') !== -1) {
                        var from;
                        var to;
                        try {
                          from = getTimeRangeObject().range[timeField].from;
                          to = getTimeRangeObject().range[timeField].to;
                        } catch (error) {
                          var timeField2 = _.map(getTimeRangeObject().range,function(item, key){
                            return key;
                          })[0];
                          from = getTimeRangeObject().range[timeField2].from;
                          to = getTimeRangeObject().range[timeField2].to;
                        }

                        from = convertTime(from);
                        to = convertTime(to);

                        jsonFacet[subMetricId] = {};
                        jsonFacet[subMetricId][bucketFacet] = {
                          field: item.date_histogram.field,
                          start: from,
                          end: to,
                          gap: encodeURIComponent(convertTimeUnit(item.date_histogram.interval)),
                          facet: {}
                        };
                        jsonFacet[subMetricId][bucketFacet].facet[aggType] = aggType + '(' + aggObj[aggType].field + ')';

                      } else if (aggregationType.indexOf('range') !== -1) {
                        // Unfortunately, JSON API only support facet.range style, which need gap param.
                        // It does not support arbitary (or custom) range values, so we have to use multiple query facets here.
                        metricIdForBucket = subMetricId;
                        _.each(item.range.ranges, function (rangeObj) {
                          var rangeName = rangeObj.from + '-' + rangeObj.to;
                          jsonFacet[rangeName] = {
                            query: {
                              q: item.range.field + ':[' + rangeObj.from + ' TO ' + rangeObj.to + ']',
                              facet: {}
                            }
                          };
                          jsonFacet[rangeName].query.facet[aggType] = aggType + '(' + aggObj[aggType].field + ')';
                        });

                      } else {
                        defer.reject(new Error('Unsupported stats operation. Try to select a different metric or bucket.'));
                      }
                    }

                    statsQuery += JSON.stringify(jsonFacet);
                  });
                }
                /************** end of Metrics *******************/
              });
            }

            // Check for time filter, if true then this is a time-series data. Add fq for the time field.
            if (!isMatchAll && !_.isEmpty(aggs) && reqFieldData && reqFiltered) {
              timeField = _.keys(getTimeRangeObject().range)[0];
              from = getTimeRangeObject().range[timeField].from;
              to = getTimeRangeObject().range[timeField].to;

              // Need to parse time strings to Solr format
              from = convertTime(from);
              to = convertTime(to);

              fqTimefilter = '&fq=' + timeField + ':[' + from.toUpperCase() + ' TO ' + to.toUpperCase() + ']';
            }

            var queryString;
            // console.log('isMatchAll = ', isMatchAll);
            // console.log('reqQueryString = ', reqQueryString);
            if (isMatchAll) {
              queryString = '*:*';
            } else {
              try { //TODO: Better error handling
                if(_.isObject(reqQueryString)){
                    queryString = parseQueryString(reqQueryString.query);
                }
                else if(_.isString(reqQueryString)){
                    queryString = parseQueryString(reqQueryString);
                }
              } catch (error) {
                queryString = parseQueryString('');
              }
            }

            fqHighlight = 'hl.fl=*&hl=true&hl.simple.pre=@kibana-highlighted-field@&hl.simple.post=@/kibana-highlighted-field@';
            q = (queryString.replace(/\b/, '')==='')?'*:*':queryString;

            solrReqData = 'wt=json&' + fqQueries + '&' + fqHighlight + '&' + facetQuery +
              '&q=' + q + '&rows=' + (window.bananaProps.scrollLimit||60) + fqTimefilter + statsQuery;
            // Replace double & characters with one character.
            solrReqData = solrReqData.replace(/&&/g, '&');
            solrReqUrl = configFile.solr + '/' + req.index + '/select';

          } else if (strategy.clientMethod === 'mget') {
            // For strategy mget, we do not use search query.
            // mget will be used when saving obj in the dashboard.
            q = '_id:' + req._id + ' AND _type:' + req._type;
            solrReqData = 'wt=json&q=' + q;
            solrReqUrl = configFile.solr + '/' + req._index + '/select';
          }

          // console.log('solrReqUrl =', solrReqUrl);
          // console.log('solrReqData =', solrReqData);

          var solrReqConfig = {
            headers: {'Content-type':'application/x-www-form-urlencoded'}
          };

          return $http.post(solrReqUrl, solrReqData, solrReqConfig)
          .then(function (resp) {
            // console.log('Solr resp =', resp);
            // console.log('strategy.clientMethod =', strategy.clientMethod);
            if (strategy.clientMethod === 'msearch') {
              var numFound = resp.data.response.numFound; // the total num of match
              var qtime = resp.data.responseHeader.QTime; // query response time in ms

              // Transform Solr resp into ES compat format
              var docs = _.map(resp.data.response.docs, function(doc) {
                var highlights = {};
                //TODO: Figure out how to make it better. The single element arrat
                _.forEach(resp.data.highlighting, function (hlDoc, hlDocId) {
                  if (hlDocId === doc.id) {
                    _.forEach(hlDoc, function (elem, key) {
                      highlights[key] = [elem[0]];
                    });
                  }
                });

                return {
                  "_id": doc.id,
                  "_index": req.index,
                  "_score": null,
                  "_type": "logs",
                  "_source": doc,
                  "highlight": highlights
                };
              });

              // Buckets
              var timeField = resp.data.responseHeader.params['facet.range'];
              var facetField = resp.data.responseHeader.params['facet.field'];
              // Stats
              var aggregations = {};
              var statsField = resp.data.responseHeader.params['stats.field'];

              /**************** Buckets aggregations ****************/
              // For time-series data, compute the aggregate for facets to plot histogram
              if (aggregationType.indexOf('date_histogram') !== -1) {
                var facetArray = resp.data.facet_counts.facet_ranges[timeField].counts;
                var facetObject = {};

                if (aggregationType.indexOf('aggs') === -1) {
                  aggregations[metricId] = { 'buckets': [] }
                  for (var i = 0; i < facetArray.length; i += 2) { //Converting standard face.range response to face.date response
                    facetObject[facetArray[i]] = facetArray[i + 1];
                  }
                  aggregations[metricId]['buckets'] = _.map(facetObject,function(item,key){
                    var epochTime;
                    var newKey = key.replace(/(\d\d\d\d)\-(\d\d)\-(\d\d)T(\d\d)\:(\d\d)\:(\d\d)\.?\d*Z/, function (wholeMatch, m1, m2, m3, m4, m5, m6) {
                      epochTime = (new Date(m1,parseInt(m2)-1,m3,m4,m5,m6)).getTime() - ((new Date()).getTimezoneOffset()) * 60000; //Setting the timezone offset
                      return m1 + '-' + m2 + '-' + m3 + 'T' + m4 + ':' + m5 + ':' + m6.split('.')[0] + ':00Z';
                    });

                    return {
                      "doc_count": item,
                      "key": epochTime,
                      "key_as_string": newKey
                    };
                  });

                } else {
                  _.each(resp.data.facets, function (bucketArray, subMetricId) {
                    if (subMetricId > 0) {
                      aggregations[metricId] = { 'buckets': bucketArray.buckets };
                      _.each(aggregations[metricId].buckets, function(bucketItem, i) {
                        // rename 'count' => 'doc_count'
                        // rename 'val' => 'key_as_string'
                        // 'key' => epoch time
                        aggregations[metricId].buckets[i].key_as_string = bucketItem.val;
                        aggregations[metricId].buckets[i].doc_count = bucketItem.count;
                        aggregations[metricId].buckets[i].key = new Date(bucketItem.val).getTime();
                        aggregations[metricId].buckets[i][subMetricId] = {
                          value: bucketItem[aggType] || 0
                        };
                        delete bucketItem.val;
                        delete bucketItem.count;
                        delete bucketItem[aggType];
                      });
                    }
                  });
                }
              }

              if (aggregationType.indexOf('terms') !== -1) {
                if (aggregationType.indexOf('aggs') === -1) {
                  var facetArray = resp.data.facet_counts.facet_fields[facetField];
                  var facetObject = {};
                  aggregations[metricId] = { 'buckets': [] };
                  for (var i = 0; i < facetArray.length; i += 2) { //Converting standard face.range response to face.date response
                    facetObject[facetArray[i]] = facetArray[i + 1];
                  }
                  aggregations[metricId]['buckets'] = _.map(facetObject, function(item, key){
                    return {
                      "doc_count": item,
                      "key": key
                    };
                  });

                } else {
                  _.each(resp.data.facets, function (bucketArray, subMetricId) {
                    if (subMetricId > 0) {
                      aggregations[metricId] = { 'buckets': bucketArray.buckets };
                      _.each(aggregations[metricId].buckets, function(bucketItem, i) {
                        // rename 'count' => 'doc_count'
                        // rename 'val' => 'key'
                        aggregations[metricId].buckets[i].key = bucketItem.val;
                        aggregations[metricId].buckets[i].doc_count = bucketItem.count;
                        aggregations[metricId].buckets[i][subMetricId] = {
                          value: bucketItem[aggType] || 0
                        };
                        delete bucketItem.val;
                        delete bucketItem.count;
                        delete bucketItem[aggType];
                      });
                    }
                  });
                }
              }

              if (aggregationType.indexOf('range') !== -1) {
                // This function is for parsing facetQuery to get the values for 'from' and 'to'.
                // An example of facetQ => "value_d:[0 TO 1000]"
                // The return value     => ["[0 TO 1000]", "0", "1000"]
                function parseFacetQueries(facetQ) {
                  return facetQ.match(/\[(\d+) TO (\d+)\]/);
                }

                var buckets = {};
                if (aggregationType.indexOf('aggs') === -1) {
                  buckets = _.transform(resp.data.facet_counts.facet_queries, function (result, value, key) {
                    // console.log('value, key = ', value, key);
                    var parsedKeys = parseFacetQueries(key);
                    // console.log('parsedKeys = ', parsedKeys);

                    if (!parsedKeys) return {};

                    // convert key to pretty string value
                    key = parsedKeys[1] + '-' + parsedKeys[2];

                    return result[key] = {
                      doc_count: value,
                      from: Number(parsedKeys[1]),
                      from_as_string: parsedKeys[1],
                      to: Number(parsedKeys[2]),
                      to_as_string: parsedKeys[2]
                    };
                  });

                } else {
                  buckets = _.transform(resp.data.facets, function (result, facetObj, key) {
                    // e.g. key => '0-500'
                    if (key === 'count') return {};

                    var parsedKeys = key.split('-');
                    result[key] = {
                      doc_count: facetObj.count,
                      from: Number(parsedKeys[0]),
                      from_as_string: parsedKeys[0],
                      to: Number(parsedKeys[1]),
                      to_as_string: parsedKeys[1]
                    };
                    result[key][metricIdForBucket] = { value: facetObj[aggType] || 0 };
                    return result;
                  });
                }
                aggregations[metricId] = { buckets };
              }

              if (aggregationType.indexOf('filters') !== -1) {
                var buckets = {};
                if (aggregationType.indexOf('aggs') === -1) {
                  // Parsing 'filters' will be similar to 'range' and we do not need
                  // to make pretty string value.
                  buckets = _.transform(resp.data.facet_counts.facet_queries, function (result, value, key) {
                    return result[key] = {
                      'doc_count': value
                    };
                  });

                } else {
                  buckets = _.transform(resp.data.facets, function (result, facetObj, key) {
                    if (key !== 'count') {
                      result[key] = { 'doc_count': facetObj.count };
                      result[key][metricIdForBucket] = { value: facetObj[aggType] || 0 };
                      return result;
                    }
                  });
                }
                aggregations[metricId] = { buckets };
              }

              if (aggregationType.indexOf('geohash_grid') !== -1) {
                var buckets = [];
                if (aggregationType.indexOf('aggs') === -1) {
                  // For Count metric
                  //   Example:
                  //     buckets = [
                  //       { "key": "svz", "doc_count": 10000 },
                  //       { "key": "sv8", "doc_count": 3000 }
                  //     ];
                  buckets = _.compact(_.map(docs, function(doc) {
                    if (doc._source[locationField]) {
                      var latlon = doc._source[locationField].split(',');
                      var lat, lon;

                      if (latlon.length === 2) {
                        lat = latlon[0];
                        lon = latlon[1];
                      } else {
                        defer.reject('Geo field is not the correct format.');
                      }

                      return {
                        'key': latlonGeohash.encode(lat, lon, precision)
                      };
                    }
                  }));
                  // Need to sum doc_count values for the same key in buckets.
                  buckets = _.map(_.countBy(buckets, 'key'), function(v,k) {
                    return {'key': k, 'doc_count': v};
                  });

                }
                aggregations[metricId] = { buckets };
              }
              /*************** end of Buckets aggregations ***************/
              /************** Metrics aggregations ****************/
              if (statsField) {
                if (aggregationType.indexOf('avg') !== -1) {
                  aggregations[metricId] = {
                    'value': resp.data.stats.stats_fields[statsField].mean
                  };
                }

                if (aggregationType.indexOf('sum') !== -1) {
                  aggregations[metricId] = {
                    'value': resp.data.stats.stats_fields[statsField].sum
                  };
                }

                if (aggregationType.indexOf('min') !== -1) {
                  aggregations[metricId] = {
                    'value': resp.data.stats.stats_fields[statsField].min
                  };
                }

                if (aggregationType.indexOf('max') !== -1) {
                  aggregations[metricId] = {
                    'value': resp.data.stats.stats_fields[statsField].max
                  };
                }

                if (aggregationType.indexOf('extended_stats') !== -1) {
                  var avgValue = resp.data.stats.stats_fields[statsField].mean;
                  var stddevValue = resp.data.stats.stats_fields[statsField].stddev;
                  aggregations[metricId] = {
                    'avg': avgValue,
                    'std_deviation': stddevValue,
                    'std_deviation_bounds': {
                      'lower': avgValue - stddevValue,
                      'upper': avgValue + stddevValue
                    }
                  };
                }
              }
              /************** end of Metrics aggregations ****************/
              // console.log("aggregations = ", aggregations);
              var clientResp = [
                {
                  "_shards": {
                    "failed": 0,
                    "successful": 1,
                    "total": 1
                  },
                  "aggregations": aggregations,
                  "hits": {
                    "hits": docs,
                    "max_score": null,
                    "total": numFound
                  },
                  "timed_out": false,
                  "took": qtime
                }
              ];
              // console.log('clientResp =',clientResp);
              return clientResp;
            } else if (strategy.clientMethod === 'mget') {
              // Deserialize _source field into JSON and convert clientResp into array for ES compat
              var clientResp = resp.data.response.docs[0];
              clientResp._source = angular.fromJson(clientResp._source);
              clientResp = [clientResp];
              // console.log('mget clientResp =', clientResp);
              return clientResp;
            }
          });
        });

        // console.log('clientPromises =', clientPromises);
        return Promise.all(clientPromises).then(function (respArray) {
          return _.map(respArray, function (resp) {
            return resp[0];
          });
        });
      })
      // Don't need the following because body is returned as ES string for req body.
      //
      // .then(function (body) {
      //   // while the strategy was converting, our request was aborted
      //   if (esPromise === ABORTED) {
      //     throw ABORTED;
      //   }
      //   return (esPromise = es[strategy.clientMethod]({
      //     timeout: configFile.shard_timeout,
      //     ignore_unavailable: true,
      //     preference: sessionId,
      //     body: body
      //   }));
      // })
      // .then(function (clientResp) {
      //   return strategy.getResponses(clientResp);
      // })
      .then(respond)
      .catch(function (err) {
        if (err === ABORTED) respond();
        else defer.reject(err);
      });

      // return our promise, but catch any errors we create and
      // send them to the requests
      return defer.promise
      .catch(function (err) {
        requests.forEach(function (req, i) {
          if (statuses[i] !== ABORTED) {
            req.handleFailure(err);
          }
        });
      });
    }

    return callClient;
  };
});
