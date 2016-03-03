var crel = require('crel'),
    lenze = require('../').replicant({
        recieve: function(callback){
            window.addEventListener('message', function(message){
                callback(message.data);
            });
        },
        invoke: function(data){
            window.postMessage(data, '*');
        }
    });

lenze.on('change', function(){
    console.log(lenze.state);

    lenze.state.foo('foo');
    lenze.state.bar('bar');
});

var ui = crel('div',
        crel('h1'),
        crel('input')
    );

window.onload = function(){
    crel(document.body, ui);
}