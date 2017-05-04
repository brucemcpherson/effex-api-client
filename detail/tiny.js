const efx = require('../dist/index');

var dev = true;

// set up client 

var bossKey = dev ? "bx1f9-zb1hg-44ov1bj19f92" : "bx2ao-1zj-bf300lgaod2q"; //dev
efx.setEnv(dev ? 'dev' : 'prod');


const keyTime = 30 * 60; //   3 minutes

// set up structure to parametrize the test
const subUpdates = {
    push: "",
    pull: "",
    url: ""
  },
  subUpdatesAlias = {
    push: "",
    pull: "",
    url: ""
  },
  subExpiresAlias = {
    push: "",
    pull: "",
    url: ""
  },
  removeUpdateItems = {
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
    push: (watchid, pack) => console.log('..push detected', watchid, pack),
    pull: (watchid, pack) => console.log('..pull detected', watchid, pack),
    url: "https://script.google.com/macros/s/AKfycbz6XKhAjYDju7GqQmW6eU26uTElYPywTONxsRssNaw0q6MDXL0/exec"
  };

//const list = Object.keys(items);
const list = ["push", "url", "pull"];

var dataUpdate = [{
  name: "fred",
  id: 50,
  time: new Date().getTime(),
  session: efx.getSession()
}, {
  name: "jane",
  id: 70,
  time: new Date().getTime(),
  session: efx.getSession()
}];

var aUpdate = [{
  name: "fredalias",
  id: 50,
  time: new Date().getTime(),
  session: efx.getSession()
}, {
  name: "janealias",
  id: 70,
  time: new Date().getTime(),
  session: efx.getSession()
}];

var dataUpdate2 = JSON.parse(JSON.stringify(dataUpdate));
dataUpdate2[0].id = 200;
dataUpdate2[1].id = 900;

// get keys
let makeKeys = efx.makeKeys(bossKey, {
  seconds: keyTime
});

//....make a bunch of items for the test, allow an updater key to access them, 
// and send the updater key as a message
const write = makeKeys
  .then(() => Promise.all(
    list.map(
      k => efx.write(k, null, null, {
        updaters: efx.getKeys().updater
      })
      .then(result => {
        onOptions[k].message = {
          updater: result.data.updaters[0]
        };
        onOptions[k].reader = result.data.writer;
        return items[k] = result.data;
      }))
  ));

write.then ((r)=>{
  var data = items.pull;
  var keys = efx.getKeys();

  /**
  efx.read (data.id , keys.writer, {intention:"update"})
  .then ((result)=>console.log (result.data));
  **/
  /*
   efx.expBackoff(
    ()=>efx.read(data.id , keys.writer, {intention:"update"}),
    (lastResult)=>lastResult.data.code===423)
    .then ((result)=>console.log(result.data))
    .catch ((err)=>console.log(err.data));
*/
/*
  // normal - will try only once
  efx.read(data.id , keys.writer, {intention:"update"})
  .then ((result)=>console.log(result.data));
*/
  
  // wait some amount of time then update 
  efx.read(data.id , keys.writer, {intention:"update"})
  .then ((result)=>efx.handyTimer(Math.random()*5000,result))
  .then ((result)=>{
    return efx.update ('something',result.data.id,result.data.reader,"post",{
      intent:result.data.intent
    })})
  .then((result)=>console.log('updated',result.data))
  .catch((err)=>console.log(err));
  
/*
  // will try a number of times
  efx.expBackoff(
    ()=>efx.read(data.id , keys.updater, {intention:"update"}),
    (lastResult)=>lastResult.data.code===423)
    .then ((result)=>console.log(result.data))
    .catch ((err)=>console.log(err.data));  
*/    
  // will try a number of times, and adjust the try time based on info from the result
  efx.expBackoff(
    ()=>efx.read(data.id , keys.updater, {intention:"update"}),
    (lastResult)=>lastResult.data.code===423,{
      setWaitTime:(waitTime, passes, result,proposed) => { 
        // take the minimum of exp time and remaining waiting time on current intent
      return Math.min(proposed, ((result && result.data && result.data.intentExpires) || 0) * 1000);
      }
    })
    .then ((result)=>console.log(result.data))
    .catch ((err)=>console.log(err.data));  
    
    
  // wait some random time then do an update using the first intent
  efx.update("something", data.id, keys.updater, "post", {
            intent: data.intent
          });
});

