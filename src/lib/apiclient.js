/**
 * the api client for Ephemeral exchange
 */
var api = (function(ns) {
  "use strict";

  /**
   * need axios for http operations
   * that should also bring in es6 which is needed anyway
   */
  var axios = require('axios');
  var config = require('./config.js');
  var Socketing = require('./socketing');


  // the api base url
  let ax;
  let admin;
  let apiEnv;
  let sting;

  /**
   * select environment
   * @param {string} env (dev/prod)
   * @return {object} self
   */
  ns.setEnv = function(en) {

    if (!config[en]) {
      throw 'unknown environment ' + en;
    }

    // copy over the config
    apiEnv = JSON.parse(JSON.stringify(config[en]));

    // set up axios to api version
    ax = axios.create({
      baseURL: apiEnv.base + ":" + apiEnv.basePort
    });

    return ns;
  };

  // set the default environment
  ns.setEnv('prod');

  /**
   * handy if running as browser client
   * @param {string} source where to look
   * @param {string} name the param to look for
   */
  ns.getUriParam = function (name, source) {
    if (typeof window === typeof undefined ) return null;

    source = source ||  (window.location && window.location.search) || "";
    var match = source && RegExp('[?&]' + name + '=([^&]*)').exec(source);
    return source && match && decodeURIComponent(match[1].replace(/\+/g, ' '));
  };
  
  /**
   * standard parameters that might useful for an effex app
   * @return {object} keys
   */
  ns.getUriKeys = function() {
    var ob = ["updater", "reader", "item","boss","writer","alias","id"]
      .reduce(function(p, c) {
        p[c] = ns.getUriParam(c);
        return p;
      }, {});
      
      // updaters/writers can standin for readers
      ob.updater = ob.updater || ob.writer;
      ob.reader = ob.reader || ob.updater || ob.writer;

      return ob;
  };
  
    
  // if there are any params in the uri, we'll set them up as defaults
  let keys = ns.getUriKeys() || {};
  
  
  // generate a unique number for the session id
  let session = Math.round(Math.random() * 2048).toString(32) + new Date().getTime().toString(32);
  let pushId = session;

  /**
   * gets the session name
   * this is a unique number assigned to this session
   * its main use is to see whether items returned by push modifications were chnged by this session or another
   * @return {string} the session if
   */
  ns.getSession = function() {
    return session;
  };

  /**
   * allows setting of a custom session name
   * not normally required
   * @param {string} sessionName the name to give this session
   * @return {object} self
   */
  ns.setSession = function(sessionName) {
    session = sessionName;
    return ns;
  };


  /**
   * @param {string} [base] the base url
   * @param {string} [adminKey] not required for regular client use as its for accout management with a console app
   * @param {string} [sockBase] socket base for push operations
   * @param {string} [sockPort] socket port for push operations
   * @return {object} self
   */
  ns.setBase = function(base, adminKey, sockBase, sockPort) {

    apiEnv.socketPort = sockPort || apiEnv.socketPort;
    apiEnv.socketBase = sockBase || apiEnv.socketBase;
    apiEnv.base = base || apiEnv.base;

    // if its changed
    if (base) {
      ax = axios.create({
        baseURL: base + ":" + apiEnv.basePort
      });
    }

    admin = adminKey;

    return ns;
  };


  /**
   * turns a params object into a url
   * @param {object} params the params
   * @return {string} the uri
   */
  function makeParams(params) {
    params = params || {};

    // mark who this request is from
    params.session = params.session || session;

    const pa = Object.keys(params).reduce(function(p, c) {
      p.push(`${c}=${encodeURIComponent(params[c])}`);
      return p;
    }, []);

    return pa.length ? `?${pa.join("&")}` : "";
  }

  /**
   * turns a params object into an a url + admin key 
   * @param {object} params the params
   * @return {string} the uri
   */
  function makeAdmin(params) {
    return makeParams({...(params || {}),
      admin: admin
    });
  }

  /**
   * @param {string} accountId the account id
   * @param {string} planId the plan type
   * @param {object} params the lifetime of the key in seconds
   * @return {Promise} to the result
   */
  ns.generateBoss = function(accountId, planId, params) {
    return ax.get(`/admin/account/${accountId}/boss/${planId}${makeAdmin(params)}`);
  };


  /**
   * generates a complete set of keys and sets them as default
   * @param {string} boss the boss key
   * @param {object} params the params 
   * @return {Promise} to the result
   */
  ns.makeKeys = function(boss, params) {
    var modes = ["reader", "writer", "updater"];
    return Promise.all(modes.map(function(mode) {
        return ax.get(`/${boss}/${mode}${makeParams(params)}`);
      }))
      .then(function(results) {
        if (!results.every(function(d) {
            return d.data && d.data.ok;
          })) {
          throw 'failed to generate all keys ' + JSON.stringify(results.map(function(d) {
            return d.data
          }));
        }
        else {
          ns.setKeys(modes.reduce(function(p, c, i) {
            p[c] = results[i].data.keys[0];
            return p;
          }, {}));
        }
        return ns.getKeys();
      });

  };

  /**
   * @param {string} boss the boss key
   * @param {string} mode the type like writer/reader/updater
   * @param {object} params the params 
   * @return {Promise} to the result
   */
  ns.generateKey = function(boss, mode, params) {
    return ax.get(`/${boss}/${mode}${makeParams(params)}`);
  };

  /**
   * ping the service
   * @return {string} "PONG"
   */
  ns.ping = function() {
    return ax.get('/ping');
  };

  /**
   * info the service
   * @return {string} "PONG"
   */
  ns.info = function() {
    return ax.get('/info');
  };

  ns.setKeys = function(pkeys) {
    keys = pkeys;
  };

  ns.getKeys = function() {
    return keys;
  };

  /**
   * get quotas 
   * @return {object} the quotas
   */
  ns.getQuotas = function() {
    return ax.get('/quotas');
  };

  /**
   * update an item
   * @param {string} id the item id
   * @param {string} updater the updater key
   * @param {object} data what to write
   * @param {string} method the to use (post,get)
   * @param {object} params the params 
   * @return {Promise} to the result
   */
  ns.update = function(data, id, updater, method, params) {

    method = method || "post";
    method = method.toLowerCase ? method.toLowerCase() : "";
    updater = updater || keys.updater;
    params = params || {};

    if (method === "get") {
      params = {...params,
        data: data
      };
      return ax.get(`/updater/${updater}/${encodeURIComponent(id)}${makeParams(params)}`);
    }
    else if (method === "post") {
      return ax.post(`/updater/${updater}/${encodeURIComponent(id)}${makeParams(params)}`, {
        data: data
      });
    }
    else {
      return Promise.reject("invalid method:" + method);
    }

  };

  /**
   * write an item, with an alias
   * @param {string} alias the alias to generate for the writer, plus any optional readers or updaters
   * @param {string} writer the writer key
   * @param {object} data what to write
   * @param {string} method the to use (post,get)
   * @param {object} params the params 
   * @return {Promise} to the result
   */
  ns.writeAlias = function(data, alias, writer, method, params) {
    method = method || "POST";
    writer = writer || keys.writer;
    method = method.toLowerCase ? method.toLowerCase() : "";
    params = params || {};

    if (!alias) {
      return Promise.reject("you need to provide an alias");
    }

    var url = `/writer/${writer}/alias/${alias}${makeParams(params)}`;

    if (method === "get") {
      params = {...params,
        data: JSON.stringify(data)
      };
      return ax.get(url);
    }
    else if (method === "post") {
      return ax.post(url, {
        data: data
      });
    }
    else {
      return Promise.reject("invalid method:" + method);
    }

  };

  /**
   * @param {string} writer the writer key
   * @param {object} data what to write
   * @param {string} method the to use (post,get)
   * @param {object} params the params 
   * @return {Promise} to the result
   */
  ns.write = function(data, writer, method, params) {
    method = method || "POST";
    writer = writer || keys.writer;
    method = method.toLowerCase ? method.toLowerCase() : "";
    params = params || {};

    if (method === "get") {
      params = {...params,
        data: JSON.stringify(data)
      };
      return ax.get(`/writer/${writer}${makeParams(params)}`);
    }
    else if (method === "post") {
      return ax.post(`/writer/${writer}${makeParams(params)}`, {
        data: data
      });
    }
    else {
      return Promise.reject("invalid method:" + method);
    }

  };

  /**
   * @param {string} id the item id or its alias
   * @param {string} key the key to use to authorize watching
   * @param {string} event the kind of event to watch
   * @param {function||string} callback what to call when it happens - in the case of url type, this is a url
   * @param {object} options any watch options
   * @param {object} params any params
   * @return {Promise} to the result
   */
  ns.on = function(event, id, key, callback, options, params) {

    // set up default watch parameters
    var pack = defWatchParams_(callback, options);
    if (!pack.data.ok) {
      return Promise.reject(pack);
    }
    var watch = pack.data.value;
    watch.event = event;

    // this is how we'll refer to this watch during push connections
    watch.options.uq = Math.round(Math.random() * 2048).toString(32) + new Date().getTime().toString(32);

    // the true id doesnt actually exist until we've had
    // a successful conversation with the server
    // this is a nique id till that happens, ot for pull types that dont use the server
    watch.watchable = watch.options.uq;

    // initiate the watcher
    return new Promise((resolve, reject) => {
      try {

        switch (watch.options.type) {
          case 'push':
            // if we dont have it lready, bring it in
            if (!sting) {
              sting = new Socketing(apiEnv);
            }

            // get connected, and set a socket on for this uq.
            createPushConnection_(watch.options.uq, watch.callback)
              .then(() => {
                return ns.onRegister(id, key, event, watch.options, params);
              })
              .then((result) => {
                watch.watchable = result.data.watchable;
                ns.watching[watch.watchable] = watch;
                resolve(watch);
              })
              .catch((err) => reject(err));
            break;

          case 'url':
            ns.onRegister(id, key, event, watch.options, params)
              .then((result) => {
                watch.watchable = result.data.watchable;
                ns.watching[watch.watchable] = watch;
                resolve(watch);
              })
              .catch((err) => reject(err));
            break;

          case 'pull':
            // this one all happens in the client
            doPull_(id, key, event, watch, params);
            ns.watching[watch.watchable] = watch;
            resolve(watch);
            break;

          default:
            reject({
              ok: false,
              code: 500,
              error: "impossible watch type",
              value: watch
            });

        }
      }
      catch (err) {
        reject(err);
      }
    });

  };

  /**
   * does a timed looper
   * pull watch
   * @param {string} id the item id/alias
   * @param {string} key the key to use
   * @param {string} event the event to watch
   * @param {object} watch the watch itme
   * @param {object} [params] and additional params
   */
  function doPull_(id, key, event, watch, params) {

    params = params || {};
    if (watch.options.start > 0 && !params.since) {
      params.since = watch.options.start;
    }

    // this is  recursive
    function p() {

      // that's the signal its all over
      if (watch.stopped) return;

      // go and do a poll 
      ns.getEventLog(id, key, event, params)
        .then(function(result) {
          var pack = result.data;
          if (!pack.ok) {
            watch.stopped = true;
            throw 'polling error ' + JSON.stringify(pack);
          }

          // if we got some events, do the callback and update for the next one.
          if (pack.value.length && !watch.stopped) {

            watch.callback(watch.watchable, {
              id: pack.id,
              alias: pack.alias,
              event: pack.event,
              session: ns.getSession(),
              message: watch.message || "",
              key: key,
              value: pack.value,
              nextevent: pack.nextevent,
              lastindex: pack.lastindex,
              watchable: watch.watchable
            });
            // this can be used to manage picking off items
            params.lastindex = pack.lastindex;

          }
          // cycle for the next
          ns.handyTimer(watch.options.frequency * 1000, watch.watchable).then(p);
        });

    }

    // start it 
    return p();
  }

  /**
   * create a connection
   * for push otification
   */
  function createPushConnection_(watchableId, callback) {

    // if we dont have a connection, make one
    return sting.getConnected(pushId)
      .then((res) => {

        // add extra message if its needed
        //console.log("back from connecting", sting.connection.socket.id, sting.connection.pushId);

        // now we can look out for things happening - the trigger is the watch.id
        sting.connection.socket.on(watchableId, function(data, sall) {
          // let it know we received it
          sall('copythat');
          // call the user function
          callback(watchableId, data);
        });

        return res;

      });
  }

  /**
   * set any watch parameters
   * @param {object} options the watch options
   * @return {object} a watch ob
   */
  function defWatchParams_(callback, options) {

    var watch = {
      options: {
        type: "push", // default
        frequency: 30, // how often to poll
        start: -1, // timestamp to accept events from - if -1, the server will set the time .. (becs server/client clocks are usua;ly out of sync)
        method: "POST", // will be used for URL type callback method
        message: "" // additional info to pass to receiver

      }
    };

    // sort out the options
    if (options) {
      Object.keys(options).forEach(function(d) {
        if (watch.options.hasOwnProperty(d)) {
          watch.options[d] = options[d];
        }
        else {
          return {
            data: {
              ok: false,
              error: 'invalid watch option property ' + d,
              code: 400,
              value: options
            }
          };
        }
      });
    }

    if (watch.options.type === "push" || watch.options.type === "pull") {
      var ok = typeof callback === "function";
      watch.callback = callback;
      return {
        data: {
          ok: ok,
          error: ok ? "" : "function is needed for " + watch.options.type + " callback",
          code: ok ? 201 : 400,
          value: watch
        }
      };
    }
    else if (watch.options.type === "url") {
      ok = typeof callback === "string";
      if (ok) {
        watch.options.url = callback;
      }
      return {
        data: {
          ok: ok,
          error: ok ? "" : "url string is needed for " + watch.options.type + " callback",
          code: ok ? 201 : 400,
          value: watch
        }
      };
    }
    else {
      return {
        data: {
          ok: false,
          code: 400,
          error: "unknown watch type",
          value: watch
        }
      };
    }
  }

  /**
   * @param {string} id the item id or its alias
   * @param {string} key the key to use to authorize watching
   * @param {string} event the kind of event to watch
   * @param {object} data the watching options
   * @param {object} params any params
   * @return {Promise} to the result
   */
  ns.onRegister = function(id, key, event, data, params) {
    params = params || {};
    data = data || {};
    data.pushid = pushId;
    return ax.post(`/onregister/${key}/${id}/${event}${makeParams(params)}`, {
      data: data
    });
  };

  /**
   * @param {string} watchable the watch id
   * @param {object} params any params
   * @return {Promise} to the result
   */
  ns.offRegister = function(watchable, params) {
    return ax.delete(`/offregister/${watchable}${makeParams(params)}`);
  };

  /**
   * @param {string} id the watchble id
   * @param {string} key the key to use
   * @param {string} event the event name
   * @param {object} params any params
   * @return {Promise} to the result
   */
  ns.getEventLog = function(id, key, event, params) {
    params = params || {};
    return ax.get(`/eventlog/${key}/${id}/${event}${makeParams(params)}`);
  };

  /**
   * @param {string} id the item id
   * @param {string} writer the writer key
   * @param {object} params the params 
   * @return {Promise} to the result
   */
  ns.remove = function(id, writer, params) {
    params = params || {};
    writer = writer || keys.writer;
    return ax.delete(`/writer/${writer}/${encodeURIComponent(id)}${makeParams(params)}`);
  };

  /**
   * @param {string} id the item id
   * @param {string} reader the reader key
   * @param {object} params the params 
   * @return {Promise} to the result
   */
  function read_ (id, reader, params) {
    params = params || {};
    reader = reader || keys.reader;
    return ax.get(`/reader/${reader}/${encodeURIComponent(id)}${makeParams(params)}`);
  };
  
  /**
   * @param {string} id the item id
   * @param {string} reader the reader key
   * @param {object} params the params 
   * @return {Promise} to the result
   */
  ns.read = function (id, reader, params) {
    params = params || {};
    
    // we'll use backoff in case there's an intent that needs looking at
    return ns.expBackoff(
      
      // read an item and decalre an intention to update
      () => read_(id, reader, params),
      
      // function for checking if we want to do a retry, because we got a lock 
      (lastResult) => params.backoff && lastResult.data.code === 423, {
      
        // we have a custom wait time to leverage info about lock lifetime
        setWaitTime: (waitTime, passes, result, proposed) => {
          return Math.min(proposed, ((result && result.data && result.data.intentExpires) || 0) * 1000);
        }
        
      });
  };


  /**
   * @param {string} coupon the coupon code
   * @return {Promise} to the result
   */
  ns.validateKey = function(coupon) {
    return ax.get(`/validate/${coupon}`);
  };

  /**
   * @param {string} accountId the account id
   * @param {string} authid the authid
   * @param {boolean} active whether active
   * @return {Promise} to the result
   */
  ns.registerAccount = function(accountId, authId, active) {
    return ax.post(`/admin/register/${accountId}${makeAdmin()}`, {
      data: {
        authid: authId,
        active: active
      }
    });
  };

  
  /**
   * @param {string} accountId the account id
   * @return {Promise} to the result
   */
  ns.removeAccount = function(accountId) {
    return ax.delete(`/admin/remove/${accountId}${makeAdmin()}`);
  };

  /**
   * @param {string} accountId the account id
   * @return {Promise} to the result
   */
  ns.pruneBosses = function(accountId) {
    return ax.delete(`/admin/prune/${accountId}${makeAdmin()}`);
  };

  /**
   * @param {string} accountId the account id
   * @return {Promise} to the result
   */
  ns.getBosses = function(accountId) {
    return ax.get(`/admin/bosses/${accountId}${makeAdmin()}`);
  };

  /**
   * @param {string} accountId the account id
   * @param {object} params any parameters
   * @return {Promise} to the result
   */
  ns.getStats = function(accountId, params) {
    return ax.get(`/admin/stats/${accountId}${makeAdmin(params)}`);
  };

  /**
   * @param {string} accountId the account id
   * @return {Promise} to the result
   */
  ns.removeBosses = function(bossKeys) {
    return ax.put(`/admin/bosses/${makeAdmin()}`, {
      data: {
        keys: bossKeys
      }
    });
  };


  /**
   * make sure we have keys requred
   * @param {string[]} preview what to look for
   * @param {bool} whether keys are all there
   */
  ns.checkKeys = function (preview) {
    if (!Array.isArray(preview)) preview = [preview];
    return preview.every(function(d){ return keys[d]});
  };
  
  ns.registerAlias = function(writer, key, id, alias, params) {
    return ax.get(`/${writer}/${key}/alias/${encodeURIComponent(alias)}/${id}${makeParams(params)}`);
  };

  /**
   * this section is about dealing with subscriptions
   * @param {string} watchId as created by efx.watch
   * @param {function} callback what to do when it happens, or null to cancel
   * @param {object} options such as type:"poll"
   */
  ns.watching = {};

  /**
   * turn watching off
   * @param {string} watchId the watch key created by ns.watch
   * @return {Promise} 
   */
  ns.off = function(watchId) {

    return new Promise(function(resolve, reject) {
      var watch = ns.watching[watchId];

      // stop anyway and remove all trace of it
      if (watch) {
        watch.stopped = true;
        delete ns.watching[watch.id];
      }

      // need to get rid of the item in list - doesn't matter if it fails
      return ns.offRegister(watchId)
        .then(function(result) {

          // excuse an error for pull items, because they dont have a record anyway
          if (!result.data.ok && watch && watch.options.type === "pull") result.data.ok = true;
          resolve(result);
        })
        .catch(function(err) {
          reject(err);
        });
    });
  };

  /**
   * get the log file for watches
   * @param {string} watchable the key to get the data for
   * @param {string} reader the access key it was created with
   * @param {object} params
   * @return {Promise}
   */
  ns.getWatchLog = function(watchable, reader, params) {
    return ax.get("/watchlog/" + watchable + "/" + reader + makeParams(params));
  };

  /**
   * check a thing is a promise and make it so if not
   * @param {*} thing the thing
   * @param {Promise}
   */
  ns.promify = function(thing) {

    // is it already a promise
    var isPromise = !!thing &&
      (typeof thing === 'object' || typeof thing === 'function') &&
      typeof thing.then === 'function';

    // is is a function
    var isFunction = !isPromise && !!thing && typeof thing === 'function';

    // create a promise of it .. will also make a promise out of a value
    return Promise.resolve(isFunction ? thing() : thing);
  };

  /**
   * a handly timer
   * @param {*} [packet] something to pass through when time is up
   * @param {number} ms number of milliseconds to wait
   * @return {Promise} when over
   */
  ns.handyTimer = function(ms, packet) {
    // wait some time then resolve
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        resolve(packet);
      }, ms);
    });
  };

  /**
   * expbackoff
   * @param {function | Promise} action what to do 
   * @param {function} doRetry whether to retry
   * @param {object} [options]
   * @param {number} [options.maxPasses=5] how many times to try
   * @param {number} [options.waitTime=500] how long to wait on failure
   * @param {number} [options.passes=0] how many times we've gone
   * @param {function} [options.setWaitTime=function(waitTime, passes,result,proposed) { ... return exptime.. }]
   * @return {Promise} when its all over
   */
  ns.expBackoff = function(action, doRetry, options) {

    options = options || {};


    // this is the default waittime
    function defaultWaitTime (waitTime, passes, result) {
      return Math.pow(2, passes) * waitTime + Math.round(Math.random() * 73);
    }

    // default calculation can be bypassed with a custom function
    var setWaitTime =  function(waitTime, passes, result ,proposed) {
      return options.setWaitTime ? options.setWaitTime (waitTime, passes, result,proposed) : 0;
    };
    
    // the defaults
    var waitTime = options.waitTime || 500;
    var passes = options.passes || 0;
    var maxPasses = options.maxPasses || 6;

    // keep most recent result here
    var lastResult;

    // the result will actually be a promise
    // resolves, or rejects if there's an uncaught failure or we run out of attempts
    return new Promise(function(resolve, reject) {

      // start
      worker(waitTime);

      // recursive 
      function worker(expTime) {

        // give up
        if (passes >= maxPasses) {

          // reject with last known result
          reject(lastResult);
        }
        // we still have some remaining attempts

        else {

          // call the action with the previous result as argument
          // turning it into a promise.resolve will handle both functions and promises
          ns.promify(action)
            .then(function(result) {
              // store what happened for later
              lastResult = result;

              // pass the result to the retry checker and wait a bit and go again if required
              if (doRetry(lastResult, passes++)) {
                return ns.handyTimer(expTime)
                  .then(function() {
                    var proposedWaitTime = defaultWaitTime(waitTime , passes , result );
                    worker(setWaitTime(waitTime, passes, lastResult,proposedWaitTime) || proposedWaitTime);
                  });
              }
              else {
                // finally
                resolve(lastResult);
              }
            });

        }
      }

    });
  };


  return ns;
})({});

module.exports = api;

// Allow use of default import syntax in TypeScript
module.exports.default = api;
