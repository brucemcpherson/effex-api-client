const efx = require('../dist/index');
efx.setBase("https://nodestuff-xlibersion.c9users.io"); //dev

const bossKey = "bx2b6-2db-oy4pbei1c6yo"; //dev
const keyTime = 3 * 60; //   3 minutes

// set up structure to parametrize the test
const subUpdates = {
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

const list = Object.keys(items);

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
        return items[k] = result.data;
      }))
  ));

write.then(() => list.forEach((d) => console.log(items[d])));

// make a set of watches looking for updates
const updateWatches = write
  .then(() => Promise.all(list.map(k => efx.watch(items[k].id, items[k].writer, "update").then(result => {
    subUpdates[k] = result.data;
    console.log(result.data.watchable, ' created for update type ', k);
  }))));

// make a set of watches looking for expirations
const expireWatches = write
  .then(() => Promise.all(
    list.map(
      k => efx.watch(items[k].id, items[k].writer, "expire")
      .then(result => {
        subExpires[k] = result.data;
        console.log(result.data.watchable, ' created for expire type ', k);
      }))
  ));

// start looking for things happening 
const onUpdateWatches = updateWatches
  .then(() => Promise.all(list.map(k => efx.on(subUpdates[k].watchable, callbacks[k], onOptions[k]))));

// start looking for things happening 
const onExpireWatches = expireWatches.then(() => Promise.all(
  list.map(k => efx.on(subExpires[k].watchable, callbacks[k], onOptions[k]))
));

// Provoke some updates
const updates = onUpdateWatches.then(() => Promise.all(
  list.map(
    k => efx.update(dataUpdate, items[k].id, items[k].writer)
    .then(result => {
      updateItems[k] = result.data;
    }))
));


// finally take a manual look at what was being watched
updates.then(() => Promise.all(
  list.map(
    k => efx.getWatched(subUpdates[k].watchable)
    .then(result => console.log("manual " + k, result.data)))
));


// wait for a while  then turn these off
setTimeout(() => {
  
  updates.then (() =>{
    
    // turn the watch url off
    Promise.all ([subUpdates.url,subExpires.url]
      .map ((e)=> {
        return efx.off(e.watchable)
          .then((result) => {console.log ('urls off'); return efx.getWatchLog(result.data.key, items.url.writer);})
          .then((result) => {console.log("url logs", JSON.stringify(result.data)); return result; });
      }))
      
      // send out an update to make sure nothing happens for url
      .then (()=> { console.log ('doing updates'); return Promise.all( list.map( k => efx.update(dataUpdate2, items[k].id, items[k].writer)))})
      
      .then (()=> new Promise (function (resolve, reject ) {
        setTimeout (()=>resolve(),5000);
      }))
      // turn off the other watchers, but leave the expires
      .then (()=> Promise.all ([subUpdates.push,subUpdates.pull]
        .map ((e)=> {
          return efx.off(e.watchable)
            .then((result) => {console.log('updates off', result); return result; });
        })))
        
        // send out more updates - shouldnt get anything happenig
        .then (()=> Promise.all( list.map( k => efx.update(dataUpdate, items[k].id, items[k].writer))));
      })} , 10000);
    
  
