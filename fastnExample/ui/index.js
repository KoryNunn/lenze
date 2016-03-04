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
        state.update(lenze.state);
    });

    lenze.on('change', function(changes){
        changes.forEach(function(change){
            if(change.kind === 'N' || change.kind === 'E'){
                state.set(change.path, change.rhs);
            }else if( change.kind === 'D'){
                state.remove(change.path);
            }else if( change.kind === 'A'){
                console.log('x');
            }
        });
    });

    window.onload = function(){
        document.body.appendChild(ui.render().element);
    }
};