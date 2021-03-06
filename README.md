# lenze

cross instance state replication with function invoking

## Usage

In thread 1:

```javascript
var Lenze = require('lenze');

var lenze = Lenze(sourceStateObject, {

    // Optional, defaults to 30
    // How often to poll when there have been recent changes
    minInterval: 30,

    // Optional, defaults to 300
    // How often to poll when there have not been recent changes
    maxInterval: 300,

    // Optional, defaults to 1000
    // How long to poll at minInterval before returning to maxInterval
    dozeInterval: 300,

    // How to send updates
    send: function(data){
        self.postMessage(data);
    },

    // How to receive invocations/connects
    receive: function(callback){
        self.addEventListener('message', function(message){
            callback(message.data);
        });
    }
});

state.x = 10;

state.doSomething = function(x){
    console.log(x);
};
```

In main thread:

```javascript
var Lenze = require('../../');

var worker = new Worker("thread1.js");

var lenze = Lenze.replicant(targetStateObject, {

    // How to recieve updates/state
    receive: function(callback){
        worker.addEventListener('message', function(message){
            callback(message.data);
        });
    },

    // How to send invocations/connects
    send: function(data){
        worker.postMessage(data);
    }
});

// Called when the replicant gets state/change for the first time.
lenze.on('ready', function(){

    // This will cause 'dooby' to be logged in the first thread.
    lenze.state.doSomething('dooby');

});

// Called when any state changes within the lenze. (probably often);
lenze.on('change', function(){

    console.log(lenze.state);

});
```

## Notes

 - Instance references (objects/function) are maintained.

 This is a very experimental.
 The code is very messy and not optimised.
 There are many TODOs floating around my head.