var fastn = require('./fastn'),
    Lenze = require('../../'),
    EventEmitter = require('events');

module.exports = function(worker){
    var app = new EventEmitter(),
        lenze = Lenze.replicant(app, {
            receive: function(callback){
                worker.addEventListener('message', function(message){
                    callback(message.data);
                });
            },
            send: function(data){
                worker.postMessage(data);
            }
        });

    lenze.on('change', function(changes){
        for(var i = 1; i < changes.length; i++){
            var change = lenze.getChangeInfo(changes[i]);

            if(change.type === 'r'){
                fastn.Model.remove(change.target, change.key);
            }else{
                fastn.Model.set(change.target, change.key, change.value);
            }
        };
    });

    return app;
};