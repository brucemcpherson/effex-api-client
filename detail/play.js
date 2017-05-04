var Socketing = require('../src/lib/socketing');
var config = require('../src/lib/config.js');
var sk = new Socketing(config.dev);
sk.connect().then (function () {
  console.log(sk.isConnected());
});

