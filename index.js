var EventEmitter = require('events'),
    viscous = require('viscous'),
    shuv = require('shuv'),
    statham = require('statham'),
    createKey = require('./createKey'),
    keyKey = createKey(-2),
    merge = require('merge');

var INVOKE = 'invoke';
var CHANGES = 'changes';
var CONNECT = 'connect';
var STATE = 'state';

function functionTransform(scope, key, value){
    if(typeof value === 'function'){
        var result = {'LENZE_FUNCTION':scope.viscous.getId(value)};
        for(var key in value){
            result[key] = value[key];
        }
        return result;
    }
    if(Array.isArray(value)){
        var result = {'LENZE_ARRAY':scope.viscous.getId(value)};
        for(var key in value){
            result[key] = value[key];
        }
        return result;
    }
    return value;
}

function createChanges(scope, changes){
    return statham.stringify(changes, shuv(functionTransform, scope));
}

function parseMessage(data){
    var message = data.match(/^(\w+?)\:(.*)/);

    if(message){
        return {
            type: message[1],
            data: message[2]
        }
    }
}

function receive(scope, data){
    var message = parseMessage(data);

    if(!message){
        return;
    }

    if(message.type === INVOKE){
        scope.handleFunction.apply(null, statham.parse(message.data));
    }

    if(message.type === CONNECT){
        scope.send(CONNECT, scope.viscous.state());
    }
}

function inflateChanges(scope, data){
    var changes = statham.parse(data, function(key, value){
        if(!value || !(typeof value === 'object' || typeof value === 'function')){
            return value;
        }

        if('LENZE_ARRAY' in value){
            delete value['LENZE_ARRAY'];
            var resultArray = [];
            for(var key in value){
                resultArray[key] = value[key];
            }
            return resultArray;
        }

        if('LENZE_FUNCTION' in value){
            var id = value['LENZE_FUNCTION'];
            delete value['LENZE_FUNCTION'];
            var resultFunction = function(){
                scope.invoke.apply(null, [id].concat(Array.prototype.slice.call(arguments)));
            };
            for(var key in value){
                resultFunction[key] = value[key];
            }
            return resultFunction;
        }

        return value;
    });

    changes[0] = changes[0].map(function(instanceChange){
        if(instanceChange[1] !== 'r'){

        }

        return instanceChange;
    });

    return changes;
}

function update(scope){
    var changes = scope.viscous.changes();

    if(changes.length > 1){
        scope.lenze.emit('change', changes);

        if(scope.send){
            scope.send(CHANGES, changes);
        }
    }
}

function handleFunction(scope, id){
    scope.viscous.getInstance(id).apply(this, Array.prototype.slice.call(arguments, 2));
}

function send(scope, send, type, data){
    if(type === CHANGES){
        send(CHANGES + ':' + createChanges(scope, data));
    }
    if(type === CONNECT){
        send(STATE + ':' + createChanges(scope, data));
    }
}

function sendInvoke(scope, sendInvoke){
    sendInvoke(INVOKE + ':' + statham.stringify(Array.prototype.slice.call(arguments, 2)));
}

function initScope(settings){
    if(!settings){
        settings = {};
    }

    var state = {};

    var lenze = new EventEmitter();
    var scope = {
        viscous: viscous(state),
        functions: {},
        instanceIds: 0,
        lenze: lenze
    };

    lenze.update = shuv(update, scope);
    lenze.state = state;

    return scope;
}

function init(settings){
    var scope = initScope(settings);

    scope.handleFunction = shuv(handleFunction, scope);
    scope.send = shuv(send, scope, settings.send);
    settings.receive(shuv(receive, scope));

    setInterval(scope.lenze.update, settings.changeInterval || 100);

    return scope.lenze;
}

function replicant(settings){
    var scope = initScope();

    scope.instanceHash = {};

    settings.receive(function(data){
        if(!scope.ready){
            scope.ready = true;
            scope.lenze.emit('ready');
        }

        var message = parseMessage(data);

        if(!message){
            return;
        }

        if(message.type === STATE){
            scope.viscous.apply(inflateChanges(scope, message.data));
            update(scope);
        }

        if(message.type === CHANGES){
            scope.viscous.apply(inflateChanges(scope, message.data));
            update(scope);
        }
    });

    scope.invoke = shuv(sendInvoke, scope, settings.send);

    settings.send(CONNECT + ':');

    return scope.lenze
}

module.exports = init;
module.exports.replicant = replicant;
