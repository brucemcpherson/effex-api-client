module.exports = ((ns) => {


    let firebase, config, fapp ;
    
    ns.base = "/";
    ns.uid = ""; // /push is public - no sign in required - contains no useful info

    /**
     *  only initialize if using
     */
    ns.init = () => {
        firebase = require("firebase");
        config = require("./config.js")["firebase-config"];
        fapp = firebase.initializeApp(config,'efxapi-push');
        // set up structs
        //ns.auth = firebase.auth();
        ns.db = fapp.database();
        ns.baseRef = ns.db.ref(ns.base);
        
    };
    
    // no need to sign in
    ns.in = () => {
        return ns.db ? Promise.resolve(ns.uid) : Promise.reject ('first initialize firebase');
    };
    
    // set the base
    ns.setBase = (base) => {
        ns.base = (base + "/").replace("//", "/");
        ns.baseRef = ns.db.ref(ns.base);
        return ns;
    };

    // set listener for a specific key
    ns.setOn = (key, func) => {
        // listen on any key
        var ref = key ? ns.baseRef.child(key) : ns.baseRef;
        console.log (ref.toString());
        // call the user function
        ref.on("value", function(snapshot) {
            var value = snapshot.val();
            if (value)func(value);
        });
    };

    return ns;


})({});
