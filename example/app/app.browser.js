(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
function escapeHex(hex){
    return String.fromCharCode(hex);
}

function createKey(number){
    if(number + 0xE001 > 0xFFFF){
        throw "Too many references. Log an issue on gihub an i'll add an order of magnatude to the keys.";
    }
    return escapeHex(number + 0xE001);
}

module.exports = createKey;
},{}],3:[function(require,module,exports){
var lenze = require('../../')({
    changeInterval: 16,
    send: function(data){
        self.postMessage(data);
    },
    receive: function(callback){
        self.addEventListener('message', function(message){
            callback(message.data);
        });
    }
});

var state = lenze.state;

state.setHeading = function(value){
    state.heading = 'Hello ' + (value || 'World');
};
state.setHeading();

state.objs = [];
state.x = {};
state.y = state.x;

setTimeout(function(){
    state.z = state.x;
}, 1000);
},{"../../":4}],4:[function(require,module,exports){
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

},{"./createKey":2,"events":1,"merge":5,"shuv":6,"statham":11,"viscous":13}],5:[function(require,module,exports){
/*!
 * @name JavaScript/NodeJS Merge v1.2.0
 * @author yeikos
 * @repository https://github.com/yeikos/js.merge

 * Copyright 2014 yeikos - MIT license
 * https://raw.github.com/yeikos/js.merge/master/LICENSE
 */

;(function(isNode) {

	/**
	 * Merge one or more objects 
	 * @param bool? clone
	 * @param mixed,... arguments
	 * @return object
	 */

	var Public = function(clone) {

		return merge(clone === true, false, arguments);

	}, publicName = 'merge';

	/**
	 * Merge two or more objects recursively 
	 * @param bool? clone
	 * @param mixed,... arguments
	 * @return object
	 */

	Public.recursive = function(clone) {

		return merge(clone === true, true, arguments);

	};

	/**
	 * Clone the input removing any reference
	 * @param mixed input
	 * @return mixed
	 */

	Public.clone = function(input) {

		var output = input,
			type = typeOf(input),
			index, size;

		if (type === 'array') {

			output = [];
			size = input.length;

			for (index=0;index<size;++index)

				output[index] = Public.clone(input[index]);

		} else if (type === 'object') {

			output = {};

			for (index in input)

				output[index] = Public.clone(input[index]);

		}

		return output;

	};

	/**
	 * Merge two objects recursively
	 * @param mixed input
	 * @param mixed extend
	 * @return mixed
	 */

	function merge_recursive(base, extend) {

		if (typeOf(base) !== 'object')

			return extend;

		for (var key in extend) {

			if (typeOf(base[key]) === 'object' && typeOf(extend[key]) === 'object') {

				base[key] = merge_recursive(base[key], extend[key]);

			} else {

				base[key] = extend[key];

			}

		}

		return base;

	}

	/**
	 * Merge two or more objects
	 * @param bool clone
	 * @param bool recursive
	 * @param array argv
	 * @return object
	 */

	function merge(clone, recursive, argv) {

		var result = argv[0],
			size = argv.length;

		if (clone || typeOf(result) !== 'object')

			result = {};

		for (var index=0;index<size;++index) {

			var item = argv[index],

				type = typeOf(item);

			if (type !== 'object') continue;

			for (var key in item) {

				var sitem = clone ? Public.clone(item[key]) : item[key];

				if (recursive) {

					result[key] = merge_recursive(result[key], sitem);

				} else {

					result[key] = sitem;

				}

			}

		}

		return result;

	}

	/**
	 * Get type of variable
	 * @param mixed input
	 * @return string
	 *
	 * @see http://jsperf.com/typeofvar
	 */

	function typeOf(input) {

		return ({}).toString.call(input).slice(8, -1).toLowerCase();

	}

	if (isNode) {

		module.exports = Public;

	} else {

		window[publicName] = Public;

	}

})(typeof module === 'object' && module && typeof module.exports === 'object' && module.exports);
},{}],6:[function(require,module,exports){
var placeholder = {},
    endOfArgs = {},
    slice = Array.prototype.slice.call.bind(Array.prototype.slice);

function shuv(fn){
    var outerArgs = slice(arguments, 1);

    if(typeof fn !== 'function'){
        throw new Error('No or non-function passed to shuv');
    }

    return function(){
        var context = this,
            innerArgs = slice(arguments),
            finalArgs = [],
            append = true;

        for(var i = 0; i < outerArgs.length; i++){
            var outerArg = outerArgs[i];

            if(outerArg === endOfArgs){
                append = false;
                break;
            }

            if(outerArg === placeholder){
                finalArgs.push(innerArgs.shift());
                continue;
            }

            finalArgs.push(outerArg);
        }

        if(append){
            finalArgs = finalArgs.concat(innerArgs);
        }

        return fn.apply(context, finalArgs);
    };
}

shuv._ = placeholder;
shuv.$ = endOfArgs;

module.exports = shuv;
},{}],7:[function(require,module,exports){
arguments[4][2][0].apply(exports,arguments)
},{"dup":2}],8:[function(require,module,exports){
module.exports = function isInstance(value){
    return value && typeof value === 'object' || typeof value === 'function';
};
},{}],9:[function(require,module,exports){
var revive = require('./revive');

function parse(json, reviver){
    return revive(JSON.parse(json, reviver));
}

module.exports = parse;
},{"./revive":10}],10:[function(require,module,exports){
var createKey = require('./createKey'),
    keyKey = createKey(-1),
    isInstance = require('./isInstance');

function revive(input){
    var objects = {},
        scannedObjects = [],
        scannedOutputs = [];

    function scan(input){

        var output = input;

        if(!isInstance(input)){
            return output;
        }

        var inputIndex = scannedObjects.indexOf(input);

        if(~inputIndex){
            return scannedOutputs[inputIndex];
        }

        output = input && input instanceof Array ? [] : typeof input === 'function' ? input : {};

        scannedObjects.push(input);
        scannedOutputs.push(output);

        if(keyKey in input){
            objects[input[keyKey]] = output;
        }

        for(var key in input){
            var value = input[key];

            if(key === keyKey){
                continue;
            }

            if(isInstance(value)){
                output[key] = scan(value);
            }else if(
                typeof value === 'string' &&
                value.length === 1 &&
                value.charCodeAt(0) > keyKey.charCodeAt(0) &&
                value in objects
            ){
                output[key] = objects[value];
            }else{
                output[key] = input[key];
            }
        }

        return output;
    }

    if(!input || typeof input !== 'object'){
        return input;
    }

    return scan(input);
}

module.exports = revive;
},{"./createKey":7,"./isInstance":8}],11:[function(require,module,exports){
module.exports = {
    stringify: require('./stringify'),
    parse: require('./parse'),
    revive: require('./revive')
};
},{"./parse":9,"./revive":10,"./stringify":12}],12:[function(require,module,exports){
var createKey = require('./createKey'),
    keyKey = createKey(-1),
    isInstance = require('./isInstance');

function toJsonValue(value){
    if(value != null && typeof value === 'object'){
        var result = value instanceof Array ? [] : {},
            output = value;
        if('toJSON' in value){
            output = value.toJSON();
        }
        for(var key in output){
            result[key] = output[key];
        }
        return result;
    }

    return value;
}

function stringify(input, replacer, spacer){
    var objects = [],
        outputObjects = [],
        refs = [];

    function scan(input){
        if(!isInstance(input)){
            return input;
        }

        var output,
            index = objects.indexOf(input);

        if(index >= 0){
            outputObjects[index][keyKey] = refs[index]
            return refs[index];
        }

        index = objects.length;
        objects[index] = input;
        output = toJsonValue(input);
        outputObjects[index] = output;
        refs[index] = createKey(index);

        for(var key in output){
            output[key] = scan(output[key]);
        }

        return output;
    }

    return JSON.stringify(scan(input), replacer, spacer);
}

module.exports = stringify;
},{"./createKey":7,"./isInstance":8}],13:[function(require,module,exports){
var same = require('same-value');

function isInstance(value){
    var type = typeof value;
    return value && type === 'object' || type === 'function';
}

function getId(){
    return (this.currentId++).toString(36);
}

function objectRemovedChanges(scope, object){
    var itemInfo = scope.trackedMap.get(object);

    itemInfo.occurances--;

    for(key in object){
        if(isInstance(object[key])){
            objectRemovedChanges(scope, object[key]);
        }
    }
}

function getInstanceInfo(scope, value){
    if(!isInstance(value)){
        return;
    }

    var lastInfo = scope.trackedMap.get(value);

    if(!lastInfo){
        lastInfo = {
            id: scope.getId(),
            instance: value,
            lastState: {},
            occurances: false
        };
        scope.instances[lastInfo.id] = value;
        scope.trackedMap.set(value, lastInfo);
    }

    return lastInfo;
}

function getInstanceId(value){
    var info = getInstanceInfo(this, value);

    return info && info.id;
}

function getRemovedChange(scope, changes, lastInfo, object, oldKey){
    if(!(oldKey in object)){
        var oldValue = lastInfo.lastState[oldKey];
        changes.push([lastInfo.id, oldKey, 'r']);

        if(isInstance(oldValue) && scope.trackedMap.has(oldValue)){
            objectRemovedChanges(scope, oldValue);
        }

        delete lastInfo.lastState[oldKey];
    }
}

function getRemovedChanges(scope, changes, lastInfo, object){
    for(var oldKey in lastInfo.lastState){
        getRemovedChange(scope, changes, lastInfo, object, oldKey);
    }
}

function getCurrentChange(scope, changes, lastInfo, object, currentKey, scanned, instanceChanges){
    var type = currentKey in lastInfo.lastState ? 'e' : 'a',
        oldValue = lastInfo.lastState[currentKey],
        currentValue = object[currentKey],
        change = [lastInfo.id, currentKey, type],
        changed = !same(oldValue, currentValue);

    if(changed){
        if(isInstance(oldValue) && scope.trackedMap.has(oldValue)){
            objectRemovedChanges(scope, oldValue);
        }
    }else{
        // Previously no key, now key, but value is undefined.
        if(type === 'a'){
            changes.push(change);
        }
    }

    lastInfo.lastState[currentKey] = currentValue;

    if(!isInstance(currentValue)){
        change.push(currentValue);
    }else{
        var valueChanges = getObjectChanges(scope, currentValue, scanned),
            valueInfo = scope.trackedMap.get(currentValue);

        valueInfo.occurances++;
        change.push([valueInfo.id]);

        if(valueChanges){
            changes.push.apply(changes, valueChanges.changes);
            instanceChanges.push.apply(instanceChanges, valueChanges.instanceChanges);
        }
    }

    if(changed){
        changes.push(change);
    }
}

function getCurrentChanges(scope, changes, lastInfo, object, scanned, instanceChanges){
    for(var currentKey in object){
        getCurrentChange(scope, changes, lastInfo, object, currentKey, scanned, instanceChanges);
    }
}

function getObjectChanges(scope, object, scanned){
    var lastInfo = getInstanceInfo(scope, object),
        newKeys,
        removedKeys,
        instanceChanges = [];

    if(!scanned){
        scanned = new WeakSet();
    }

    if(scanned.has(object)){
        return;
    }

    scanned.add(object);

    var isNew = lastInfo.occurances === false && object !== scope.state;

    if(isNew){
        lastInfo.occurances = 0;
    }

    var changes = [];
    getRemovedChanges(scope, changes, lastInfo, object);
    getCurrentChanges(scope, changes, lastInfo, object, scanned, instanceChanges);

    if(isNew){
        instanceChanges.push([lastInfo.id, object]);
    }

    return {
        instanceChanges: instanceChanges,
        changes: changes
    };
}

function changes(){
    var scope = this,
        result = getObjectChanges(scope, scope.state);

    var instanceChanges = Object.keys(scope.instances).reduce(function(changes, key){
        var instance = scope.instances[key],
            itemInfo = scope.trackedMap.get(instance);

        if(instance !== scope.state && !itemInfo.occurances){
            scope.trackedMap.delete(instance);
            delete scope.instances[itemInfo.id];
            changes.push([itemInfo.id, 'r']);
        }

        return changes;
    }, []);

    return [result.instanceChanges.concat(instanceChanges)].concat(result.changes);
}

function getState(){
    var state = this;

    state.viscous.changes();

    return [Object.keys(state.instances).reverse().map(function(key){
        return [key, state.instances[key]];
    })];
}

function applyRootChange(scope, newState){
    for(var key in scope.state){
        if(!key in newState){
            delete scope.state[key];
        }
    }
    for(var key in newState){
        scope.state[key] = newState[key];
    }
}

function apply(changes){
    var scope = this,
        instanceChanges = changes[0];

    instanceChanges.forEach(function(instanceChange){
        if(instanceChange[1] === 'r'){
            delete scope.instances[instanceChange[0]];
        }else{
            if(scope.instances[instanceChange[0]] === scope.state){
                applyRootChange(scope, instanceChange[1]);
            }else{
                scope.instances[instanceChange[0]] = instanceChange[1];
            }
        }
    });

    for(var i = 1; i < changes.length; i++){
        var change = changes[i];

        if(change[2] === 'r'){
            delete scope.instances[change[0]][change[1]];
        }else{
            var value = change[3];

            if(Array.isArray(change[3])){
                value = scope.instances[change[3]];
            }

            scope.instances[change[0]][change[1]] = value;
        }
    }
}

function getInstanceById(id){
    return this.instances[id];
}

function viscous(state){
    var viscous = {};

    var scope = {
        viscous, viscous,
        currentId: 0,
        state: state || {},
        trackedMap: new WeakMap(),
        instances: {}
    };

    scope.getId = getId.bind(scope);

    viscous.changes = changes.bind(scope);
    viscous.apply = apply.bind(scope);
    viscous.state = getState.bind(scope);
    viscous.getId = getInstanceId.bind(scope);
    viscous.getInstance = getInstanceById.bind(scope);

    viscous.changes();

    return viscous;
}

module.exports = viscous;

},{"same-value":14}],14:[function(require,module,exports){
module.exports = function isSame(a, b){
    if(a === b){
        return true;
    }

    if(
        typeof a !== typeof b ||
        typeof a === 'object' &&
        !(a instanceof Date && b instanceof Date)
    ){
        return false;
    }

    return String(a) === String(b);
};
},{}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92NS4zLjAvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y1LjMuMC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiY3JlYXRlS2V5LmpzIiwiZXhhbXBsZS9hcHAvYXBwLmpzIiwiaW5kZXguanMiLCJub2RlX21vZHVsZXMvbWVyZ2UvbWVyZ2UuanMiLCJub2RlX21vZHVsZXMvc2h1di9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zdGF0aGFtL2lzSW5zdGFuY2UuanMiLCJub2RlX21vZHVsZXMvc3RhdGhhbS9wYXJzZS5qcyIsIm5vZGVfbW9kdWxlcy9zdGF0aGFtL3Jldml2ZS5qcyIsIm5vZGVfbW9kdWxlcy9zdGF0aGFtL3N0YXRoYW0uanMiLCJub2RlX21vZHVsZXMvc3RhdGhhbS9zdHJpbmdpZnkuanMiLCIuLi92aXNjb3VzL2luZGV4LmpzIiwiLi4vdmlzY291cy9ub2RlX21vZHVsZXMvc2FtZS12YWx1ZS9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDNUNBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiZnVuY3Rpb24gZXNjYXBlSGV4KGhleCl7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoaGV4KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlS2V5KG51bWJlcil7XG4gICAgaWYobnVtYmVyICsgMHhFMDAxID4gMHhGRkZGKXtcbiAgICAgICAgdGhyb3cgXCJUb28gbWFueSByZWZlcmVuY2VzLiBMb2cgYW4gaXNzdWUgb24gZ2lodWIgYW4gaSdsbCBhZGQgYW4gb3JkZXIgb2YgbWFnbmF0dWRlIHRvIHRoZSBrZXlzLlwiO1xuICAgIH1cbiAgICByZXR1cm4gZXNjYXBlSGV4KG51bWJlciArIDB4RTAwMSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlS2V5OyIsInZhciBsZW56ZSA9IHJlcXVpcmUoJy4uLy4uLycpKHtcbiAgICBjaGFuZ2VJbnRlcnZhbDogMTYsXG4gICAgc2VuZDogZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIHNlbGYucG9zdE1lc3NhZ2UoZGF0YSk7XG4gICAgfSxcbiAgICByZWNlaXZlOiBmdW5jdGlvbihjYWxsYmFjayl7XG4gICAgICAgIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uKG1lc3NhZ2Upe1xuICAgICAgICAgICAgY2FsbGJhY2sobWVzc2FnZS5kYXRhKTtcbiAgICAgICAgfSk7XG4gICAgfVxufSk7XG5cbnZhciBzdGF0ZSA9IGxlbnplLnN0YXRlO1xuXG5zdGF0ZS5zZXRIZWFkaW5nID0gZnVuY3Rpb24odmFsdWUpe1xuICAgIHN0YXRlLmhlYWRpbmcgPSAnSGVsbG8gJyArICh2YWx1ZSB8fCAnV29ybGQnKTtcbn07XG5zdGF0ZS5zZXRIZWFkaW5nKCk7XG5cbnN0YXRlLm9ianMgPSBbXTtcbnN0YXRlLnggPSB7fTtcbnN0YXRlLnkgPSBzdGF0ZS54O1xuXG5zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgc3RhdGUueiA9IHN0YXRlLng7XG59LCAxMDAwKTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgdmlzY291cyA9IHJlcXVpcmUoJ3Zpc2NvdXMnKSxcbiAgICBzaHV2ID0gcmVxdWlyZSgnc2h1dicpLFxuICAgIHN0YXRoYW0gPSByZXF1aXJlKCdzdGF0aGFtJyksXG4gICAgY3JlYXRlS2V5ID0gcmVxdWlyZSgnLi9jcmVhdGVLZXknKSxcbiAgICBrZXlLZXkgPSBjcmVhdGVLZXkoLTIpLFxuICAgIG1lcmdlID0gcmVxdWlyZSgnbWVyZ2UnKTtcblxudmFyIElOVk9LRSA9ICdpbnZva2UnO1xudmFyIENIQU5HRVMgPSAnY2hhbmdlcyc7XG52YXIgQ09OTkVDVCA9ICdjb25uZWN0JztcbnZhciBTVEFURSA9ICdzdGF0ZSc7XG5cbmZ1bmN0aW9uIGZ1bmN0aW9uVHJhbnNmb3JtKHNjb3BlLCBrZXksIHZhbHVlKXtcbiAgICBpZih0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpe1xuICAgICAgICB2YXIgcmVzdWx0ID0geydMRU5aRV9GVU5DVElPTic6c2NvcGUudmlzY291cy5nZXRJZCh2YWx1ZSl9O1xuICAgICAgICBmb3IodmFyIGtleSBpbiB2YWx1ZSl7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlW2tleV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgaWYoQXJyYXkuaXNBcnJheSh2YWx1ZSkpe1xuICAgICAgICB2YXIgcmVzdWx0ID0geydMRU5aRV9BUlJBWSc6c2NvcGUudmlzY291cy5nZXRJZCh2YWx1ZSl9O1xuICAgICAgICBmb3IodmFyIGtleSBpbiB2YWx1ZSl7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlW2tleV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDaGFuZ2VzKHNjb3BlLCBjaGFuZ2VzKXtcbiAgICByZXR1cm4gc3RhdGhhbS5zdHJpbmdpZnkoY2hhbmdlcywgc2h1dihmdW5jdGlvblRyYW5zZm9ybSwgc2NvcGUpKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VNZXNzYWdlKGRhdGEpe1xuICAgIHZhciBtZXNzYWdlID0gZGF0YS5tYXRjaCgvXihcXHcrPylcXDooLiopLyk7XG5cbiAgICBpZihtZXNzYWdlKXtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IG1lc3NhZ2VbMV0sXG4gICAgICAgICAgICBkYXRhOiBtZXNzYWdlWzJdXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlY2VpdmUoc2NvcGUsIGRhdGEpe1xuICAgIHZhciBtZXNzYWdlID0gcGFyc2VNZXNzYWdlKGRhdGEpO1xuXG4gICAgaWYoIW1lc3NhZ2Upe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYobWVzc2FnZS50eXBlID09PSBJTlZPS0Upe1xuICAgICAgICBzY29wZS5oYW5kbGVGdW5jdGlvbi5hcHBseShudWxsLCBzdGF0aGFtLnBhcnNlKG1lc3NhZ2UuZGF0YSkpO1xuICAgIH1cblxuICAgIGlmKG1lc3NhZ2UudHlwZSA9PT0gQ09OTkVDVCl7XG4gICAgICAgIHNjb3BlLnNlbmQoQ09OTkVDVCwgc2NvcGUudmlzY291cy5zdGF0ZSgpKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGluZmxhdGVDaGFuZ2VzKHNjb3BlLCBkYXRhKXtcbiAgICB2YXIgY2hhbmdlcyA9IHN0YXRoYW0ucGFyc2UoZGF0YSwgZnVuY3Rpb24oa2V5LCB2YWx1ZSl7XG4gICAgICAgIGlmKCF2YWx1ZSB8fCAhKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKSl7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZignTEVOWkVfQVJSQVknIGluIHZhbHVlKXtcbiAgICAgICAgICAgIGRlbGV0ZSB2YWx1ZVsnTEVOWkVfQVJSQVknXTtcbiAgICAgICAgICAgIHZhciByZXN1bHRBcnJheSA9IFtdO1xuICAgICAgICAgICAgZm9yKHZhciBrZXkgaW4gdmFsdWUpe1xuICAgICAgICAgICAgICAgIHJlc3VsdEFycmF5W2tleV0gPSB2YWx1ZVtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdEFycmF5O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoJ0xFTlpFX0ZVTkNUSU9OJyBpbiB2YWx1ZSl7XG4gICAgICAgICAgICB2YXIgaWQgPSB2YWx1ZVsnTEVOWkVfRlVOQ1RJT04nXTtcbiAgICAgICAgICAgIGRlbGV0ZSB2YWx1ZVsnTEVOWkVfRlVOQ1RJT04nXTtcbiAgICAgICAgICAgIHZhciByZXN1bHRGdW5jdGlvbiA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgc2NvcGUuaW52b2tlLmFwcGx5KG51bGwsIFtpZF0uY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBmb3IodmFyIGtleSBpbiB2YWx1ZSl7XG4gICAgICAgICAgICAgICAgcmVzdWx0RnVuY3Rpb25ba2V5XSA9IHZhbHVlW2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0RnVuY3Rpb247XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSk7XG5cbiAgICBjaGFuZ2VzWzBdID0gY2hhbmdlc1swXS5tYXAoZnVuY3Rpb24oaW5zdGFuY2VDaGFuZ2Upe1xuICAgICAgICBpZihpbnN0YW5jZUNoYW5nZVsxXSAhPT0gJ3InKXtcblxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGluc3RhbmNlQ2hhbmdlO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGNoYW5nZXM7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZShzY29wZSl7XG4gICAgdmFyIGNoYW5nZXMgPSBzY29wZS52aXNjb3VzLmNoYW5nZXMoKTtcblxuICAgIGlmKGNoYW5nZXMubGVuZ3RoID4gMSl7XG4gICAgICAgIHNjb3BlLmxlbnplLmVtaXQoJ2NoYW5nZScsIGNoYW5nZXMpO1xuXG4gICAgICAgIGlmKHNjb3BlLnNlbmQpe1xuICAgICAgICAgICAgc2NvcGUuc2VuZChDSEFOR0VTLCBjaGFuZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlRnVuY3Rpb24oc2NvcGUsIGlkKXtcbiAgICBzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKGlkKS5hcHBseSh0aGlzLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpKTtcbn1cblxuZnVuY3Rpb24gc2VuZChzY29wZSwgc2VuZCwgdHlwZSwgZGF0YSl7XG4gICAgaWYodHlwZSA9PT0gQ0hBTkdFUyl7XG4gICAgICAgIHNlbmQoQ0hBTkdFUyArICc6JyArIGNyZWF0ZUNoYW5nZXMoc2NvcGUsIGRhdGEpKTtcbiAgICB9XG4gICAgaWYodHlwZSA9PT0gQ09OTkVDVCl7XG4gICAgICAgIHNlbmQoU1RBVEUgKyAnOicgKyBjcmVhdGVDaGFuZ2VzKHNjb3BlLCBkYXRhKSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzZW5kSW52b2tlKHNjb3BlLCBzZW5kSW52b2tlKXtcbiAgICBzZW5kSW52b2tlKElOVk9LRSArICc6JyArIHN0YXRoYW0uc3RyaW5naWZ5KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMikpKTtcbn1cblxuZnVuY3Rpb24gaW5pdFNjb3BlKHNldHRpbmdzKXtcbiAgICBpZighc2V0dGluZ3Mpe1xuICAgICAgICBzZXR0aW5ncyA9IHt9O1xuICAgIH1cblxuICAgIHZhciBzdGF0ZSA9IHt9O1xuXG4gICAgdmFyIGxlbnplID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICAgIHZhciBzY29wZSA9IHtcbiAgICAgICAgdmlzY291czogdmlzY291cyhzdGF0ZSksXG4gICAgICAgIGZ1bmN0aW9uczoge30sXG4gICAgICAgIGluc3RhbmNlSWRzOiAwLFxuICAgICAgICBsZW56ZTogbGVuemVcbiAgICB9O1xuXG4gICAgbGVuemUudXBkYXRlID0gc2h1dih1cGRhdGUsIHNjb3BlKTtcbiAgICBsZW56ZS5zdGF0ZSA9IHN0YXRlO1xuXG4gICAgcmV0dXJuIHNjb3BlO1xufVxuXG5mdW5jdGlvbiBpbml0KHNldHRpbmdzKXtcbiAgICB2YXIgc2NvcGUgPSBpbml0U2NvcGUoc2V0dGluZ3MpO1xuXG4gICAgc2NvcGUuaGFuZGxlRnVuY3Rpb24gPSBzaHV2KGhhbmRsZUZ1bmN0aW9uLCBzY29wZSk7XG4gICAgc2NvcGUuc2VuZCA9IHNodXYoc2VuZCwgc2NvcGUsIHNldHRpbmdzLnNlbmQpO1xuICAgIHNldHRpbmdzLnJlY2VpdmUoc2h1dihyZWNlaXZlLCBzY29wZSkpO1xuXG4gICAgc2V0SW50ZXJ2YWwoc2NvcGUubGVuemUudXBkYXRlLCBzZXR0aW5ncy5jaGFuZ2VJbnRlcnZhbCB8fCAxMDApO1xuXG4gICAgcmV0dXJuIHNjb3BlLmxlbnplO1xufVxuXG5mdW5jdGlvbiByZXBsaWNhbnQoc2V0dGluZ3Mpe1xuICAgIHZhciBzY29wZSA9IGluaXRTY29wZSgpO1xuXG4gICAgc2NvcGUuaW5zdGFuY2VIYXNoID0ge307XG5cbiAgICBzZXR0aW5ncy5yZWNlaXZlKGZ1bmN0aW9uKGRhdGEpe1xuICAgICAgICBpZighc2NvcGUucmVhZHkpe1xuICAgICAgICAgICAgc2NvcGUucmVhZHkgPSB0cnVlO1xuICAgICAgICAgICAgc2NvcGUubGVuemUuZW1pdCgncmVhZHknKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBtZXNzYWdlID0gcGFyc2VNZXNzYWdlKGRhdGEpO1xuXG4gICAgICAgIGlmKCFtZXNzYWdlKXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKG1lc3NhZ2UudHlwZSA9PT0gU1RBVEUpe1xuICAgICAgICAgICAgc2NvcGUudmlzY291cy5hcHBseShpbmZsYXRlQ2hhbmdlcyhzY29wZSwgbWVzc2FnZS5kYXRhKSk7XG4gICAgICAgICAgICB1cGRhdGUoc2NvcGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYobWVzc2FnZS50eXBlID09PSBDSEFOR0VTKXtcbiAgICAgICAgICAgIHNjb3BlLnZpc2NvdXMuYXBwbHkoaW5mbGF0ZUNoYW5nZXMoc2NvcGUsIG1lc3NhZ2UuZGF0YSkpO1xuICAgICAgICAgICAgdXBkYXRlKHNjb3BlKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgc2NvcGUuaW52b2tlID0gc2h1dihzZW5kSW52b2tlLCBzY29wZSwgc2V0dGluZ3Muc2VuZCk7XG5cbiAgICBzZXR0aW5ncy5zZW5kKENPTk5FQ1QgKyAnOicpO1xuXG4gICAgcmV0dXJuIHNjb3BlLmxlbnplXG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdDtcbm1vZHVsZS5leHBvcnRzLnJlcGxpY2FudCA9IHJlcGxpY2FudDtcbiIsIi8qIVxyXG4gKiBAbmFtZSBKYXZhU2NyaXB0L05vZGVKUyBNZXJnZSB2MS4yLjBcclxuICogQGF1dGhvciB5ZWlrb3NcclxuICogQHJlcG9zaXRvcnkgaHR0cHM6Ly9naXRodWIuY29tL3llaWtvcy9qcy5tZXJnZVxyXG5cclxuICogQ29weXJpZ2h0IDIwMTQgeWVpa29zIC0gTUlUIGxpY2Vuc2VcclxuICogaHR0cHM6Ly9yYXcuZ2l0aHViLmNvbS95ZWlrb3MvanMubWVyZ2UvbWFzdGVyL0xJQ0VOU0VcclxuICovXHJcblxyXG47KGZ1bmN0aW9uKGlzTm9kZSkge1xyXG5cclxuXHQvKipcclxuXHQgKiBNZXJnZSBvbmUgb3IgbW9yZSBvYmplY3RzIFxyXG5cdCAqIEBwYXJhbSBib29sPyBjbG9uZVxyXG5cdCAqIEBwYXJhbSBtaXhlZCwuLi4gYXJndW1lbnRzXHJcblx0ICogQHJldHVybiBvYmplY3RcclxuXHQgKi9cclxuXHJcblx0dmFyIFB1YmxpYyA9IGZ1bmN0aW9uKGNsb25lKSB7XHJcblxyXG5cdFx0cmV0dXJuIG1lcmdlKGNsb25lID09PSB0cnVlLCBmYWxzZSwgYXJndW1lbnRzKTtcclxuXHJcblx0fSwgcHVibGljTmFtZSA9ICdtZXJnZSc7XHJcblxyXG5cdC8qKlxyXG5cdCAqIE1lcmdlIHR3byBvciBtb3JlIG9iamVjdHMgcmVjdXJzaXZlbHkgXHJcblx0ICogQHBhcmFtIGJvb2w/IGNsb25lXHJcblx0ICogQHBhcmFtIG1peGVkLC4uLiBhcmd1bWVudHNcclxuXHQgKiBAcmV0dXJuIG9iamVjdFxyXG5cdCAqL1xyXG5cclxuXHRQdWJsaWMucmVjdXJzaXZlID0gZnVuY3Rpb24oY2xvbmUpIHtcclxuXHJcblx0XHRyZXR1cm4gbWVyZ2UoY2xvbmUgPT09IHRydWUsIHRydWUsIGFyZ3VtZW50cyk7XHJcblxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENsb25lIHRoZSBpbnB1dCByZW1vdmluZyBhbnkgcmVmZXJlbmNlXHJcblx0ICogQHBhcmFtIG1peGVkIGlucHV0XHJcblx0ICogQHJldHVybiBtaXhlZFxyXG5cdCAqL1xyXG5cclxuXHRQdWJsaWMuY2xvbmUgPSBmdW5jdGlvbihpbnB1dCkge1xyXG5cclxuXHRcdHZhciBvdXRwdXQgPSBpbnB1dCxcclxuXHRcdFx0dHlwZSA9IHR5cGVPZihpbnB1dCksXHJcblx0XHRcdGluZGV4LCBzaXplO1xyXG5cclxuXHRcdGlmICh0eXBlID09PSAnYXJyYXknKSB7XHJcblxyXG5cdFx0XHRvdXRwdXQgPSBbXTtcclxuXHRcdFx0c2l6ZSA9IGlucHV0Lmxlbmd0aDtcclxuXHJcblx0XHRcdGZvciAoaW5kZXg9MDtpbmRleDxzaXplOysraW5kZXgpXHJcblxyXG5cdFx0XHRcdG91dHB1dFtpbmRleF0gPSBQdWJsaWMuY2xvbmUoaW5wdXRbaW5kZXhdKTtcclxuXHJcblx0XHR9IGVsc2UgaWYgKHR5cGUgPT09ICdvYmplY3QnKSB7XHJcblxyXG5cdFx0XHRvdXRwdXQgPSB7fTtcclxuXHJcblx0XHRcdGZvciAoaW5kZXggaW4gaW5wdXQpXHJcblxyXG5cdFx0XHRcdG91dHB1dFtpbmRleF0gPSBQdWJsaWMuY2xvbmUoaW5wdXRbaW5kZXhdKTtcclxuXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG91dHB1dDtcclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogTWVyZ2UgdHdvIG9iamVjdHMgcmVjdXJzaXZlbHlcclxuXHQgKiBAcGFyYW0gbWl4ZWQgaW5wdXRcclxuXHQgKiBAcGFyYW0gbWl4ZWQgZXh0ZW5kXHJcblx0ICogQHJldHVybiBtaXhlZFxyXG5cdCAqL1xyXG5cclxuXHRmdW5jdGlvbiBtZXJnZV9yZWN1cnNpdmUoYmFzZSwgZXh0ZW5kKSB7XHJcblxyXG5cdFx0aWYgKHR5cGVPZihiYXNlKSAhPT0gJ29iamVjdCcpXHJcblxyXG5cdFx0XHRyZXR1cm4gZXh0ZW5kO1xyXG5cclxuXHRcdGZvciAodmFyIGtleSBpbiBleHRlbmQpIHtcclxuXHJcblx0XHRcdGlmICh0eXBlT2YoYmFzZVtrZXldKSA9PT0gJ29iamVjdCcgJiYgdHlwZU9mKGV4dGVuZFtrZXldKSA9PT0gJ29iamVjdCcpIHtcclxuXHJcblx0XHRcdFx0YmFzZVtrZXldID0gbWVyZ2VfcmVjdXJzaXZlKGJhc2Vba2V5XSwgZXh0ZW5kW2tleV0pO1xyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdFx0YmFzZVtrZXldID0gZXh0ZW5kW2tleV07XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBiYXNlO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIE1lcmdlIHR3byBvciBtb3JlIG9iamVjdHNcclxuXHQgKiBAcGFyYW0gYm9vbCBjbG9uZVxyXG5cdCAqIEBwYXJhbSBib29sIHJlY3Vyc2l2ZVxyXG5cdCAqIEBwYXJhbSBhcnJheSBhcmd2XHJcblx0ICogQHJldHVybiBvYmplY3RcclxuXHQgKi9cclxuXHJcblx0ZnVuY3Rpb24gbWVyZ2UoY2xvbmUsIHJlY3Vyc2l2ZSwgYXJndikge1xyXG5cclxuXHRcdHZhciByZXN1bHQgPSBhcmd2WzBdLFxyXG5cdFx0XHRzaXplID0gYXJndi5sZW5ndGg7XHJcblxyXG5cdFx0aWYgKGNsb25lIHx8IHR5cGVPZihyZXN1bHQpICE9PSAnb2JqZWN0JylcclxuXHJcblx0XHRcdHJlc3VsdCA9IHt9O1xyXG5cclxuXHRcdGZvciAodmFyIGluZGV4PTA7aW5kZXg8c2l6ZTsrK2luZGV4KSB7XHJcblxyXG5cdFx0XHR2YXIgaXRlbSA9IGFyZ3ZbaW5kZXhdLFxyXG5cclxuXHRcdFx0XHR0eXBlID0gdHlwZU9mKGl0ZW0pO1xyXG5cclxuXHRcdFx0aWYgKHR5cGUgIT09ICdvYmplY3QnKSBjb250aW51ZTtcclxuXHJcblx0XHRcdGZvciAodmFyIGtleSBpbiBpdGVtKSB7XHJcblxyXG5cdFx0XHRcdHZhciBzaXRlbSA9IGNsb25lID8gUHVibGljLmNsb25lKGl0ZW1ba2V5XSkgOiBpdGVtW2tleV07XHJcblxyXG5cdFx0XHRcdGlmIChyZWN1cnNpdmUpIHtcclxuXHJcblx0XHRcdFx0XHRyZXN1bHRba2V5XSA9IG1lcmdlX3JlY3Vyc2l2ZShyZXN1bHRba2V5XSwgc2l0ZW0pO1xyXG5cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0XHRcdHJlc3VsdFtrZXldID0gc2l0ZW07XHJcblxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHJlc3VsdDtcclxuXHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgdHlwZSBvZiB2YXJpYWJsZVxyXG5cdCAqIEBwYXJhbSBtaXhlZCBpbnB1dFxyXG5cdCAqIEByZXR1cm4gc3RyaW5nXHJcblx0ICpcclxuXHQgKiBAc2VlIGh0dHA6Ly9qc3BlcmYuY29tL3R5cGVvZnZhclxyXG5cdCAqL1xyXG5cclxuXHRmdW5jdGlvbiB0eXBlT2YoaW5wdXQpIHtcclxuXHJcblx0XHRyZXR1cm4gKHt9KS50b1N0cmluZy5jYWxsKGlucHV0KS5zbGljZSg4LCAtMSkudG9Mb3dlckNhc2UoKTtcclxuXHJcblx0fVxyXG5cclxuXHRpZiAoaXNOb2RlKSB7XHJcblxyXG5cdFx0bW9kdWxlLmV4cG9ydHMgPSBQdWJsaWM7XHJcblxyXG5cdH0gZWxzZSB7XHJcblxyXG5cdFx0d2luZG93W3B1YmxpY05hbWVdID0gUHVibGljO1xyXG5cclxuXHR9XHJcblxyXG59KSh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cyk7IiwidmFyIHBsYWNlaG9sZGVyID0ge30sXG4gICAgZW5kT2ZBcmdzID0ge30sXG4gICAgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbC5iaW5kKEFycmF5LnByb3RvdHlwZS5zbGljZSk7XG5cbmZ1bmN0aW9uIHNodXYoZm4pe1xuICAgIHZhciBvdXRlckFyZ3MgPSBzbGljZShhcmd1bWVudHMsIDEpO1xuXG4gICAgaWYodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBvciBub24tZnVuY3Rpb24gcGFzc2VkIHRvIHNodXYnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIGNvbnRleHQgPSB0aGlzLFxuICAgICAgICAgICAgaW5uZXJBcmdzID0gc2xpY2UoYXJndW1lbnRzKSxcbiAgICAgICAgICAgIGZpbmFsQXJncyA9IFtdLFxuICAgICAgICAgICAgYXBwZW5kID0gdHJ1ZTtcblxuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgb3V0ZXJBcmdzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIHZhciBvdXRlckFyZyA9IG91dGVyQXJnc1tpXTtcblxuICAgICAgICAgICAgaWYob3V0ZXJBcmcgPT09IGVuZE9mQXJncyl7XG4gICAgICAgICAgICAgICAgYXBwZW5kID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKG91dGVyQXJnID09PSBwbGFjZWhvbGRlcil7XG4gICAgICAgICAgICAgICAgZmluYWxBcmdzLnB1c2goaW5uZXJBcmdzLnNoaWZ0KCkpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmaW5hbEFyZ3MucHVzaChvdXRlckFyZyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihhcHBlbmQpe1xuICAgICAgICAgICAgZmluYWxBcmdzID0gZmluYWxBcmdzLmNvbmNhdChpbm5lckFyZ3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZuLmFwcGx5KGNvbnRleHQsIGZpbmFsQXJncyk7XG4gICAgfTtcbn1cblxuc2h1di5fID0gcGxhY2Vob2xkZXI7XG5zaHV2LiQgPSBlbmRPZkFyZ3M7XG5cbm1vZHVsZS5leHBvcnRzID0gc2h1djsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzSW5zdGFuY2UodmFsdWUpe1xuICAgIHJldHVybiB2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJztcbn07IiwidmFyIHJldml2ZSA9IHJlcXVpcmUoJy4vcmV2aXZlJyk7XG5cbmZ1bmN0aW9uIHBhcnNlKGpzb24sIHJldml2ZXIpe1xuICAgIHJldHVybiByZXZpdmUoSlNPTi5wYXJzZShqc29uLCByZXZpdmVyKSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcGFyc2U7IiwidmFyIGNyZWF0ZUtleSA9IHJlcXVpcmUoJy4vY3JlYXRlS2V5JyksXG4gICAga2V5S2V5ID0gY3JlYXRlS2V5KC0xKSxcbiAgICBpc0luc3RhbmNlID0gcmVxdWlyZSgnLi9pc0luc3RhbmNlJyk7XG5cbmZ1bmN0aW9uIHJldml2ZShpbnB1dCl7XG4gICAgdmFyIG9iamVjdHMgPSB7fSxcbiAgICAgICAgc2Nhbm5lZE9iamVjdHMgPSBbXSxcbiAgICAgICAgc2Nhbm5lZE91dHB1dHMgPSBbXTtcblxuICAgIGZ1bmN0aW9uIHNjYW4oaW5wdXQpe1xuXG4gICAgICAgIHZhciBvdXRwdXQgPSBpbnB1dDtcblxuICAgICAgICBpZighaXNJbnN0YW5jZShpbnB1dCkpe1xuICAgICAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpbnB1dEluZGV4ID0gc2Nhbm5lZE9iamVjdHMuaW5kZXhPZihpbnB1dCk7XG5cbiAgICAgICAgaWYofmlucHV0SW5kZXgpe1xuICAgICAgICAgICAgcmV0dXJuIHNjYW5uZWRPdXRwdXRzW2lucHV0SW5kZXhdO1xuICAgICAgICB9XG5cbiAgICAgICAgb3V0cHV0ID0gaW5wdXQgJiYgaW5wdXQgaW5zdGFuY2VvZiBBcnJheSA/IFtdIDogdHlwZW9mIGlucHV0ID09PSAnZnVuY3Rpb24nID8gaW5wdXQgOiB7fTtcblxuICAgICAgICBzY2FubmVkT2JqZWN0cy5wdXNoKGlucHV0KTtcbiAgICAgICAgc2Nhbm5lZE91dHB1dHMucHVzaChvdXRwdXQpO1xuXG4gICAgICAgIGlmKGtleUtleSBpbiBpbnB1dCl7XG4gICAgICAgICAgICBvYmplY3RzW2lucHV0W2tleUtleV1dID0gb3V0cHV0O1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yKHZhciBrZXkgaW4gaW5wdXQpe1xuICAgICAgICAgICAgdmFyIHZhbHVlID0gaW5wdXRba2V5XTtcblxuICAgICAgICAgICAgaWYoa2V5ID09PSBrZXlLZXkpe1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihpc0luc3RhbmNlKHZhbHVlKSl7XG4gICAgICAgICAgICAgICAgb3V0cHV0W2tleV0gPSBzY2FuKHZhbHVlKTtcbiAgICAgICAgICAgIH1lbHNlIGlmKFxuICAgICAgICAgICAgICAgIHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiZcbiAgICAgICAgICAgICAgICB2YWx1ZS5sZW5ndGggPT09IDEgJiZcbiAgICAgICAgICAgICAgICB2YWx1ZS5jaGFyQ29kZUF0KDApID4ga2V5S2V5LmNoYXJDb2RlQXQoMCkgJiZcbiAgICAgICAgICAgICAgICB2YWx1ZSBpbiBvYmplY3RzXG4gICAgICAgICAgICApe1xuICAgICAgICAgICAgICAgIG91dHB1dFtrZXldID0gb2JqZWN0c1t2YWx1ZV07XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICBvdXRwdXRba2V5XSA9IGlucHV0W2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH1cblxuICAgIGlmKCFpbnB1dCB8fCB0eXBlb2YgaW5wdXQgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuIGlucHV0O1xuICAgIH1cblxuICAgIHJldHVybiBzY2FuKGlucHV0KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByZXZpdmU7IiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgc3RyaW5naWZ5OiByZXF1aXJlKCcuL3N0cmluZ2lmeScpLFxuICAgIHBhcnNlOiByZXF1aXJlKCcuL3BhcnNlJyksXG4gICAgcmV2aXZlOiByZXF1aXJlKCcuL3Jldml2ZScpXG59OyIsInZhciBjcmVhdGVLZXkgPSByZXF1aXJlKCcuL2NyZWF0ZUtleScpLFxuICAgIGtleUtleSA9IGNyZWF0ZUtleSgtMSksXG4gICAgaXNJbnN0YW5jZSA9IHJlcXVpcmUoJy4vaXNJbnN0YW5jZScpO1xuXG5mdW5jdGlvbiB0b0pzb25WYWx1ZSh2YWx1ZSl7XG4gICAgaWYodmFsdWUgIT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKXtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHZhbHVlIGluc3RhbmNlb2YgQXJyYXkgPyBbXSA6IHt9LFxuICAgICAgICAgICAgb3V0cHV0ID0gdmFsdWU7XG4gICAgICAgIGlmKCd0b0pTT04nIGluIHZhbHVlKXtcbiAgICAgICAgICAgIG91dHB1dCA9IHZhbHVlLnRvSlNPTigpO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIga2V5IGluIG91dHB1dCl7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IG91dHB1dFtrZXldO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnkoaW5wdXQsIHJlcGxhY2VyLCBzcGFjZXIpe1xuICAgIHZhciBvYmplY3RzID0gW10sXG4gICAgICAgIG91dHB1dE9iamVjdHMgPSBbXSxcbiAgICAgICAgcmVmcyA9IFtdO1xuXG4gICAgZnVuY3Rpb24gc2NhbihpbnB1dCl7XG4gICAgICAgIGlmKCFpc0luc3RhbmNlKGlucHV0KSl7XG4gICAgICAgICAgICByZXR1cm4gaW5wdXQ7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb3V0cHV0LFxuICAgICAgICAgICAgaW5kZXggPSBvYmplY3RzLmluZGV4T2YoaW5wdXQpO1xuXG4gICAgICAgIGlmKGluZGV4ID49IDApe1xuICAgICAgICAgICAgb3V0cHV0T2JqZWN0c1tpbmRleF1ba2V5S2V5XSA9IHJlZnNbaW5kZXhdXG4gICAgICAgICAgICByZXR1cm4gcmVmc1tpbmRleF07XG4gICAgICAgIH1cblxuICAgICAgICBpbmRleCA9IG9iamVjdHMubGVuZ3RoO1xuICAgICAgICBvYmplY3RzW2luZGV4XSA9IGlucHV0O1xuICAgICAgICBvdXRwdXQgPSB0b0pzb25WYWx1ZShpbnB1dCk7XG4gICAgICAgIG91dHB1dE9iamVjdHNbaW5kZXhdID0gb3V0cHV0O1xuICAgICAgICByZWZzW2luZGV4XSA9IGNyZWF0ZUtleShpbmRleCk7XG5cbiAgICAgICAgZm9yKHZhciBrZXkgaW4gb3V0cHV0KXtcbiAgICAgICAgICAgIG91dHB1dFtrZXldID0gc2NhbihvdXRwdXRba2V5XSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShzY2FuKGlucHV0KSwgcmVwbGFjZXIsIHNwYWNlcik7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3RyaW5naWZ5OyIsInZhciBzYW1lID0gcmVxdWlyZSgnc2FtZS12YWx1ZScpO1xuXG5mdW5jdGlvbiBpc0luc3RhbmNlKHZhbHVlKXtcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgICByZXR1cm4gdmFsdWUgJiYgdHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gZ2V0SWQoKXtcbiAgICByZXR1cm4gKHRoaXMuY3VycmVudElkKyspLnRvU3RyaW5nKDM2KTtcbn1cblxuZnVuY3Rpb24gb2JqZWN0UmVtb3ZlZENoYW5nZXMoc2NvcGUsIG9iamVjdCl7XG4gICAgdmFyIGl0ZW1JbmZvID0gc2NvcGUudHJhY2tlZE1hcC5nZXQob2JqZWN0KTtcblxuICAgIGl0ZW1JbmZvLm9jY3VyYW5jZXMtLTtcblxuICAgIGZvcihrZXkgaW4gb2JqZWN0KXtcbiAgICAgICAgaWYoaXNJbnN0YW5jZShvYmplY3Rba2V5XSkpe1xuICAgICAgICAgICAgb2JqZWN0UmVtb3ZlZENoYW5nZXMoc2NvcGUsIG9iamVjdFtrZXldKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0SW5zdGFuY2VJbmZvKHNjb3BlLCB2YWx1ZSl7XG4gICAgaWYoIWlzSW5zdGFuY2UodmFsdWUpKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBsYXN0SW5mbyA9IHNjb3BlLnRyYWNrZWRNYXAuZ2V0KHZhbHVlKTtcblxuICAgIGlmKCFsYXN0SW5mbyl7XG4gICAgICAgIGxhc3RJbmZvID0ge1xuICAgICAgICAgICAgaWQ6IHNjb3BlLmdldElkKCksXG4gICAgICAgICAgICBpbnN0YW5jZTogdmFsdWUsXG4gICAgICAgICAgICBsYXN0U3RhdGU6IHt9LFxuICAgICAgICAgICAgb2NjdXJhbmNlczogZmFsc2VcbiAgICAgICAgfTtcbiAgICAgICAgc2NvcGUuaW5zdGFuY2VzW2xhc3RJbmZvLmlkXSA9IHZhbHVlO1xuICAgICAgICBzY29wZS50cmFja2VkTWFwLnNldCh2YWx1ZSwgbGFzdEluZm8pO1xuICAgIH1cblxuICAgIHJldHVybiBsYXN0SW5mbztcbn1cblxuZnVuY3Rpb24gZ2V0SW5zdGFuY2VJZCh2YWx1ZSl7XG4gICAgdmFyIGluZm8gPSBnZXRJbnN0YW5jZUluZm8odGhpcywgdmFsdWUpO1xuXG4gICAgcmV0dXJuIGluZm8gJiYgaW5mby5pZDtcbn1cblxuZnVuY3Rpb24gZ2V0UmVtb3ZlZENoYW5nZShzY29wZSwgY2hhbmdlcywgbGFzdEluZm8sIG9iamVjdCwgb2xkS2V5KXtcbiAgICBpZighKG9sZEtleSBpbiBvYmplY3QpKXtcbiAgICAgICAgdmFyIG9sZFZhbHVlID0gbGFzdEluZm8ubGFzdFN0YXRlW29sZEtleV07XG4gICAgICAgIGNoYW5nZXMucHVzaChbbGFzdEluZm8uaWQsIG9sZEtleSwgJ3InXSk7XG5cbiAgICAgICAgaWYoaXNJbnN0YW5jZShvbGRWYWx1ZSkgJiYgc2NvcGUudHJhY2tlZE1hcC5oYXMob2xkVmFsdWUpKXtcbiAgICAgICAgICAgIG9iamVjdFJlbW92ZWRDaGFuZ2VzKHNjb3BlLCBvbGRWYWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICBkZWxldGUgbGFzdEluZm8ubGFzdFN0YXRlW29sZEtleV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRSZW1vdmVkQ2hhbmdlcyhzY29wZSwgY2hhbmdlcywgbGFzdEluZm8sIG9iamVjdCl7XG4gICAgZm9yKHZhciBvbGRLZXkgaW4gbGFzdEluZm8ubGFzdFN0YXRlKXtcbiAgICAgICAgZ2V0UmVtb3ZlZENoYW5nZShzY29wZSwgY2hhbmdlcywgbGFzdEluZm8sIG9iamVjdCwgb2xkS2V5KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldEN1cnJlbnRDaGFuZ2Uoc2NvcGUsIGNoYW5nZXMsIGxhc3RJbmZvLCBvYmplY3QsIGN1cnJlbnRLZXksIHNjYW5uZWQsIGluc3RhbmNlQ2hhbmdlcyl7XG4gICAgdmFyIHR5cGUgPSBjdXJyZW50S2V5IGluIGxhc3RJbmZvLmxhc3RTdGF0ZSA/ICdlJyA6ICdhJyxcbiAgICAgICAgb2xkVmFsdWUgPSBsYXN0SW5mby5sYXN0U3RhdGVbY3VycmVudEtleV0sXG4gICAgICAgIGN1cnJlbnRWYWx1ZSA9IG9iamVjdFtjdXJyZW50S2V5XSxcbiAgICAgICAgY2hhbmdlID0gW2xhc3RJbmZvLmlkLCBjdXJyZW50S2V5LCB0eXBlXSxcbiAgICAgICAgY2hhbmdlZCA9ICFzYW1lKG9sZFZhbHVlLCBjdXJyZW50VmFsdWUpO1xuXG4gICAgaWYoY2hhbmdlZCl7XG4gICAgICAgIGlmKGlzSW5zdGFuY2Uob2xkVmFsdWUpICYmIHNjb3BlLnRyYWNrZWRNYXAuaGFzKG9sZFZhbHVlKSl7XG4gICAgICAgICAgICBvYmplY3RSZW1vdmVkQ2hhbmdlcyhzY29wZSwgb2xkVmFsdWUpO1xuICAgICAgICB9XG4gICAgfWVsc2V7XG4gICAgICAgIC8vIFByZXZpb3VzbHkgbm8ga2V5LCBub3cga2V5LCBidXQgdmFsdWUgaXMgdW5kZWZpbmVkLlxuICAgICAgICBpZih0eXBlID09PSAnYScpe1xuICAgICAgICAgICAgY2hhbmdlcy5wdXNoKGNoYW5nZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsYXN0SW5mby5sYXN0U3RhdGVbY3VycmVudEtleV0gPSBjdXJyZW50VmFsdWU7XG5cbiAgICBpZighaXNJbnN0YW5jZShjdXJyZW50VmFsdWUpKXtcbiAgICAgICAgY2hhbmdlLnB1c2goY3VycmVudFZhbHVlKTtcbiAgICB9ZWxzZXtcbiAgICAgICAgdmFyIHZhbHVlQ2hhbmdlcyA9IGdldE9iamVjdENoYW5nZXMoc2NvcGUsIGN1cnJlbnRWYWx1ZSwgc2Nhbm5lZCksXG4gICAgICAgICAgICB2YWx1ZUluZm8gPSBzY29wZS50cmFja2VkTWFwLmdldChjdXJyZW50VmFsdWUpO1xuXG4gICAgICAgIHZhbHVlSW5mby5vY2N1cmFuY2VzKys7XG4gICAgICAgIGNoYW5nZS5wdXNoKFt2YWx1ZUluZm8uaWRdKTtcblxuICAgICAgICBpZih2YWx1ZUNoYW5nZXMpe1xuICAgICAgICAgICAgY2hhbmdlcy5wdXNoLmFwcGx5KGNoYW5nZXMsIHZhbHVlQ2hhbmdlcy5jaGFuZ2VzKTtcbiAgICAgICAgICAgIGluc3RhbmNlQ2hhbmdlcy5wdXNoLmFwcGx5KGluc3RhbmNlQ2hhbmdlcywgdmFsdWVDaGFuZ2VzLmluc3RhbmNlQ2hhbmdlcyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZihjaGFuZ2VkKXtcbiAgICAgICAgY2hhbmdlcy5wdXNoKGNoYW5nZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDdXJyZW50Q2hhbmdlcyhzY29wZSwgY2hhbmdlcywgbGFzdEluZm8sIG9iamVjdCwgc2Nhbm5lZCwgaW5zdGFuY2VDaGFuZ2VzKXtcbiAgICBmb3IodmFyIGN1cnJlbnRLZXkgaW4gb2JqZWN0KXtcbiAgICAgICAgZ2V0Q3VycmVudENoYW5nZShzY29wZSwgY2hhbmdlcywgbGFzdEluZm8sIG9iamVjdCwgY3VycmVudEtleSwgc2Nhbm5lZCwgaW5zdGFuY2VDaGFuZ2VzKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldE9iamVjdENoYW5nZXMoc2NvcGUsIG9iamVjdCwgc2Nhbm5lZCl7XG4gICAgdmFyIGxhc3RJbmZvID0gZ2V0SW5zdGFuY2VJbmZvKHNjb3BlLCBvYmplY3QpLFxuICAgICAgICBuZXdLZXlzLFxuICAgICAgICByZW1vdmVkS2V5cyxcbiAgICAgICAgaW5zdGFuY2VDaGFuZ2VzID0gW107XG5cbiAgICBpZighc2Nhbm5lZCl7XG4gICAgICAgIHNjYW5uZWQgPSBuZXcgV2Vha1NldCgpO1xuICAgIH1cblxuICAgIGlmKHNjYW5uZWQuaGFzKG9iamVjdCkpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2Nhbm5lZC5hZGQob2JqZWN0KTtcblxuICAgIHZhciBpc05ldyA9IGxhc3RJbmZvLm9jY3VyYW5jZXMgPT09IGZhbHNlICYmIG9iamVjdCAhPT0gc2NvcGUuc3RhdGU7XG5cbiAgICBpZihpc05ldyl7XG4gICAgICAgIGxhc3RJbmZvLm9jY3VyYW5jZXMgPSAwO1xuICAgIH1cblxuICAgIHZhciBjaGFuZ2VzID0gW107XG4gICAgZ2V0UmVtb3ZlZENoYW5nZXMoc2NvcGUsIGNoYW5nZXMsIGxhc3RJbmZvLCBvYmplY3QpO1xuICAgIGdldEN1cnJlbnRDaGFuZ2VzKHNjb3BlLCBjaGFuZ2VzLCBsYXN0SW5mbywgb2JqZWN0LCBzY2FubmVkLCBpbnN0YW5jZUNoYW5nZXMpO1xuXG4gICAgaWYoaXNOZXcpe1xuICAgICAgICBpbnN0YW5jZUNoYW5nZXMucHVzaChbbGFzdEluZm8uaWQsIG9iamVjdF0pO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGluc3RhbmNlQ2hhbmdlczogaW5zdGFuY2VDaGFuZ2VzLFxuICAgICAgICBjaGFuZ2VzOiBjaGFuZ2VzXG4gICAgfTtcbn1cblxuZnVuY3Rpb24gY2hhbmdlcygpe1xuICAgIHZhciBzY29wZSA9IHRoaXMsXG4gICAgICAgIHJlc3VsdCA9IGdldE9iamVjdENoYW5nZXMoc2NvcGUsIHNjb3BlLnN0YXRlKTtcblxuICAgIHZhciBpbnN0YW5jZUNoYW5nZXMgPSBPYmplY3Qua2V5cyhzY29wZS5pbnN0YW5jZXMpLnJlZHVjZShmdW5jdGlvbihjaGFuZ2VzLCBrZXkpe1xuICAgICAgICB2YXIgaW5zdGFuY2UgPSBzY29wZS5pbnN0YW5jZXNba2V5XSxcbiAgICAgICAgICAgIGl0ZW1JbmZvID0gc2NvcGUudHJhY2tlZE1hcC5nZXQoaW5zdGFuY2UpO1xuXG4gICAgICAgIGlmKGluc3RhbmNlICE9PSBzY29wZS5zdGF0ZSAmJiAhaXRlbUluZm8ub2NjdXJhbmNlcyl7XG4gICAgICAgICAgICBzY29wZS50cmFja2VkTWFwLmRlbGV0ZShpbnN0YW5jZSk7XG4gICAgICAgICAgICBkZWxldGUgc2NvcGUuaW5zdGFuY2VzW2l0ZW1JbmZvLmlkXTtcbiAgICAgICAgICAgIGNoYW5nZXMucHVzaChbaXRlbUluZm8uaWQsICdyJ10pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNoYW5nZXM7XG4gICAgfSwgW10pO1xuXG4gICAgcmV0dXJuIFtyZXN1bHQuaW5zdGFuY2VDaGFuZ2VzLmNvbmNhdChpbnN0YW5jZUNoYW5nZXMpXS5jb25jYXQocmVzdWx0LmNoYW5nZXMpO1xufVxuXG5mdW5jdGlvbiBnZXRTdGF0ZSgpe1xuICAgIHZhciBzdGF0ZSA9IHRoaXM7XG5cbiAgICBzdGF0ZS52aXNjb3VzLmNoYW5nZXMoKTtcblxuICAgIHJldHVybiBbT2JqZWN0LmtleXMoc3RhdGUuaW5zdGFuY2VzKS5yZXZlcnNlKCkubWFwKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIHJldHVybiBba2V5LCBzdGF0ZS5pbnN0YW5jZXNba2V5XV07XG4gICAgfSldO1xufVxuXG5mdW5jdGlvbiBhcHBseVJvb3RDaGFuZ2Uoc2NvcGUsIG5ld1N0YXRlKXtcbiAgICBmb3IodmFyIGtleSBpbiBzY29wZS5zdGF0ZSl7XG4gICAgICAgIGlmKCFrZXkgaW4gbmV3U3RhdGUpe1xuICAgICAgICAgICAgZGVsZXRlIHNjb3BlLnN0YXRlW2tleV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgZm9yKHZhciBrZXkgaW4gbmV3U3RhdGUpe1xuICAgICAgICBzY29wZS5zdGF0ZVtrZXldID0gbmV3U3RhdGVba2V5XTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5KGNoYW5nZXMpe1xuICAgIHZhciBzY29wZSA9IHRoaXMsXG4gICAgICAgIGluc3RhbmNlQ2hhbmdlcyA9IGNoYW5nZXNbMF07XG5cbiAgICBpbnN0YW5jZUNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbihpbnN0YW5jZUNoYW5nZSl7XG4gICAgICAgIGlmKGluc3RhbmNlQ2hhbmdlWzFdID09PSAncicpe1xuICAgICAgICAgICAgZGVsZXRlIHNjb3BlLmluc3RhbmNlc1tpbnN0YW5jZUNoYW5nZVswXV07XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgaWYoc2NvcGUuaW5zdGFuY2VzW2luc3RhbmNlQ2hhbmdlWzBdXSA9PT0gc2NvcGUuc3RhdGUpe1xuICAgICAgICAgICAgICAgIGFwcGx5Um9vdENoYW5nZShzY29wZSwgaW5zdGFuY2VDaGFuZ2VbMV0pO1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgc2NvcGUuaW5zdGFuY2VzW2luc3RhbmNlQ2hhbmdlWzBdXSA9IGluc3RhbmNlQ2hhbmdlWzFdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBmb3IodmFyIGkgPSAxOyBpIDwgY2hhbmdlcy5sZW5ndGg7IGkrKyl7XG4gICAgICAgIHZhciBjaGFuZ2UgPSBjaGFuZ2VzW2ldO1xuXG4gICAgICAgIGlmKGNoYW5nZVsyXSA9PT0gJ3InKXtcbiAgICAgICAgICAgIGRlbGV0ZSBzY29wZS5pbnN0YW5jZXNbY2hhbmdlWzBdXVtjaGFuZ2VbMV1dO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IGNoYW5nZVszXTtcblxuICAgICAgICAgICAgaWYoQXJyYXkuaXNBcnJheShjaGFuZ2VbM10pKXtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHNjb3BlLmluc3RhbmNlc1tjaGFuZ2VbM11dO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzY29wZS5pbnN0YW5jZXNbY2hhbmdlWzBdXVtjaGFuZ2VbMV1dID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldEluc3RhbmNlQnlJZChpZCl7XG4gICAgcmV0dXJuIHRoaXMuaW5zdGFuY2VzW2lkXTtcbn1cblxuZnVuY3Rpb24gdmlzY291cyhzdGF0ZSl7XG4gICAgdmFyIHZpc2NvdXMgPSB7fTtcblxuICAgIHZhciBzY29wZSA9IHtcbiAgICAgICAgdmlzY291cywgdmlzY291cyxcbiAgICAgICAgY3VycmVudElkOiAwLFxuICAgICAgICBzdGF0ZTogc3RhdGUgfHwge30sXG4gICAgICAgIHRyYWNrZWRNYXA6IG5ldyBXZWFrTWFwKCksXG4gICAgICAgIGluc3RhbmNlczoge31cbiAgICB9O1xuXG4gICAgc2NvcGUuZ2V0SWQgPSBnZXRJZC5iaW5kKHNjb3BlKTtcblxuICAgIHZpc2NvdXMuY2hhbmdlcyA9IGNoYW5nZXMuYmluZChzY29wZSk7XG4gICAgdmlzY291cy5hcHBseSA9IGFwcGx5LmJpbmQoc2NvcGUpO1xuICAgIHZpc2NvdXMuc3RhdGUgPSBnZXRTdGF0ZS5iaW5kKHNjb3BlKTtcbiAgICB2aXNjb3VzLmdldElkID0gZ2V0SW5zdGFuY2VJZC5iaW5kKHNjb3BlKTtcbiAgICB2aXNjb3VzLmdldEluc3RhbmNlID0gZ2V0SW5zdGFuY2VCeUlkLmJpbmQoc2NvcGUpO1xuXG4gICAgdmlzY291cy5jaGFuZ2VzKCk7XG5cbiAgICByZXR1cm4gdmlzY291cztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB2aXNjb3VzO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc1NhbWUoYSwgYil7XG4gICAgaWYoYSA9PT0gYil7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmKFxuICAgICAgICB0eXBlb2YgYSAhPT0gdHlwZW9mIGIgfHxcbiAgICAgICAgdHlwZW9mIGEgPT09ICdvYmplY3QnICYmXG4gICAgICAgICEoYSBpbnN0YW5jZW9mIERhdGUgJiYgYiBpbnN0YW5jZW9mIERhdGUpXG4gICAgKXtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBTdHJpbmcoYSkgPT09IFN0cmluZyhiKTtcbn07Il19
