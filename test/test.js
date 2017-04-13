var expect = require('chai').expect;


var efx = require('../dist/index');

// set up client 
//efx.setBase("https://ephex-auth.appspot-preview.com"); //prod

efx.setBase("https://nodestuff-xlibersion.c9users.io"); //dev

// boss key comes from console /// replace this with your own
//var bossKey = "bx2ao-1zj-bf300lgaod2q"; //prod
var bossKey = "bx2b6-2db-oy4pbei1c6yo"; //dev
var keyTime = 30 * 60; //   30 minutes

function testKeys(promises) {


  describe('keys', function() {

    //validate boss key

    it('validate boss key not expired', function() {
      return efx.validateKey(bossKey).then(function(result) {
        expect(result.data).to.be.an('object');
        expect(result.data.key).to.equal(bossKey);
        expect(new Date(result.data.validtill).getTime()).to.be.above(new Date().getTime());
        expect(result.data.ok).to.equal(true);
      });
    });
    
    // but there's a shortcut
    it('make keys', function() {

      return promises.makeKeys = efx.makeKeys(bossKey,{seconds:keyTime})
      .then (function (keys){
        expect(keys).to.be.an('object');
        expect(keys).to.have.all.keys('updater', 'writer', 'reader');
      });

    });
    

    // get 1 writer key expiringin in 30 minutes
    it('generate writer key', function() {
      promises.writers = efx.generateKey(bossKey, "writer", {
        seconds: keyTime
      });
      return promises.writers.then(function(result) {
        var writers = result.data;
        expect(writers).to.be.an('object');
        expect(writers.keys).to.be.instanceof(Array);
        expect(writers.keys.length).to.equal(1);
        expect(writers.ok).to.equal(true);
        expect(new Date(writers.validtill).getTime()).to.be.closeTo(1000 * keyTime + new Date().getTime(), 2000);

      });
    });

    // get 2 reader keys expiringin in 5 minutes
    it('generate reader keys', function() {
      promises.readers = efx.generateKey(bossKey, "reader", {
        seconds: keyTime,
        count: 2
      });
      return promises.readers.then(function(result) {
        var readers = result.data;
        expect(readers).to.be.an('object');
        expect(readers.keys).to.be.instanceof(Array);
        expect(readers.keys.length).to.equal(2);
        expect(readers.ok).to.equal(true);
        expect(new Date(readers.validtill).getTime()).to.be.closeTo(1000 * keyTime + new Date().getTime(), 2000);
      });
    });

    // get 1 update key expiring in 5 minutes

    it('generate update key', function() {
      promises.updaters = efx.generateKey(bossKey, "updater", {
        seconds: keyTime,
        count: 1
      });
      return promises.updaters.then(function(result) {
        var updaters = result.data;
        expect(updaters).to.be.an('object');
        expect(updaters.keys).to.be.instanceof(Array);
        expect(updaters.keys.length).to.equal(1);
        expect(updaters.ok).to.equal(true);
        expect(new Date(updaters.validtill).getTime()).to.be.closeTo(1000 * keyTime + new Date().getTime(), 2000);
      });

    });
    

    
    it('should be keys', function() {

      promises.keys = Promise.all([promises.writers, promises.readers, promises.updaters,promises.makeKeys]).then(function(res) {
        // set the keys up as default so we dont have to bother specifying them later
        // this will replace all the keys made by makeKeys
        efx.setKeys({
          updater: res[2].data.keys[0],
          writer: res[0].data.keys[0],
          reader: res[1].data.keys[0]
        });
        return efx.getKeys();
      });

      return promises.keys.then(function(keys) {
        expect(keys).to.be.an('object');
        expect(keys).to.have.all.keys('updater', 'writer', 'reader');
      });
    });
    

    
  });
  

}

