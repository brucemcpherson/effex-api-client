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
  let keys = {};

  ns.setBase = function(base, adminKey) {
    ax = axios.create({
      baseURL: base
    });
    admin = adminKey;
  };


  /**
   * turns a params object into a url
   * @param {object} params the params
   * @return {string} the uri
   */
  function makeParams(params) {
    params = params || {};
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



  return ns;
})({});

module.exports = api;

// Allow use of default import syntax in TypeScript
module.exports.default = api;
