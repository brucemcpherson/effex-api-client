module.exports = ((ns) => {

    const firebase = require("firebase");
    var config = require("./config.js")["firebase-config"];
    firebase.initializeApp(config);

    // set up structs
    ns.auth = firebase.auth();
    ns.db = firebase.database();
    ns.base = "/";
    ns.uid = ""; // /push is public - no sign in required - contains no useful info
    ns.baseRef = ns.db.ref(ns.base);

    // no need to sign in
    ns.in = () => Promise.resolve(ns.uid);
    
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
