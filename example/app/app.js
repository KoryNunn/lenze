var lenze = require('../../')({
    changeInterval: 16,
    send: function(data){
        self.postMessage(data);
    },
    receive: function(callback){
        self.addEventListener('message', function(message){
            callback(message.data);
        });
    }
});

var state = lenze.state;

state.setHeading = function(value){
    state.heading = 'Hello ' + (value || 'World');
};
state.setHeading();

state.objs = [];
state.x = {};
state.y = state.x;

setTimeout(function(){
    state.z = state.x;
}, 1000);