function tests() {
  // service status tests
  var allowTime = 60000;

  describe('status', function() {

    //return expect(Promise.resolve({ foo: "bar" })).to.eventually.have.property("foo");
    //PING

    it('ping', function() {

      return efx.ping().then(function(result) {
        expect(result.data).to.be.an('object');
        expect(result.data.value).to.equal('PONG');
        expect(result.data.code).to.equal(200);
        expect(result.data.ok).to.equal(true);

      });
    });

    //INFO
    it('info', function() {
      return efx.info().then(function(result) {
        expect(result.data).to.be.an('object');
        expect(result.data.info).to.have.all.keys('api', 'version');
        expect(result.data.code).to.equal(200);
        expect(result.data.ok).to.equal(true);
      });
    });

  });


  // Work with keys
  // we'll need these later
  var promises = {},
    textData = "just some test data to write",
    alias = "somefunnyname",
    otherAlias = "anothername",
    yetAlias = "yetanotheralias",
    otherTextData = "some other stuff",
    evenMoreTextData = "even more",
    watchAlias = "awatchalias",
    watches = [],
    aliasWatches = [],
    aliasRemoves = [],
    aliasExpires = [],
    someData = {
      name: 'xyz',
      a: [1, 2, 3],
      b: 2000
    };

  testKeys(promises);
  
  describe('watching initial', function() {

    it('write watched item', function() {

      return promises.keys
        .then(function(keys) {
          return promises.writeWatched = efx.write(someData, keys.writer, "post", {
            updaters: keys.updater,
            readers: keys.reader,
            lifetime:100
          });
        })
        .then(function(result) {
          var data = result.data;
          expect(data).to.be.an('object');
          expect(data.ok).to.equal(true);
          expect(data.code).to.equal(201);
          expect(data.id).to.be.a('string');
          expect(data.lifetime).to.equal(100);
          expect(data.session).to.equal(efx.getSession());
        });
    });

    it('write alias to watch', function() {
      return promises.keys
        .then(function(keys) {
          return promises.watchAlias = efx.writeAlias(someData, watchAlias, keys.writer, "post", {
            readers: keys.reader,
            updaters: keys.updater
          });
        })
        .then(function(result) {
          var data = result.data;
          expect(data).to.be.an('object');
          expect(data.ok).to.equal(true);
          expect(data.code).to.equal(201);
          expect(data.id).to.be.a('string');
          expect(data.lifetime).to.be.below(keyTime);
          expect(data.alias).to.equal(watchAlias);
        });
    });

    it('write alias to watch for expiring', function() {
      return promises.keys
        .then(function(keys) {
          return promises.expireWriter = efx.write(someData, keys.writer, "post", {
            readers: keys.reader,
            updaters: keys.updater,
            lifetime:15
          });
        })
        .then(function(result) {
          var data = result.data;
          expect(data).to.be.an('object');
          expect(data.ok).to.equal(true);
          expect(data.code).to.equal(201);
          expect(data.id).to.be.a('string');
          expect(data.lifetime).to.equal(15);
        });
    });

    it('register write alias to watch for expiring', function() {
      return promises.expireWriter
        .then(function(result) {
          var data = result.data;
          return promises.expireWriterRegister = efx.registerAlias(data.writer, data.readers[0], data.id, watchAlias, {
            seconds: 10
          });
        })
        .then(function(result) {
          var data = result.data;
          expect(data.ok).to.equal(true);
        });
    });

    it('create an alias watch for updating', function() {
      return Promise.all([promises.keys, promises.watchAlias])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return promises.watchAliasForUpdate = efx.watch(data.alias, keys.updater, "update");
        })
        .then(function(result) {
          expect(true).to.equal(result.data.ok);
          expect(201).to.equal(result.data.code);
        });
    });
    
    it('create an alias push watch for updating', function() {
      return Promise.all([promises.keys, promises.watchAlias])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return promises.watchPushAliasForUpdate = efx.watch(data.alias, keys.updater, "update");
        })
        .then(function(result) {
          expect(true).to.equal(result.data.ok);
          expect(201).to.equal(result.data.code);
        });
    });

    it('create an alias watch for removal', function() {
      return Promise.all([promises.keys, promises.watchAlias])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return promises.watchAliasForRemove = efx.watch(data.alias, keys.updater, "remove");
        })
        .then(function(result) {
          expect(true).to.equal(result.data.ok);
          expect(201).to.equal(result.data.code);
        });
    });

    it('create an alias watch for expiring', function() {
      return Promise.all([promises.keys, promises.expireWriterRegister])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return promises.watchAliasForExpire = efx.watch(data.alias, keys.reader, "expire");
        })
        .then(function(result) {
          expect(true).to.equal(result.data.ok);
          expect(201).to.equal(result.data.code);
        });
    });

    it('create a watch for updating', function() {
      return Promise.all([promises.keys, promises.writeWatched])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return promises.watchForUpdate = efx.watch(data.id, keys.updater, "update");
        })
        .then(function(result) {
          expect(true).to.equal(result.data.ok);
          expect(201).to.equal(result.data.code);
        });
    });

    it('setting an on', function() {
      return Promise.all([promises.keys, promises.watchForUpdate])
        .then(function(res) {
          var data = res[1].data;
          return efx.on(data.watchable, function(id, pack) {
            watches.push({
              id: id,
              value: pack
            });
            console.log("noted update", id);
          }, {
            frequency: 10
          });
        });
    });

    it('setting an alias update on', function() {
      return Promise.all([promises.keys, promises.watchAliasForUpdate])
        .then(function(res) {
          var data = res[1].data;
          return efx.on(data.watchable, function(id, pack) {
            aliasWatches.push({
              id: id,
              value: pack
            });
            console.log("noted alias update", id);
          }, {
            frequency: 10
          });
        });
    });

    it('setting a push alias update on', function() {
      return Promise.all([promises.keys, promises.watchPushAliasForUpdate])
        .then(function(res) {
          var data = res[1].data;
          return efx.on(data.watchable, function(id, pack) {
            aliasWatches.push({
              id: id,
              value: pack
            });
            console.log("noted push alias update", id);
          }, {
            type: 'push'
          });
        });
    });
    
    it('setting an expire  on', function() {
      return Promise.all([promises.keys, promises.watchAliasForExpire])
        .then(function(res) {
          var data = res[1].data;
          return efx.on(data.watchable, function(id, pack) {
            aliasExpires.push({
              id: id,
              value: pack
            });
            console.log("noted alias expiration", id);
          }, {
            frequency: 10
          });
        });
    });

    it('setting an alias on remove', function() {
      return Promise.all([promises.keys, promises.watchAliasForRemove])
        .then(function(res) {
          var data = res[1].data;
          return efx.on(data.watchable, function(id, pack) {
            aliasRemoves.push({
              id: id,
              value: pack
            });
            console.log("noted alias remove", id);
          }, {
            frequency: 10
          });
        });
    });

    var since;
    it('provoke an update', function() {
      return Promise.all([promises.keys, promises.writeWatched])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          since = new Date();
          // just read with a writer key
          return promises.provokeUpdate = efx.update(evenMoreTextData, data.id, keys.updater);
        })
        .then(function(result) {
          expect(true).to.equal(result.data.ok);
          expect(201).to.equal(result.data.code);

        });
    });
    
    it('provoke an alias update', function() {
      return Promise.all([promises.keys, promises.watchAlias])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return promises.provokeAliasUpdate = efx.update(evenMoreTextData, data.alias, keys.updater);
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(true);
          expect(result.data.code).to.equal(201);

        });
    });

    it('read a watchable', function() {
      return Promise.all([promises.keys, promises.watchForUpdate, promises.provokeUpdate])
        .then(function(res) {
          var data = res[1].data;
          // just read with a writer key
          return promises.watchableRead = efx.getWatched(data.watchable);
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(true);
          expect(result.data.code).to.equal(200);
        });

    });

    it('read a watchable with since parameter', function() {
      return Promise.all([promises.keys, promises.watchForUpdate, promises.provokeUpdate])
        .then(function(res) {
          var data = res[1].data;
          // just read with a writer key
          return promises.watchableRead = efx.getWatched(data.watchable, {
            since: since.getTime()
          });
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(true);
          expect(result.data.code).to.equal(200);
          expect(result.data.value.length).to.equal(1);
        });

    });

  });

  describe('items', function() {

    it('write post', function() {

      return promises.keys
        .then(function(keys) {
          return promises.writePost = efx.write(someData, keys.writer, "post", {
            updaters: keys.updater,
            readers: keys.reader,
            session: "fred flintstone"
          });
        })
        .then(function(result) {
          var data = result.data;
          expect(data).to.be.an('object');
          expect(data.ok).to.equal(true);
          expect(data.code).to.equal(201);
          expect(data.id).to.be.a('string');
          expect(data.lifetime).to.be.below(keyTime);
        });
    });

    it('read post', function() {
      return Promise.all([promises.keys, promises.writePost])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return efx.read(data.id, keys.writer);
        })
        .then(function(result) {
          var data = result.data;
          expect(data.value).to.deep.equal(someData);
          expect(data.session).to.equal("fred flintstone");
        });
    });

    it('write with get', function() {

      return promises.keys
        .then(function(keys) {
          return promises.writeGet = efx.write(someData, keys.writer, "GET");
        })
        .then(function(result) {
          var data = result.data;
          expect(data).to.be.an('object');
          expect(data.ok).to.equal(true);
          expect(data.code).to.equal(201);
          expect(data.id).to.be.a('string');
          expect(data.lifetime).to.be.below(keyTime);
        });
    });

    it('read write with get', function() {
      return Promise.all([promises.keys, promises.writeGet])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return efx.read(data.id, keys.writer);
        })
        .then(function(result) {
          expect(someData).to.deep.equal(result.data.value);
        });
    });

    it('write text', function() {

      return promises.keys
        .then(function(keys) {
          return promises.writeText = efx.write(textData);
        })
        .then(function(result) {
          var data = result.data;
          expect(data).to.be.an('object');
          expect(data.ok).to.equal(true);
          expect(data.code).to.equal(201);
          expect(data.id).to.be.a('string');
          expect(data.lifetime).to.be.below(keyTime);
        });
    });

    it('read text', function() {
      return Promise.all([promises.keys, promises.writeText])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return efx.read(data.id, keys.writer);
        })
        .then(function(result) {
          expect(textData).to.equal(result.data.value);
        });
    });

  });


  describe('sharing items', function() {

    it('assigning updaters and readers', function() {

      return promises.keys
        .then(function(keys) {
          return promises.assigning = efx.write(someData, keys.writer, "post", {
            readers: keys.reader,
            updaters: keys.updater
          });
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(true);
        });
    });

    it('read with reader key', function() {
      return Promise.all([promises.keys, promises.assigning])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return efx.read(data.id, keys.reader);
        })
        .then(function(result) {
          expect(true).to.deep.equal(result.data.ok);
          expect(someData).to.deep.equal(result.data.value);
        });
    });

    it('read with updater key', function() {
      return Promise.all([promises.keys, promises.assigning])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return efx.read(data.id, keys.updater);
        })
        .then(function(result) {
          expect(true).to.deep.equal(result.data.ok);
          expect(someData).to.deep.equal(result.data.value);
        });
    });

    it('update', function() {
      return Promise.all([promises.keys, promises.assigning])
        .then(function(res) {
          var data = res[1].data;
          return promises.updateItem = efx.update(textData, data.id);
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(true);
        });
    });

    it('read updated item', function() {
      return Promise.all([promises.keys, promises.updateItem])
        .then(function(res) {
          var data = res[1].data;
          return efx.read(data.id);
        })
        .then(function(result) {
          expect(textData).to.deep.equal(result.data.value);
        });
    });

    it('provoke annother update', function() {
      return Promise.all([promises.keys, promises.writeWatched])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return promises.provokeUpdate = efx.update(textData, data.id, keys.updater);
        })
        .then(function(result) {
          expect(true).to.equal(result.data.ok);
          expect(201).to.equal(result.data.code);

        });
    });


  });

  describe('working with aliases', function() {

    it('writealias', function() {
      return promises.keys
        .then(function(keys) {
          return promises.yetAlias = efx.writeAlias(someData, yetAlias, keys.writer, "post", {
            readers: keys.reader,
            updaters: keys.updater
          });
        })
        .then(function(result) {
          var data = result.data;
          expect(data).to.be.an('object');
          expect(data.ok).to.equal(true);
          expect(data.code).to.equal(201);
          expect(data.id).to.be.a('string');
          expect(data.lifetime).to.be.below(keyTime);
          expect(data.alias).to.equal(yetAlias);
        });
    });

    it('read writealias with writer', function() {
      return Promise.all([promises.keys, promises.yetAlias])
        .then(function(res) {
          var keys = res[0];
          // just read with a writer key
          return efx.read(yetAlias, keys.writer);
        })
        .then(function(result) {
          expect(someData).to.deep.equal(result.data.value);
        });
    });

    it('read writealias with reader', function() {
      return Promise.all([promises.keys, promises.yetAlias])
        .then(function(res) {
          var keys = res[0];
          return efx.read(yetAlias, keys.reader);
        })
        .then(function(result) {
          expect(someData).to.deep.equal(result.data.value);
        });
    });

    it('read writealias with updater', function() {
      return Promise.all([promises.keys, promises.yetAlias])
        .then(function(res) {
          var keys = res[0];
          return efx.read(yetAlias, keys.updater);
        })
        .then(function(result) {
          expect(someData).to.deep.equal(result.data.value);
        });
    });

    it('update writealias', function() {
      return Promise.all([promises.keys, promises.yetAlias])
        .then(function(res) {
          return promises.yetUpdateItem = efx.update(textData, yetAlias);
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(true);
        });
    });

    it('read writealias after update', function() {
      return Promise.all([promises.keys, promises.yetUpdateItem])
        .then(function(res) {
          return efx.read(yetAlias);
        })
        .then(function(result) {
          expect(textData).to.equal(result.data.value);
        });
    });

    it('registering', function() {

      return Promise.all([promises.keys, promises.updateItem]).then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return promises.alias = efx.registerAlias(keys.writer, keys.reader, data.id, alias);
        })
        .then(function(result) {
          var data = result.data;
          expect(data).to.be.an('object');
          expect(data.ok).to.equal(true);
          expect(data.code).to.equal(201);
          expect(data.id).to.be.a('string');
          expect(data.alias).to.equal(alias);
          expect(new Date(data.validtill).getTime()).to.be.closeTo(1000 * keyTime + new Date().getTime(), allowTime);
        });
    });

    it('read alias with reader key', function() {
      return Promise.all([promises.keys, promises.alias])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return efx.read(data.alias, keys.reader);
        })
        .then(function(result) {
          expect(textData).to.equal(result.data.value);
        });
    });

    it('write another with same alias', function() {
      return Promise.all([promises.keys, promises.alias])
        .then(function(res) {
          var keys = res[0];
          return promises.otherWrite = efx.write(someData, keys.writer, "post", {
            readers: keys.reader,
            updaters: keys.updater
          });
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(true);
        });
    });

    it('registering other alias', function() {

      return Promise.all([promises.keys, promises.otherWrite]).then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return promises.otherAlias = efx.registerAlias(keys.writer, keys.updater, data.id, otherAlias);
        })
        .then(function(result) {
          var data = result.data;
          expect(data.alias).to.equal(otherAlias);
        });
    });

    it('read other alias with updater key', function() {
      return Promise.all([promises.keys, promises.otherAlias])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return efx.read(data.alias, keys.updater);
        })
        .then(function(result) {
          expect(someData).to.deep.equal(result.data.value);
        });
    });

    it('update other alias', function() {
      return Promise.all([promises.keys, promises.otherAlias])
        .then(function(res) {
          var data = res[1].data;
          return efx.update(textData, data.alias);
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(true);
        });
    });

    it('read updated other alias with updater key', function() {
      return Promise.all([promises.keys, promises.otherAlias])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return promises.readUpdateOtherAlias = efx.read(data.alias, keys.updater);
        })
        .then(function(result) {
          expect(textData).to.equal(result.data.value);
        });
    });

    it('delete should fail because alias not assigned to writer key', function() {
      return Promise.all([promises.keys, promises.readUpdateOtherAlias])
        .then(function(res) {
          var data = res[1].data;
          return efx.remove(data.alias);
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(false);
          expect(result.data.code).to.equal(404);
        });
    });

    it('registering other alias to writer key', function() {

      return Promise.all([promises.keys, promises.readUpdateOtherAlias]).then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return promises.otherWriterAlias = efx.registerAlias(keys.writer, keys.writer, data.id, otherAlias);
        })
        .then(function(result) {
          var data = result.data;
          expect(data.alias).to.equal(otherAlias);
        });
    });

    it('delete should work because alias is now assigned to writer key', function() {
      return Promise.all([promises.keys, promises.otherWriterAlias])
        .then(function(res) {
          var data = res[1].data;
          return promises.remove = efx.remove(data.alias);
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(true);
          expect(result.data.code).to.equal(204);
        });
    });

    it('check its gone', function() {
      return Promise.all([promises.keys, promises.remove, promises.readUpdateOtherAlias])
        .then(function(res) {
          var keys = res[0];
          var data = res[2].data;
          return efx.read(data.id, keys.writer);
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(false);
          expect(result.data.code).to.equal(404);
        });
    });


    it('redo the watched alias', function() {
      return promises.keys
        .then(function(keys) {
          return promises.redoWatchAlias = efx.writeAlias(textData, watchAlias, keys.writer, "post", {
            readers: keys.reader,
            updaters: keys.updater
          });
        })
        .then(function(result) {
          var data = result.data;
          expect(data).to.be.an('object');
          expect(data.ok).to.equal(true);
          expect(data.code).to.equal(201);
          expect(data.id).to.be.a('string');
          expect(data.lifetime).to.be.below(keyTime);
          expect(data.alias).to.equal(watchAlias);
        });
    });

    it('remove the watched alias', function() {
      return promises.keys
        .then(function(keys) {
          return efx.remove(watchAlias, keys.writer);
        })
        .then(function(result) {
          var data = result.data;
          expect(data).to.be.an('object');
          expect(data.ok).to.equal(true);
          expect(data.code).to.equal(204);
        });
    });




  });

  describe('intents', function() {
    it('write post', function() {

      return promises.keys
        .then(function(keys) {
          return promises.writePost = efx.write(textData, keys.writer, "post", {
            updaters: keys.updater,
            readers: keys.reader
          });
        })
        .then(function(result) {
          var data = result.data;
          expect(data).to.be.an('object');
          expect(data.ok).to.equal(true);
          expect(data.code).to.equal(201);
          expect(data.id).to.be.a('string');
          expect(data.lifetime).to.be.below(keyTime);
        });
    });

    it('read with intent', function() {
      return Promise.all([promises.keys, promises.writePost])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return promises.intentRead = efx.read(data.id, keys.updater, {
            intention: "update"
          });
        })
        .then(function(result) {
          expect(true).to.equal(result.data.ok);
          expect(textData).to.equal(result.data.value);
        });
    });

    it('intervening read with no intent', function() {
      return Promise.all([promises.keys, promises.writePost])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return efx.read(data.id, keys.updater);
        })
        .then(function(result) {
          expect(true).to.equal(result.data.ok);
          expect(textData).to.equal(result.data.value);
        });
    });

    it('validate intent key not expired', function() {
      return Promise.all([promises.keys, promises.intentRead])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return efx.validateKey(data.intent);
        }).then(function(result) {
          promises.intentRead.then(function(r) {
            expect(result.data).to.be.an('object');
            expect(result.data.key).to.equal(r.data.intent);
            expect(new Date(result.data.validtill).getTime()).to.be.above(new Date().getTime());
            expect(result.data.ok).to.equal(true);
          });

        });
    });

    it('update intent - should fail - using a different key', function() {
      return Promise.all([promises.keys, promises.intentRead])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return promises.updateIntent = efx.update(otherTextData, data.id, keys.writer, "post", {
            intent: data.intent
          });
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(false);
          expect(result.data.code).to.equal(409);
        });
    });

    it('update intent - should fail - using an invalid intent', function() {
      return Promise.all([promises.keys, promises.intentRead])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return promises.updateIntent = efx.update(otherTextData, data.id, keys.updater, "post", {
            intent: "nonesense"
          });
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(false);
          expect(result.data.code).to.equal(409);
        });
    });

    it('update intent - should fail - using the same key, but no intent', function() {
      return Promise.all([promises.keys, promises.intentRead])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return promises.updateIntent = efx.update(otherTextData, data.id, keys.updater);
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(false);
          expect(result.data.code).to.equal(409);
        });
    });

    it('update intent - should succeed - using the same key plus intent', function() {
      return Promise.all([promises.keys, promises.intentRead])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return efx.update(someData, data.id, keys.updater, "post", {
            intent: data.intent
          });
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(true);

        });
    });

    it('update intent - check what was updated', function() {
      return Promise.all([promises.keys, promises.writePost])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          // just read with a writer key
          return efx.read(data.id, keys.reader);
        })
        .then(function(result) {
          expect(true).to.equal(result.data.ok);
          expect(someData).to.deep.equal(result.data.value);
        });
    });


    it('read writealias with writer - and set intent', function() {
      return Promise.all([promises.keys, promises.yetAlias])
        .then(function(res) {
          var keys = res[0];
          // just read with a writer key
          return promises.intentAlias = efx.read(yetAlias, keys.writer, {
            intention: "update"
          });
        })
        .then(function(result) {
          expect(textData).to.equal(result.data.value);
        });
    });

    it('update intent with alias - should succeed - using the same key plus intent', function() {
      return Promise.all([promises.keys, promises.intentAlias])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return promises.updateIntentAlias = efx.update(otherTextData, data.alias, keys.writer, "post", {
            intent: data.intent
          });
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(true);
        });
    });

    it('update intent with alias - should fail - because intent is used up', function() {
      return Promise.all([promises.keys, promises.intentAlias])
        .then(function(res) {
          var keys = res[0];
          var data = res[1].data;
          return promises.updateIntentAlias = efx.update(otherTextData, data.alias, keys.writer, "post", {
            intent: data.intent
          });
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(false);
        });
    });



  });

  describe('checking watches', function() {

    // wait till the last thing is finished
    it('item watches', function() {

      return promises.intentAlias
        .then(function() {
          expect(watches.length).to.equal(2);
        });
    });


    // wait till the last thing is finished
    it('alias watches', function() {

      return promises.intentAlias
        .then(function() {
          expect(aliasWatches.length).to.equal(2);
        });
    });

    it('remove watches', function() {

      return promises.intentAlias
        .then(function() {
          expect(aliasRemoves.length).to.equal(1);
        });
    });

    it('expire watches', function() {

      return promises.intentAlias
        .then(function() {
          expect(aliasExpires.length).to.equal(1);
        });
    });

  });
}
tests();
