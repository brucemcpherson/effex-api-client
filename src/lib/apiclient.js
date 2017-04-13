/**
 * need axios for http operations
 * that should also bring in es6 which is needed anyway
 */
var axios = require('axios');

/**
 * the api client for Ephemeral exchange
 */
var api = (function(ns) {
  "use strict";

  // the api base url
  let ax;
  let admin;
  let socketBase;
  let keys = {};
  let io;
  let socket;
  // generate a unique number for the session id
  let session = Math.round(Math.random()*2048).toString(32) + new Date().getTime().toString(32);
  
  /**
   * gets the session name
   * this is a unique number assigned to this session
   * its main use is to see whether items returned by push modifications were chnged by this session or another
   * @return {string} the session if
   */
  ns.getSession = function () {
    return session;
  };
  
  /**
   * allows setting of a custom session name
   * not normally required
   * @param {string} sessionName the name to give this session
   * @return {object} self
   */
  ns.setSession = function (sessionName)  {
    session = sessionName;
    return ns;
  };
  
  /**
   * @param {string} base the base url
   * @param {string} adminKey not required for regular client use as its for accout management with a console app
   * @return {object} self
   */
  ns.setBase = function(base, adminKey) {
    ax = axios.create({
      baseURL: base
    });
    admin = adminKey;
    socketBase = base + ":8080";
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
  ns.makeKeys = function(boss,  params) {
    var modes = ["reader","writer","updater"];
    return Promise.all(modes.map(function(mode) {
      return ax.get(`/${boss}/${mode}${makeParams(params)}`);
    }))
    .then (function (results){
      if (!results.every(function (d) {
        return d.data && d.data.ok;
      })) {
        throw 'failed to generate all keys ' + JSON.stringify (results.map(function (d) { return d.data}));
      }
      else {
        ns.setKeys (modes.reduce (function (p,c,i) { p[c] = results[i].data.keys[0]; return p;} , {}));
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
  ns.update = function(data, id, updater, method  , params) {
    
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
  ns.writeAlias = function( data, alias, writer, method, params) {
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
  ns.write = function( data, writer, method, params) {
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
   * @param {object} params any params
   * @return {Promise} to the result
   */
  ns.watch = function( id, key, event, params) {
    params = params || {};
    return ax.post(`/watch/${key}/${id}/${event}${makeParams(params)}`);
  };
  
  /**
   * @param {string} id the watchble id
   * @param {object} params any params
   * @return {Promise} to the result
   */
  ns.getWatched = function( id,  params) {
    params = params || {};
    return ax.get(`/watched/${id}${makeParams(params)}`);
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
  ns.read = function(id, reader, params) {
    params = params || {};
    reader = reader || keys.reader;
    return ax.get(`/reader/${reader}/${encodeURIComponent(id)}${makeParams(params)}`);
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
  ns.off = function (watchId) {
    return new Promise (function (resolve, reject) {
      var watch = ns.watching[watchId];
      if (!watch) {
        reject (watchId + ' not active');
      }
      else { 
        watch.stopped = true;
        if (watch.type === "url") {
           return ns.unWatchUrlCallback (watchId);
        }
        else {
          return resolve ({data:{ok:true, key:watchId}});
        }
      }
    });
  };

  /**
   * @param {string} id the watchble id
   * @param {string} url the url to callbacl
   * @param {string} method to use to callbcak
   * @param {object} data any data to add to the standard stuff
   * @params {object} any params
   * @return {Promise} to the result
   */
  ns.watchUrlCallback = function(id, url , method , data, params) {
    params = params || {};
    if (!url || !method) {
      return Promise.reject ("url and method parameters required for watchUrlCallback");
    }
    data = data || {};
    data.url = url;
    data.method = method;
    
    return ax.post("/watchon/urlcallback/" + id + makeParams(params), {data:data});
  };
  
  /**
   * @param {string} id the watchble id
   * @return {Promise} to the result
   */
  ns.unWatchUrlCallback = function(id,params) {
    return ax.post("/watchoff/urlcallback/" + id + makeParams(params));
  };
  
  /**
   * get the log file for watches
   * @param {string} watchable the key to get the data for
   * @param {string} reader the access key it was created with
   * @param {object} params
   * @return {Promise}
   */
  ns.getWatchLog = function (watchable , reader , params) {
    return ax.get("/watchlog/" + watchable + "/" + reader + makeParams(params));
  };
  
  /**
   * turn watching on
   * @param {string} watchId the watch key created by ns.watch
   * @param {function || string} [callback] for event can be omitted if this is restart
   * @param {object} [options] behavior options
   * @return {Promise} 
   */
  ns.on = function(watchId, callback, options) {

    return new Promise(function(resolve, reject) {
      // see if we're watching this already, and delete it
      var watch = ns.watching[watchId];

      // can restart at previous point if required
      if (!watch && !callback) {
        reject("need a callback for new watch activation", watchId);
      }
      else {

        // create a new one or inherit previous.
        watch = watch || {
          options: {
            type: "push", // default
            frequency: 30, // how often to poll
            start: new Date().getTime(), // timestamp to accept events from
            method:"POST",   // will be used for URL type callback method
            message:""        // additional info to pass to receiver
          }
        };

        // sort out the options
        if (options) {
          Object.keys(options).forEach(function(d) {
            if (watch.options.hasOwnProperty(d)) {
              watch.options[d] = options[d];
            }
            else {
              reject('invalid watch option property ' + d);
              return;
            }
          });
        }

        // all types need this
        watch.id = watchId;
        watch.callback = callback;
        watch.nextEvent = watch.options.start;
        watch.message = watch.options.message;

        // start it
        watch.stopped = false;

        // in this option, a simple polling happens
        // used in the case where the platform is not able to 
        // use socket.io, but it still needs to be able to handle asynchronicity
        // for platforms that can't, may as well just call getWatched from time to time
        if (watch.options.type === "pull") {

          if (typeof callback !== "function") {
            reject('callback must be a function for pull watching');
            return;
          }

          watch.looper = function() {

            // this is  recursive
            function p() {

              // that's the signal its all over
              if (watch.stopped) return;

              // go and do a poll 
              ns.getWatched(watch.id, {
                since: watch.nextEvent
              }).then(function(result) {
                var pack = result.data;
                if (!pack.ok) {
                  throw 'polling error ' + JSON.stringify(pack);
                }

                // if we got some events, do the callback and update for the next one.
                if (pack.value.length && !watch.stopped) {
                  watch.callback(watch.id, {
                    id:pack.id,
                    alias:pack.alias,
                    event:pack.event,
                    session:ns.getSession(),
                    message:watch.message,
                    key:watch.id,
                    value:pack.value
                  });
                  watch.nextEvent = 1 + pack.value[pack.value.length - 1];
                }
                pTimer_(watch.id, watch.options.frequency * 1000).then(p);
              }).catch(function(err) {
                throw ('error setting watch looper ', err);
              });
            }

            // start looping
            p();
          };

          // start it
          watch.looper();
          resolve(watch);
        }

        // this option uses socket.io
        // and is the least troublesome option
        // the server tracks changes and pushes them using socket.io
        else if (watch.options.type === "push") {

          if (typeof callback !== "function") {
            reject('callback must be a function for push notification');
            return;
          }

          // if we dont have it lready, bring it in
          io = io || require('socket.io-client');

          // create a socket for this watch session
          socket = socket || io(socketBase);

          // register this thing
          socket.emit('watch-on', {
            watch: watch.id,
            socket: socket.id,
            session: ns.getSession(),
            nextEvent:  watch.nextEvent || new Date().getTime(),
            message: watch.message
          }, function(vent) {

            // the server ack
            if (vent.watch !== watch.id) {
              throw ("mismatch watch id", vent.watch, watch.id);
            }

            // record the server socket id .. maybe do some validation with this later
            watch.sid = vent.socket;

            // now we can listen for events matching that watch.id name
            socket.on(vent.watch, function(data) {
              
              if (!watch.stopped) {
                // this doesn't play a part in the processing, but might be useful for restarting
                watch.nextEvent = data.value[data.value.length-1] +1;
                
                // call the user function
                callback(watch.id, data);
              }
            });

            resolve(watch);
          });

          resolve(watch);
        }

        // this option uses a url callback
        // it makes a server call and the server is reponsible for 
        // polling the given url
        // there is no notification here and callback is not required
        else if (watch.options.type === "url") {

          if (typeof callback !== "string") {
            reject('callback must be a url string for url watching');
            return;
          }
          
          // add extra message if its needed
          ns.watchUrlCallback (watch.id, callback , watch.options.method.toUpperCase(),{
            nextEvent:watch.nextEvent,
            message:watch.message
          })
          .then (function (d) {
            if (d.data.ok) {
              resolve (watch);
            }
            else {
              reject (d.data);
            }
          });
          
        }
        else {
          reject('invalid watching type ' + watch.options.type);
          return;
        }

        ns.watching[watchId] = watch;
      }
    });
  };

  function pTimer_ (id , ms){
    return new Promise ((resolve,reject)=>{
      setTimeout (()=>resolve (id), ms);
    });
  }
  
  return ns;
})({});

module.exports = api;

// Allow use of default import syntax in TypeScript
module.exports.default = api;
