# lenze

cross instance state replication with function invoking

## Usage

In thread 1:

```javascript
var Lenze = require('lenze');

var lenze = Lenze({

    // Optional, defaults to 100
    changeInterval: 100,

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

var lenze = Lenze.replicant({

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

 - Object references are maintained.
 - Function references are NOT currently maintained. this is a TODO.

 This is a very experimental.
 The code is very messy and not optimised.
 There are many TODOs floating around my head.