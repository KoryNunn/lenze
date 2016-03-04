var EventEmitter = require('events'),
    diff = require('deep-diff'),
    shuv = require('shuv'),
    statham = require('statham'),
    createKey = require('./createKey'),
    keyKey = createKey(-2);

var INVOKE = 'invoke';
var CHANGES = 'changes';
var CONNECT = 'connect';
var STATE = 'state';

function applyChanges(target, changes){
    changes.forEach(function(change){
        diff.applyChange(target, true , change);
    });
}

function transformFunctions(scope, key, value){
    if(typeof value === 'function' && value[keyKey]){
        return {'LENZE_FUNCTION': value[keyKey]};
    }

    return value;
}

function nextInstanceId(scope){
    return scope.instanceIds++;
}

function createChanges(scope, changes){
    changes = changes.map(function(change){
        var value = change.rhs;

        if(value && typeof value === 'object'){
            if(!value[keyKey]){
                value[keyKey] = createKey(nextInstanceId(scope));
            }
        }

        if(typeof value === 'function'){
            var id = value[keyKey];

            if(id == null){
                id = value[keyKey] = createKey(nextInstanceId(scope));
                scope.functions[id] = {
                    fn: value,
                    count: 0
                };
            }

            scope.functions[id].count++;
        }

        return change;
    });

    return statham.stringify(changes, shuv(transformFunctions, scope));
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
        scope.send(CONNECT, scope.lenze.state);
    }
}

function inflateData(scope, value){
    if(value && typeof value === 'object'){
        if(value[keyKey]){
            var id = value[keyKey];
            if(!scope.instanceHash[id]){
                scope.instanceHash[id] = {
                    value: value,
                    count: 0
                };
            }

            return scope.instanceHash[id].value;
        }else if('LENZE_FUNCTION' in value){
            var functionId = value['LENZE_FUNCTION'],
                fn = scope.invoke.bind(this, value['LENZE_FUNCTION']);

            fn['LENZE_FUNCTION'] = functionId;
            if(!scope.functions[functionId]){
                scope.functions[functionId] = {
                    fn: fn,
                    count: 0
                };
            }
            return fn;
        }
    }

    return value;
}

function inflateObject(scope, change){
    var id = change.rhs && change.rhs[keyKey];

    change.rhs = inflateData(scope, change.rhs);
    change.lhs = inflateData(scope, change.lhs);

    if(!id){
        return change;
    }

    if(!change.rhs || typeof change.rhs !== 'object'){
        return;
    }

    scope.instanceHash[id].count += change.kind === 'N' ? 1 : -1;

    if(typeof change.rhs === 'function'){
        change.rhs[keyKey] = id;
    }

    delete change.rhs[keyKey];
}

function inflateChanges(scope, data){
    return statham.parse(data).map(function(change){
        var value = change.rhs;

        inflateObject(scope, change);

        var previous = change.lhs;

        if(typeof previous === 'function'){

            var id = previous && previous['LENZE_FUNCTION'];
            if(id){
                scope.functions[id].count--;
                if(!scope.functions[id].count){
                    delete scope.functions[id];
                }
            }
        }

        if(typeof change.rhs === 'function' && 'LENZE_FUNCTION' in change.rhs){
            scope.functions[change.rhs['LENZE_FUNCTION']].count++;
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
            scope.send(CHANGES, changes);
        }
    }
}

function handleFunction(scope, id){
    scope.functions[id].fn.apply(this, Array.prototype.slice.call(arguments, 2));
}

function send(scope, send, type, data){
    if(type === CHANGES){
        send(CHANGES + ':' + createChanges(scope, data));
    }
    if(type === CONNECT){
        send(STATE + ':' + statham.stringify(data, shuv(transformFunctions, scope)));
    }
}

function sendInvoke(scope, sendInvoke){
    sendInvoke(INVOKE + ':' + statham.stringify(Array.prototype.slice.call(arguments, 2)));
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
            scope.lenze.state = inflateData(scope, statham.parse(message.data));
            update(scope);
        }

        if(message.type === CHANGES){
            applyChanges(scope.lenze.state, inflateChanges(scope, message.data));
            update(scope);
        }
    });

    scope.invoke = shuv(sendInvoke, scope, settings.send);

    settings.send(CONNECT + ':');

    return scope.lenze
}

module.exports = init;
module.exports.replicant = replicant;
