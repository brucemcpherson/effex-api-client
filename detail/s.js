"use strict";

var efx = require('../dist/index');
efx.setBase("https://nodestuff-xlibersion.c9users.io"); //dev

var bossKey = "bx2b6-2db-oy4pbei1c6yo"; //dev
var keyTime = 3 * 60; //   3 minutes

// set up structure to parametrize the test
var subUpdates = {
  push: "",
  pull: "",
  url: ""
},
    items = {
  push: "",
  pull: "",
  url: ""
},
    updateItems = {
  push: "",
  pull: "",
  url: ""
},
    subExpires = {
  push: "",
  pull: "",
  url: ""
},
    onOptions = {
  push: {
    type: "push"
  },
  pull: {
    type: "pull",
    frequency: "10"
  },
  url: {
    type: "url",
    method: "post"
  }
},
    callbacks = {
  push: function push(watchid, pack) {
    return console.log('..push detected', watchid, pack);
  },
  pull: function pull(watchid, pack) {
    return console.log('..pull detected', watchid, pack);
  },
  url: "https://script.google.com/macros/s/AKfycbz6XKhAjYDju7GqQmW6eU26uTElYPywTONxsRssNaw0q6MDXL0/exec"
};

var list = Object.keys(items);

var dataUpdate = [{
  name: "fred",
  id: 20,
  time: new Date().getTime(),
  session: efx.getSession()
}, {
  name: "jane",
  id: 30,
  time: new Date().getTime(),
  session: efx.getSession()
}];

var dataUpdate2 = JSON.parse(JSON.stringify(dataUpdate));
dataUpdate2[0].id = 200;
dataUpdate2[1].id = 900;

// get keys
var makeKeys = efx.makeKeys(bossKey, {
  seconds: keyTime
});

//....make a bunch of items for the test, allow an updater key to access them, 
// and send the updater key as a message
var write = makeKeys.then(function () {
  return Promise.all(list.map(function (k) {
    return efx.write(k, null, null, {
      updaters: efx.getKeys().updater
    }).then(function (result) {
      onOptions[k].message = {
        updater: result.data.updaters[0]
      };
      return items[k] = result.data;
    });
  }));
});

write.then(function () {
  return list.forEach(function (d) {
    return console.log(items[d]);
  });
});

// make a set of watches looking for updates
var updateWatches = write.then(function () {
  return Promise.all(list.map(function (k) {
    return efx.watch(items[k].id, items[k].writer, "update").then(function (result) {
      subUpdates[k] = result.data;
      console.log(result.data.watchable, ' created for update type ', k);
    });
  }));
});

// make a set of watches looking for expirations
var expireWatches = write.then(function () {
  return Promise.all(list.map(function (k) {
    return efx.watch(items[k].id, items[k].writer, "expire").then(function (result) {
      subExpires[k] = result.data;
      console.log(result.data.watchable, ' created for expire type ', k);
    });
  }));
});

// start looking for things happening 
var onUpdateWatches = updateWatches.then(function () {
  return Promise.all(list.map(function (k) {
    return efx.on(subUpdates[k].watchable, callbacks[k], onOptions[k]);
  }));
});

// start looking for things happening 
var onExpireWatches = expireWatches.then(function () {
  return Promise.all(list.map(function (k) {
    return efx.on(subExpires[k].watchable, callbacks[k], onOptions[k]);
  }));
});

// Provoke some updates
var updates = onUpdateWatches.then(function () {
  return Promise.all(list.map(function (k) {
    return efx.update(dataUpdate, items[k].id, items[k].writer).then(function (result) {
      updateItems[k] = result.data;
    });
  }));
});

// finally take a manual look at what was being watched
updates.then(function () {
  return Promise.all(list.map(function (k) {
    return efx.getWatched(subUpdates[k].watchable).then(function (result) {
      return console.log("manual " + k, result.data);
    });
  }));
});

// wait for a while  then turn these off
setTimeout(function () {

  updates.then(function () {

    // turn the watch url off
    Promise.all([subUpdates.url, subExpires.url].map(function (e) {
      return efx.off(e.watchable).then(function (result) {
        console.log('urls off');return efx.getWatchLog(result.data.key, items.url.writer);
      }).then(function (result) {
        console.log("url logs", JSON.stringify(result.data));return result;
      });
    }))

    // send out an update to make sure nothing happens for url
    .then(function () {
      console.log('doing updates');return Promise.all(list.map(function (k) {
        return efx.update(dataUpdate2, items[k].id, items[k].writer);
      }));
    }).then(function () {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          return resolve();
        }, 5000);
      });
    })
    // turn off the other watchers, but leave the expires
    .then(function () {
      return Promise.all([subUpdates.push, subUpdates.pull].map(function (e) {
        return efx.off(e.watchable).then(function (result) {
          console.log('updates off', result);return result;
        });
      }));
    })

    // send out more updates - shouldnt get anything happenig
    .then(function () {
      return Promise.all(list.map(function (k) {
        return efx.update(dataUpdate, items[k].id, items[k].writer);
      }));
    });
  });
}, 10000);
