# effex-api-client
Node api client for Ephemeral exchange

A cross platform cache

##Getting started

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

To create reader and writer keys you'll need an an account (free). See the console to register and to take the API tutorial.

See http://ramblings.mcpher.com/Home/excelquirks/ephemeralexchange for more stuff
