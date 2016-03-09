var fastn = require('./fastn'),
    Enti = require('enti'),
    Lenze = require('../../');

module.exports = function(worker){

    var lenze = Lenze.replicant({
        receive: function(callback){
            worker.addEventListener('message', function(message){
                callback(message.data);
            });
        },
        send: function(data){
            worker.postMessage(data);
        }
    });

    var state = new Enti(),
        ui = fastn('div',
            fastn('h1', fastn.binding('heading')),
            fastn('input')
            .on('keyup', function(event, scope){
                scope.get('.').setSearch(event.target.value);
            }),
            fastn('list', {
                items: fastn.binding('visibleUsers|*'),
                template: function(){
                    return fastn('div',
                        fastn.binding('item.name')
                    );
                }
            })
        ).attach(state);

    lenze.on('ready', function(){
        state.attach(lenze.state);
    });

    lenze.on('change', function(changes){
        for(var i = 1; i < changes.length; i++){
            var change = lenze.getChangeInfo(changes[i]);

            if(change.type === 'r'){
                Enti.set(change.target, change.key, undefined);
            }else{
                Enti.set(change.target, change.key, change.value);
            }
        };
    });

    window.onload = function(){
        document.body.appendChild(ui.render().element);
    }
};