var EventEmitter = require('events'),
    diff = require('deep-diff'),
    shuv = require('shuv'),
    statham = require('statham'),
    createKey = require('./createKey'),
    keyKey = createKey(-2);

function applyChanges(target, changes){
    changes.forEach(function(change){
        diff.applyChange(target, true , change);
    });
}

function createChanges(scope, changes){
    changes = changes.map(function(change){
        var value = change.rhs;

        if(typeof value === 'object'){
            if(!value[keyKey]){
                value[keyKey] = createKey(scope.instanceIds++);
            }
        }

        if(typeof value === 'function'){
            var id = value[keyKey];

            if(id == null){
                id = value[keyKey] = createKey(scope.instanceIds++);
                scope.functions[id] = {
                    fn: value,
                    count: 0
                };
            }

            change.rhs = {'LENZE_FUNCTION': id};
        }

        return change;
    });

    return statham.stringify(changes);
}

function handleInvoke(scope, data){
    var invoke = data.match(/^invoke\:(.*)/);

    if(invoke){
        scope.handleFunction.apply(null, statham.parse(invoke[1]));
    }
}

function inflateChanges(scope, data){
    return statham.parse(data).map(function(change){
        var value = change.rhs;

        if(value && typeof value === 'object'){
            if(value[keyKey]){
                var id = value[keyKey];
                if(!scope.instanceHash[id]){
                    scope.instanceHash[id] = value;
                }

                change.rhs = scope.instanceHash[id];
            }else if('LENZE_FUNCTION' in value){
                change.rhs = scope.invoke.bind(this, value['LENZE_FUNCTION']);

            }

            delete value[keyKey];
        }

        return change;
    });
}

function update(scope){
    var changes = diff(scope.original, scope.lenze.state);

    if(changes){
        scope.lenze.emit('change', changes);
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
    sendInvoke('invoke:' + statham.stringify(Array.prototype.slice.call(arguments, 2)));
}

function initScope(settings){
    if(!settings){
        settings = {};
    }

    var lenze = new EventEmitter();
    var scope = {
        functions: {},
        instanceIds: 0,
        lenze: lenze,
        original: {}
    };

    lenze.update = shuv(update, scope);
    lenze.state = {};

    return scope;
}

function init(settings){
    var scope = initScope(settings);

    scope.handleFunction = shuv(handleFunction, scope);
    scope.send = shuv(send, scope, settings.send);
    settings.handleInvoke(shuv(handleInvoke, scope));

    setInterval(scope.lenze.update, settings.changeInterval || 100);

    return scope.lenze;
}

function replicant(settings){
    var scope = initScope();

    scope.instanceHash = {};

    settings.recieve(function(data){
        if(!scope.ready){
            scope.ready = true;
            scope.lenze.emit('ready');
        }

        var changes = data.match(/^changes\:(.*)/);

        if(changes){
            applyChanges(scope.lenze.state, inflateChanges(scope, changes[1]));
            update(scope);
        }
    });

    scope.invoke = shuv(sendInvoke, scope, settings.invoke);

    return scope.lenze
}

module.exports = init;
module.exports.replicant = replicant;
