/**
 * handling socketing
 * @constructor Socketing
 */
module.exports = function(configEnv) {

  var ns = this;
  var io = require('socket.io-client');
  var config = configEnv;
  let getConnected_ = null;
  var PASS_TIMEOUT = 10000;
  
  // the current connection
  ns.connection = {
    socket: null
  };
console.log (configEnv);
  // the config change
  ns.setConfig = function(con) {
    // get rid of prev connect
    ns.disconnect('config changed');
    config = con;
    return ns;
  };

  // disconnect
  ns.disconnect = function(reason) {
    if (ns.isConnected()) {
      ns.connection.socket.disconnect(reason);
      ns.connection.socket = null;
    }
    return ns;
  };

  // check if connected
  ns.isConnected = function() {
    return ns.connection.socket ? true : false;
  };


  ns.getConnected = (pushId) => getConnected_ || connect_(pushId);


  // do a connect - once off 
  // sets a promise
  const connect_ = (pushId)  => {

    console.log ('calling connect_ for', pushId);
    
    // get connected
    const socket = io.connect(config.socketBase + ":" + config.socketPort);

    // if a promise, then can be used to handle in progress too.
    getConnected_ = new Promise((resolve, reject) => {

      // deal with the sequnce of connection events
      connectionEvent()
        .then(() => passEvent())
        .then((passResult) => {
          console.log ('back with passResult',passResult);
          if (passResult.ok) {
            ns.connection.socket = socket;
            ns.connection.message = passResult;
            ns.connection.pushId = pushId;
            console.log('is ocnnect',ns.isConnected());
            resolve(ns);
          }
          else {
            reject('failed to sync passes');
          }
        })
        .catch((err)=>reject (err));
    });

    // deal with a disconnection event
    socket.on('disconnect', function(data) {
      ns.connection.socket = null;
      ns.connection.message = data;
      getConnected_ = null;
    });

    return getConnected_;
    
    // handle connection event from socket.io
    function connectionEvent() {
      
      return new Promise((resolve, reject) => {
        // deal with the connection event
        console.log ('handling connection event');
        socket.on('connect', () => resolve());
      });

    }
    
    // handle the password conversation
    function passEvent() {

      return new Promise((resolve, reject) => {
console.log ('handling passevent');
        // the payload to send over
        var pack = {
          pass: config.socketPass,
          id: socket.id,
          pushId: pushId
        };

        // but only wait a while
        pTimer_(pack , PASS_TIMEOUT).then (()=>{
          if (!ns.isConnected())reject('passevent attempt timed out');
        });
        
        // try the conversation
        console.log ('try talking');
        socket.emit('pass', pack, (result)=> resolve(result));
        
      });

    }

  };

  /**
   * promise timer - 
   * @param {*} id something to pass on when timer is up
   * @param {number} ms number of milliseconds to wait
   * @return {Promise}
   */
  function pTimer_(id, ms) {
    return new Promise((resolve, reject) => {
      setTimeout(() => resolve(id), ms);
    });
  }
  return ns;



};
