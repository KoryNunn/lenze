var lenze = require('../')({
    send: function(data){
        window.postMessage(data, '*');
    },
    handleInvoke: function(callback){
        window.addEventListener('message', function(message){
            callback(message.data);
        });
    }
});

var state = lenze.state;
state.x = 0;

state.foo = function(dooby){
    console.log('foo:', dooby);
};
state.bar  = function(whatsits){
    console.log('bar:', whatsits);
};

setInterval(function(){
    state.x++;
}, 1000);

module.exports = lenze;