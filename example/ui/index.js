var crel = require('crel'),
    Lenze = require('../../');

module.exports = function(worker){

    var lenze = Lenze.replicant({
        recieve: function(callback){
            worker.addEventListener('message', function(message){
                callback(message.data);
            });
        },
        invoke: function(data){
            worker.postMessage(data);
        }
    });

    var heading, input, ui = crel('div',
            heading = crel('h1'),
            input = crel('input')
        );

    lenze.on('ready', function(){
        input.addEventListener('keyup', function(){
            lenze.state.setHeading(input.value);
        });
    });

    lenze.on('change', function(){
        heading.textContent = lenze.state.heading;
        console.log(lenze.state.x === lenze.state.y, lenze.state.x === lenze.state.z);
    });

    window.onload = function(){
        crel(document.body, ui);
    }
};