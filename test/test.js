var expect = require('chai').expect;


var efx = require('../dist/index');

// set up client 
efx.setBase("https://ephex-auth.appspot-preview.com"); //prod

//efx.setBase("https://nodestuff-xlibersion.c9users.io");  //dev

// boss key comes from console /// replace this with your own
var bossKey = "bx2ao-1zj-bf300lgaod2q"; //prod
///var bossKey = "bx2b6-2db-oy4pbei1c6yo"; //dev

// service status tests
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
var promises = {}, textData = "just some test data to write",alias ="somefunnyname", otherAlias = "anothername",
  yetAlias = "yetanotheralias",
  someData = {
    name: 'xyz',
    a: [1, 2, 3],
    b: 2000
  };

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

  // get 1 writer key expiringin in 5 minutes
  it('generate writer key', function() {
    promises.writers = efx.generateKey(bossKey, "writer", {
      seconds: 5 * 60
    });
    return promises.writers.then(function(result) {
      var writers = result.data;
      expect(writers).to.be.an('object');
      expect(writers.keys).to.be.instanceof(Array);
      expect(writers.keys.length).to.equal(1);
      expect(writers.ok).to.equal(true);
      expect(new Date(writers.validtill).getTime()).to.be.closeTo(1000 * 5 * 60 + new Date().getTime(), 2000);

    });
  });



  // get 2 reader keys expiringin in 5 minutes
  it('generate reader keys', function() {
    promises.readers = efx.generateKey(bossKey, "reader", {
      seconds: 5 * 60,
      count: 2
    });
    return promises.readers.then(function(result) {
      var readers = result.data;
      expect(readers).to.be.an('object');
      expect(readers.keys).to.be.instanceof(Array);
      expect(readers.keys.length).to.equal(2);
      expect(readers.ok).to.equal(true);
      expect(new Date(readers.validtill).getTime()).to.be.closeTo(1000 * 5 * 60 + new Date().getTime(), 2000);
    });
  });



  // get 1 update key expiring in 5 minutes

  it('generate update key', function() {
    promises.updaters = efx.generateKey(bossKey, "updater", {
      seconds: 5 * 60,
      count: 1
    });
    return promises.updaters.then(function(result) {
      var updaters = result.data;
      expect(updaters).to.be.an('object');
      expect(updaters.keys).to.be.instanceof(Array);
      expect(updaters.keys.length).to.equal(1);
      expect(updaters.ok).to.equal(true);
      expect(new Date(updaters.validtill).getTime()).to.be.closeTo(1000 * 5 * 60 + new Date().getTime(), 2000);
    });

  });
});
describe('items', function() {


  it('should be keys', function() {

    promises.keys = Promise.all([promises.writers, promises.readers, promises.updaters]).then(function(res) {
      // set the keys up as default so we dont have to bother specifying them later

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

  it('write post', function() {

    return promises.keys
      .then(function(keys) {
        return promises.writePost = efx.write(someData);
      })
      .then(function(result) {
        var data = result.data;
        expect(data).to.be.an('object');
        expect(data.ok).to.equal(true);
        expect(data.code).to.equal(201);
        expect(data.id).to.be.a('string');
        expect(data.lifetime).to.equal(3600);
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
        expect(someData).to.deep.equal(result.data.value);
      });
  });


  it('write with get', function() {

    return promises.keys
      .then(function(keys) {
        return promises.writeGet = efx.write(someData,keys.writer, "GET");
      })
      .then(function(result) {
        var data = result.data;
        expect(data).to.be.an('object');
        expect(data.ok).to.equal(true);
        expect(data.code).to.equal(201);
        expect(data.id).to.be.a('string');
        expect(data.lifetime).to.equal(3600);
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
        expect(data.lifetime).to.equal(3600);
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
        return promises.assigning = efx.write(someData,keys.writer,"post",{readers:keys.reader,updaters:keys.updater});
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



});

describe('working with aliases', function() {

    it('writealias', function () {
      return promises.keys
        .then (function (keys) {
          return promises.yetAlias = efx.writeAlias( someData, yetAlias, keys.writer, "post" , {
            readers:keys.reader,updaters:keys.updater
          } );
      })
      .then (function (result) {
        var data = result.data;
        expect(data).to.be.an('object');
        expect(data.ok).to.equal(true);
        expect(data.code).to.equal(201);
        expect(data.id).to.be.a('string');
        expect(data.lifetime).to.equal(3600);
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

      return Promise.all([promises.keys,promises.updateItem]).then (function (res) {
        var keys = res[0];
        var data = res[1].data;
      return promises.alias = efx.registerAlias( keys.writer, keys.reader, data.id, alias);
      })
      .then (function (result) {
        var data = result.data;
        expect(data).to.be.an('object');
        expect(data.ok).to.equal(true);
        expect(data.code).to.equal(201);
        expect(data.id).to.be.a('string');
        expect(data.alias).to.equal(alias);
        expect(new Date(data.validtill).getTime()).to.be.closeTo(1000 * 5 * 60 + new Date().getTime(), 18000);
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
          return promises.otherWrite = efx.write(someData,keys.writer,"post",{readers:keys.reader,updaters:keys.updater});
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(true);
        });
    });

    it('registering other alias', function() {

      return Promise.all([promises.keys,promises.otherWrite]).then (function (res) {
        var keys = res[0];
        var data = res[1].data;
        return promises.otherAlias = efx.registerAlias( keys.writer, keys.updater, data.id, otherAlias);
      })
      .then (function (result) {
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
          return efx.update(textData , data.alias);
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

      return Promise.all([promises.keys,promises.readUpdateOtherAlias]).then (function (res) {
        var keys = res[0];
        var data = res[1].data;
        return promises.otherWriterAlias = efx.registerAlias( keys.writer, keys.writer, data.id, otherAlias);
      })
      .then (function (result) {
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
          return efx.read(data.id,keys.writer);
        })
        .then(function(result) {
          expect(result.data.ok).to.equal(false);
          expect(result.data.code).to.equal(404);
        });
    });
 
  
});

