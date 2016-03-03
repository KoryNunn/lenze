var EventEmitter = require('events'),
    diff = require('deep-diff'),
    shuv = require('shuv');

function applyChanges(target, changes){
    changes.forEach(function(change){
        diff.applyChange(target, true , change);
    });
}

function createChanges(scope, changes){
    return JSON.stringify(changes, function(key, value){
        if(typeof value === 'function'){
            var id = value.__LENZE_ID;

            if(id == null){
                id = value.__LENZE_ID = scope.functionIds++;
                scope.functions[id] = {
                    fn: value,
                    count: 0
                };
            }

            return {'LENZE_FUNCTION': id}
        }
        return value;
    });
}

function handleInvoke(scope, data){
    var invoke = data.match(/^invoke\:(.*)/);

    if(invoke){
        scope.handleFunction.apply(null, JSON.parse(invoke[1]));
    }
}

function inflateChanges(scope, data){
    return JSON.parse(data, function(key, value){
        if(value && typeof value === 'object' && 'LENZE_FUNCTION' in value){
            return scope.invoke.bind(this, value['LENZE_FUNCTION']);
        }

        return value;
    });
}

function update(scope){
    var changes = diff(scope.original, scope.lenze.state);

    if(changes){
        scope.lenze.emit('change', createChanges(scope, changes));
        applyChanges(scope.original, changes);
        if(scope.send){
            scope.send(changes);
        }
    }
}

function handleFunction(scope, id){
    scope.functions[id].fn.apply(this, Array.prototype.slice.call(arguments, 2));
}

function send(scope, send, changes){
    send('changes:' + createChanges(scope, changes));
}

function sendInvoke(scope, sendInvoke){
    sendInvoke('invoke:' + JSON.stringify(Array.prototype.slice.call(arguments, 2)));
}

function initScope(settings){
    if(!settings){
        settings = {};
    }

    var lenze = new EventEmitter();
    var scope = {
        functions: {},
        functionIds: 0,
        lenze: lenze,
        original: {}
    };

    lenze.update = shuv(update, scope);
    lenze.state = {};

    setInterval(lenze.update, settings.changeInterval || 100);

    return scope;
}

function init(settings){
    var scope = initScope(settings);

    scope.handleFunction = shuv(handleFunction, scope);
    scope.send = shuv(send, scope, settings.send);
    settings.handleInvoke(shuv(handleInvoke, scope));

    return scope.lenze;
}

function replicant(settings){
    var scope = initScope();

    settings.recieve(function(data){
        var changes = data.match(/^changes\:(.*)/);

        if(changes){
            applyChanges(scope.lenze.state, inflateChanges(scope, changes[1]));
        }
    });

    scope.invoke = shuv(sendInvoke, scope, settings.invoke);

    return scope.lenze
}

module.exports = init;
module.exports.replicant = replicant;
