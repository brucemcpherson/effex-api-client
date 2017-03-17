# effex-api-client
Node api client for Ephemeral exchange

A cross platform cache, with a simple HTTP REST API that supports CORS

## Getting started

```
npm install effex-api-client --save
```

See the tests module for a complete list of everything you can do

to check if everything is working

```
var efx = require ('effex-api-client');

// set up client 
efx.setBase("https://ephex-auth.appspot-preview.com");

efx.ping().then(function(result)  {
  console.log( result.data );
});
```

## The console and dashboard
To create reader and writer keys you'll need an an account (free). See the console to register and to take the API tutorial.
https://storage.googleapis.com/effex-console-static/bundle/index.html#/

## Access keys
Before you can write to the store, you need a writer key. You need to generate writer keys using the API. Here are the different kinds of access keys and how to get them

| Access key type | what are they for | how to get one |
| ------------- |---------------| ---------------| 
| boss     | generating other access keys | from the console app | 
| writer      | reading, updating, writing or removing data from the store | with the API and a boss key |  
| updater | reading and updating data from the store      | with the API and a boss key |
| reader | reading | data from the store      | with the API and a boss key |
| item | needed to access a data item | by writing an item to the store with the API |
| alias | can be used to assign a constant name to a data item | by assigning an alias to to a particular key/item combination using a writer key |

Typically the account owner would keep the boss keys and writer keys private, and share item ,updater or reader keys with collaborators or collaborating applications.

To be able to access an item, these things need to happen
1. A writer key is needed to write data to the store. An item key is generated. The same writer key can be used to write many items. 
2. An item can be read back, updated or removed using the writer key plus the item key.
3. To assign read access to an item, you can specify a comma separated list of readers as a parameter when creating the item. Any reader keys mentioned in that list can read the item using the reader key plus the item key.
4. To assign update access to an item, you can specify a comma separated list of updaters as a parameter when creating the item. Any updater keys mentioned in that list can read or update the item using the updater key plus the item key.
5. To register an alias, you need a writer key and a data item id. You can then register an alias to a key/item combination and that key can use the alias to access the item that has been assigned that alias. This can be used to change the underlying data to a different item, without having to bother communicating the new item id  - so for example, a collaborating app could get by with only knowing a reader key plus a constant alias, even when the specific data item assigned to the alias is changed

## Expiration and disabling
Because this is a store for ephemeral data, everthing expires - accounts, data items, access keys and aliases - and their lifetime can each be individually set. Keys can last for months, but in the free version, data currently expires after a maximum of 12 hours although this may be revised as the service comes out of beta.

All access keys and items are associated with a specific account and will be immediately stop working if you disable or remove an account. You can create multiple accounts and manage them in the API console. You can stop a boss key being able to generate new keys by deleting it from the API console.

## Security
This is a public store, and there is no authentication required. However, keys are required for all data accesses, and both the data and its keys are encrypted in the store. You may also choose to further encrypt it before sending it to the store too. In any case, to ensure you comply with your country's privacy laws on the storage of personally identiable data - dont' do it. 

# Node client
The API has a simple HTTP REST API - take the tutorial to see the structure of each call if you want to write your own client. https://storage.googleapis.com/effex-console-static/bundle/index.html#/ .You can even use a browser to access the store if you want - handy for debugging. 

For convenience this node client is available, and of course you can use it in a web app too. 

## Initialization
Once you've installed it with npm, 

```
var efx = require ('effex-api-client');

// set up client 
efx.setBase("https://ephex-auth.appspot-preview.com");
```

## Responses
Unless its a transport error, http responses will always be 200. If there is a structural error in your call, or for example, data is missing - this will be reported in the response. 

A typical success response would be

```
{ writer:"wxk-eb1-o1cbq17qfbre"
  ok:true
  id:"dx1f7-g1x-127ib7e77bfn"
  plan:"x"
  accountId:"1f7"
  lifetime:3600
  size:175
  code:201
}
```
And a fail would be

``` 
{ reader:"wxk-eb1-o1cbq17qfbre"
  ok:false
  id:"dx1f7-51b-1t7ibudfmbfr"
  accountId:"1f7"
  plan:"x"
  value:null
  code:404
  error:"item is missing"
}
```
The property ok is present on all responses and is a simple way to test for success. The code property returns a typical http code for the type of operation being performed. 

## Promises
All responses from api requests are returned as promises.

## Methods
There's an example of a request and response for each of the methods that access the API. This is not an exhaustive list, as it does not cover the administrative account management functions which are not currently available in the free tier.

### parameters

Many api calls take parameters. They all follow the same format

### setBase (url)

Sets the API base url. Note that this is likely to change as the service moves from beta.

```
efx.setBase("https://ephex-auth.appspot-preview.com");
```

### generateKey (bosskey , type [,params])

Generates 1 or more keys of the given type ('writer', 'updater', 'reader')

example
```
efx.generateKey ("bx1f7-e11-b731jbd5p1fo" , "writer", {count:1} )
.then (function (response) {
  // do something
});

```
translates to native api url
```
https://ephex-auth.appspot-preview.com/bx1f7-e11-b731jbd5p1fo/writer?count=1
```
example response
```
type:"writer"
plan:"x"
lockValue:""
ok:true
validtill:"2017-03-17T13:01:54.593Z"
▶keys:[] 1 item
0:"wxk-eb1-v5oc917zfbfz"
accountId:"1f7"
```

### validateKey (key)

Validate any kind of key and get its expiration date

example
```
efx.validateKey ("bx1f7-e11-b731jbd5p1fo")
.then (function (response) {
  // do something
});

```
translates to native api url
```
https://ephex-auth.appspot-preview.com/validate/uxk-f1z-b17ce5kcvoeb
```

example response
```
ok:true
key:"uxk-f1z-b17ce5kcvoeb"
validtill:"2017-03-17T13:01:53.996Z"
type:"updater"
plan:"x"
accountId:"1f7"
code:200
```



## More stuff
See http://ramblings.mcpher.com/Home/excelquirks/ephemeralexchange for more stuff