if (false) {
const writeAlias = makeKeys
  .then(() => Promise.all(
    list.map(
      k => efx.writeAlias(k, 'alias'+k, null,null,  {
        updaters: efx.getKeys().updater
      }))
  ));

writeAlias.then ((r)=>r.forEach((t)=>console.log(t.data))).catch((err)=>console.log('writealias failed',err));

// make a set of watches looking for updates
const updateWatches = write.then(() => {

  return Promise.all(
    list.map((k) => {
      return efx.on("update", items[k].id, items[k].writer, callbacks[k], onOptions[k])
        .then(result => {
          subUpdates[k] = result;
          console.log(new Date().getTime(), ' watching for update type ', k);
          return result;
        });
    }));
});

// make a set of watches looking for updates
const updateAliasWatches = Promise.all([write,writeAlias]).then(() => {

  return Promise.all(
    list.map((k) => {
      return efx.on("update", 'alias'+k, items[k].writer, callbacks[k], onOptions[k])
        .then(result => {
          subUpdatesAlias[k] = result;
          console.log(new Date().getTime(), ' watching for update alias type ', k);
          return result;
        });
    }));
});

const updateAliasExpires = Promise.all([write,writeAlias]).then(() => {

  return Promise.all(
    list.map((k) => {
      return efx.on("expire", 'alias'+k, items[k].writer, callbacks[k], onOptions[k])
        .then(result => {
          subExpiresAlias[k] = result;
          console.log(new Date().getTime(), ' watching for expire alias type ', k);
          return result;
        });
    }));
});

// make a set of watches looking for updates
const updateExpires = write.then(() => {

  return Promise.all(
    list.map((k) => {
      return efx.on("expire", items[k].id, items[k].writer, callbacks[k], onOptions[k])
        .then(result => {
          subExpires[k] = result;
          console.log(new Date().getTime(), ' watching for expire type ', k);
          return result;
        })
    }));
});

const writeAlias2 = makeKeys
  .then(() => Promise.all(
    list.map(
      k => efx.writeAlias(k, 'alias'+k, null,null, {
        updaters: efx.getKeys().updater
      }))
  ));

// Provoke some updates
const updates = updateWatches.then(() => Promise.all(
  list.map(
    k => efx.update(dataUpdate, items[k].id, items[k].writer)
    .then(result => {
      console.log('provoked update done for', k, new Date().getTime());
      updateItems[k] = result.data;
      return updateItems[k];
    }))
));

// Provoke some updates
const updatesAlias = updateAliasWatches.then(() => Promise.all(
  list.map(k => efx.update(aUpdate, 'alias'+k, items[k].writer))
));

// change the alias to point to something else

// wait a bit an do some more
// Provoke some updates
const updates2 = updates.then(() => pTimer_(2, 3000)).then(() => Promise.all(
  list.map(
    k => efx.update(dataUpdate2, items[k].id, items[k].writer)
    .then(result => {
      console.log('provoked update 2 done for', k, new Date().getTime());
      updateItems[k] = result.data;
      return updateItems[k];
    }))
));

// now lets delete all the watches
const removes = Promise.all([updateWatches,updates2]).then(() => pTimer_(2, 3000)).then(() => {
  return Promise.all(
    list.map(
      k => {
        console.log("..", k, subUpdates[k]);
        return efx.off(subUpdates[k].watchable)
          .then(result => {
            console.log('removed subupdatewatch', k, new Date().getTime());
            removeUpdateItems[k] = result.data;
            return removeUpdateItems[k];
          });
      })
  );
});

removes.then((r) => r.forEach((t) => console.log(t)));

// Provoke some more removes
const updates3 = removes.then(() => Promise.all(
  list.map(
    k => efx.update(dataUpdate, items[k].id, items[k].writer)
    .then(result => {
      console.log('provoked update 3 done for', k, new Date().getTime());
      updateItems[k] = result.data;
      return updateItems[k];
    }))
));
}
function pTimer_(id, ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(id), ms);
  });
}

/*
updates.then ((r)=>console.log("fin updates",r.map(e=>e.modified))).catch((e)=>console.log("err updates",e));
updates.then ((r)=>r.forEach((e)=>efx.read(e.id,e.updater).then((f)=>console.log(f.data))));
*/
