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
},{"../../":3}],3:[function(require,module,exports){
var EventEmitter = require('events'),
    viscous = require('viscous'),
    shuv = require('shuv');

var INVOKE = 'i';
var CHANGES = 'c';
var CONNECT = 'o';
var STATE = 's';
var LENZE_FUNCTION = String.fromCharCode(0x192);

function createChanges(scope, changes){
    return JSON.stringify(changes);
}

function inflateChanges(scope, data){
    return JSON.parse(data);
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
        scope.handleFunction.apply(null, JSON.parse(message.data));
    }

    if(message.type === CONNECT){
        scope.send(CONNECT, scope.viscous.state());
    }
}

function update(){
    var scope = this;
    var now = Date.now();

    if(
        now - scope.lastUpdate < scope.maxInterval &&
        now - scope.lastChange > scope.dozeTime
    ){
        return;
    }

    scope.lastUpdate = now;

    var changes = scope.viscous.changes();

    if(changes.length > 2 || changes[1].length > 1){
        scope.lastChange = now;

        scope.lenze.emit('change', changes);

        if(scope.send){
            scope.send(CHANGES, changes);
        }
    }
}

function handleFunction(scope, id){
    scope.lastChange = Date.now();
    scope.viscous.getInstance(id).apply(this, scope.viscous.inflate(Array.prototype.slice.call(arguments, 2)));
    scope.lenze.update();
}

function send(scope, send, type, data){
    if(type === CHANGES || type === CONNECT){
        send(type + ':' + createChanges(scope, data));
    }
}

function sendInvoke(scope, sendInvoke){
    sendInvoke(INVOKE + ':' + JSON.stringify(Array.prototype.slice.call(arguments, 2)));
}

function getChangeInfo(scope, change){
    return {
        target: scope.viscous.getInstance(change[0]),
        key: change[1],
        type: change[2],
        value: Array.isArray(change[3]) ? scope.viscous.getInstance(change[3]) : change[3]
    };
}

function serialise(value){
    var scope = this;

    if(typeof value === 'function'){
        var result = {};

        for(var key in value){
            result[key] = value[key];
        }

        return [result, LENZE_FUNCTION];
    }
}

function deserialise(definition){
    var scope = this;

    if(definition[1] === LENZE_FUNCTION){
        var value = definition[0],
            result = function(){
                scope.invoke.apply(null, [scope.viscous.getId(result)].concat(scope.viscous.describe(Array.prototype.slice.call(arguments))));
            };

        for(var key in value){
            result[key] = value[key];
        }

        return result;
    }
}

function initScope(state, settings){

    if(!settings){
        settings = {};
    }

    var state = state || {};

    var scope = {};

    scope.lenze = new EventEmitter();
    scope.viscous = viscous(state, {
        serialiser: serialise.bind(scope),
        deserialiser: deserialise.bind(scope)
    });

    scope.lenze.update = update.bind(scope);
    scope.lenze.getChangeInfo = shuv(getChangeInfo, scope);
    scope.lenze.state = state;

    return scope;
}

function init(state, settings){
    if(arguments.length < 2){
        settings = state;
        state = null;
    }

    var scope = initScope(state, settings);

    scope.handleFunction = shuv(handleFunction, scope);
    scope.send = shuv(send, scope, settings.send);
    settings.receive(shuv(receive, scope));

    scope.minInterval = settings.minInterval || 30; // About two frames
    scope.maxInterval = settings.maxInterval || 300; // About what humans find "quick"
    scope.dozeTime = settings.dozeTime || 1000; // About how long between linked human actions

    setInterval(scope.lenze.update, scope.minInterval);

    return scope.lenze;
}

function replicant(state, settings){
    if(arguments.length < 2){
        settings = state;
        state = null;
    }

    var scope = initScope(state);

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

        if(
            message.type === CHANGES ||
            message.type === STATE ||
            message.type === CONNECT
        ){
            scope.viscous.apply(inflateChanges(scope, message.data));
            scope.lenze.update();
        }
    });

    scope.invoke = shuv(sendInvoke, scope, settings.send);

    settings.send(CONNECT + ':');

    return scope.lenze
}

module.exports = init;
module.exports.replicant = replicant;

},{"events":1,"shuv":4,"viscous":5}],4:[function(require,module,exports){
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
},{}],5:[function(require,module,exports){
var sameValue = require('same-value');
var REMOVED = 'r';
var ADDED = 'a';
var EDITED = 'e';

var ARRAY = 'a';
var FUNCTION = 'f';
var DATE = 'd';

function isInstance(value){
    var type = typeof value;
    return value && type === 'object' || type === 'function';
}

function same(a, b){
    if(isInstance(a) && a instanceof Date && a !== b){
        return false;
    }

    return sameValue(a, b);
}

function getId(int){
    return int.toString(36);
}

function createId(){
    return this.getId(this.currentId++);
}

function createInstanceInfo(scope, id, instanceId, value){
    var instanceInfo = {
            id: id,
            instance: value,
            instanceId: instanceId,
            lastState: {},
            new: true
        };

    scope.setInstance(id, value, instanceId);
    scope.trackedMap.set(value, instanceInfo);

    return instanceInfo;
}

function getInstanceInfo(scope, value){
    if(!isInstance(value)){
        return;
    }

    var instanceInfo = scope.trackedMap.get(value);

    if(!instanceInfo){
        instanceInfo = createInstanceInfo(scope, scope.createId(), null, value);
    }

    return instanceInfo;
}

function getInstanceId(value){
    var info = getInstanceInfo(this, value);

    return info && info.id;
}

function getRemovedChange(instanceInfo, object, oldKey){
    var scope = this;

    if(!(oldKey in object)){
        var oldValue = instanceInfo.lastState[oldKey];
        this.nextChange.push([instanceInfo.id, oldKey, REMOVED]);

        delete instanceInfo.lastState[oldKey];
    }
}

function getRemovedChanges(instanceInfo, object){
    function getChange(oldKey){
        this.getRemovedChange(instanceInfo, object, oldKey);
    }

    Object.keys(instanceInfo.lastState).forEach(getChange, this);
}

function getCurrentChange(instanceInfo, instance, currentKey){
    var scope = this;

    var type = instanceInfo.lastState.hasOwnProperty(currentKey) ? EDITED : ADDED,
        oldValue = instanceInfo.lastState[currentKey],
        currentValue = instance[currentKey],
        change = [instanceInfo.id, currentKey, type],
        changed = !same(oldValue, currentValue);

    if(changed || type === ADDED){
        instanceInfo.lastState[currentKey] = currentValue;
        this.nextChange.push(change);
    }

    if(!isInstance(currentValue)){
        change.push(currentValue);
        return;
    }

    var instanceId = scope.getInstanceId(instance[currentKey]);

    scope.currentInstances.add(instanceId);

    scope.getObjectChanges(currentValue);

    if(changed){
        change.push([instanceId]);
    }
}

function getCurrentChanges(instanceInfo, instance){
    function getChange(currentKey){
        this.getCurrentChange(instanceInfo, instance, currentKey);
    }

    Object.keys(instance).forEach(getChange, this);
}

function createInstanceDefinition(scope, instance){
    var result = scope.settings.serialiser(instance);

    if(!result){
        result = [];
        var value = instance;

        if(value instanceof Date){
            return [value.toISOString(), DATE];
        }

        if(typeof value === 'function'){
            result.push(function(){return instance.apply(this, arguments)}, FUNCTION);
        }else if(Array.isArray(value)){
            result.push({}, ARRAY);
        }else if(value && typeof value === 'object'){
            result.push({});
        }
    }

    Object.keys(instance).forEach(function(key){
        var id = scope.getInstanceId(instance[key]);
        result[0][key] = id ? [id] : instance[key];
    });

    return result;
}

function getObjectChanges(object){
    if(this.scanned.has(object)){
        return;
    }
    this.scanned.add(object);

    var scope = this;

    var instanceInfo = getInstanceInfo(scope, object),
        isNew = instanceInfo.new && object !== scope.state;

    scope.getRemovedChanges(instanceInfo, object);
    scope.getCurrentChanges(instanceInfo, object);

    if(!isNew){
        return;
    }

    instanceInfo.new = false;
    this.nextChange[0].push([instanceInfo.id, createInstanceDefinition(scope, object)]);
}

function createGarbageChange(id){
    var scope = this;
    if(!scope.currentInstances.has(id)){
        scope.trackedMap.delete(scope.getInstance(id));
        scope.removeInstance(id);
        scope.nextChange[0].unshift([id, REMOVED]);
    }
}

function changes(){
    var scope = this;

    // This is how not to write code 101,
    // But anything in the name of performance :P

    scope.nextChange[0] = [];
    scope.scanned = new WeakSet();
    scope.currentInstances.clear();
    scope.currentInstances.add(this.getId(0));

    scope.getObjectChanges(scope.state);

    Object.keys(this.getInstances()).forEach(createGarbageChange, this);

    var changes = scope.nextChange.splice(0, scope.nextChange.length);

    changes.unshift(scope.instanceId);

    return changes;
}

function getState(){
    var scope = this;

    scope.changes();

    return [scope.instanceId, Object.keys(scope.getInstances()).reverse().map(function(key){
        return [key, createInstanceDefinition(scope, scope.getInstances()[key])];
    })];
}

function applyObjectChange(target, newState, toInflate){
    if(Array.isArray(newState)){
        newState = newState[0];
        toInflate.push([target, newState]);
    }

    Object.keys(target).forEach(function(key){
        if(!key in newState){
            delete target[key];
        }
    });

    Object.keys(newState).forEach(function(key){
        target[key] = newState[key];
    });
}

function applyRootChange(scope, newState, toInflate){
    applyObjectChange(scope.state, newState, toInflate);
}

function inflateDefinition(scope, result, properties){
    Object.keys(properties).forEach(function(key){
        if(Array.isArray(properties[key])){
            result[key] = scope.getInstance(properties[key][0]);
        }else{
            result[key] = properties[key];
        }
    });
}

function createInstance(scope, definition, toInflate){
    if(Array.isArray(definition)){
        var type = definition[1],
            properties = definition[0];

        var result = scope.settings.deserialiser(definition);

        if(result){
            return result;
        }

        if(!type){
            result = {};
        }
        if(type === ARRAY){
            result = [];
        }
        if(type === FUNCTION){
            result = properties;
        }
        if(type === DATE){
            result = new Date(properties);
        }

        if(isInstance(result)){
            toInflate.push([result, properties]);
        }

        return result;
    }
}

function apply(changes){
    var scope = this,
        instanceId = changes[0],
        instanceChanges = changes[1],
        toInflate = [];

    instanceChanges.forEach(function(instanceChange){
        if(instanceChange[1] === REMOVED){
            var instance = scope.getInstance(instanceChange[0], instanceId);
            scope.trackedMap.delete(instance);
            scope.removeInstance(instanceChange[0], instanceId);
        }else{
            if(scope.getInstance(instanceChange[0], instanceId) === scope.state){
                applyRootChange(scope, instanceChange[1], toInflate);
            }else{
                createInstanceInfo(scope, instanceChange[0], instanceId, createInstance(scope, instanceChange[1], toInflate));
            }
        }
    });

    toInflate.forEach(function(change){
        inflateDefinition(scope, change[0], change[1]);
    });

    for(var i = 2; i < changes.length; i++){
        var change = changes[i];

        if(change[2] === REMOVED){
            delete scope.getInstance(change[0], instanceId)[change[1]];
        }else{
            var value = change[3];

            if(Array.isArray(change[3])){
                value = scope.getInstance(change[3], instanceId);
            }

            scope.getInstance(change[0], instanceId)[change[1]] = value;
        }
    }
}

function setInstanceId(scope, id){
    var oldId = scope.instanceId;
    scope.instanceId = id;
    return scope.instances[scope.instanceId] = scope.instances[oldId] || {};
}

function getInstances(instanceId){
    if(instanceId = null){
        instanceId = this.instanceId;
    }

    if(!(instanceId in this.instances)){
        this.instances[instanceId] = {};
    }

    return this.instances[instanceId];
}

function getInstanceById(id, instanceId){
    return this.getInstances(instanceId)[id];
}

function setInstanceById(id, value, instanceId){
    this.getInstances(instanceId)[id] = value;
}

function removeInstanceById(id, instanceId){
    delete this.getInstances(instanceId)[id];
}

function describe(data){
    if(isInstance(data)){
        if(this.trackedMap.has(data)){
            return [this.getInstanceId(data)];
        }
        return createInstanceDefinition(this, data);
    }

    return data;
}

function inflate(description){
    var scope = this;

    if(Array.isArray(description) && typeof description[0] === 'string'){
        return scope.getInstance(description[0]);
    }

    if(isInstance(description)){
        var toInflate = [];

        var result = createInstance(scope, description, toInflate);

        toInflate.forEach(function(change){
            inflateDefinition(scope, change[0], change[1]);
        });

        return result;
    }

    return description;
}

function viscous(state, settings){
    if(!settings){
        settings = {
            serialiser: function(){},
            deserialiser: function(){}
        };
    }

    var viscous = {};

    var scope = {
        nextChange: [],
        currentInstances: new Set(),
        settings: settings,
        viscous: viscous,
        currentId: 0,
        state: state || {},
        trackedMap: new WeakMap(),
        instances: {}
    };

    // Scope bound for perf.
    scope.getCurrentChanges = getCurrentChanges.bind(scope);
    scope.getCurrentChange = getCurrentChange.bind(scope);
    scope.getRemovedChanges = getRemovedChanges.bind(scope);
    scope.getRemovedChange = getRemovedChange.bind(scope);
    scope.getObjectChanges = getObjectChanges.bind(scope);
    scope.getInstances = getInstances.bind(scope);
    scope.getInstance = getInstanceById.bind(scope);
    scope.setInstance = setInstanceById.bind(scope);
    scope.removeInstance = removeInstanceById.bind(scope);
    scope.getInstanceId = getInstanceId.bind(scope);
    scope.changes = changes.bind(scope);

    scope.getId = getId.bind(scope);
    scope.createId = createId.bind(scope);

    viscous.changes = scope.changes;
    viscous.apply = apply.bind(scope);
    viscous.state = getState.bind(scope);
    viscous.getId = scope.getInstanceId;
    viscous.getInstance = scope.getInstance;
    viscous.describe = describe.bind(scope);
    viscous.inflate = inflate.bind(scope);

    setInstanceId(scope, parseInt(Math.random() * Math.pow(36,2)).toString(36));

    viscous.changes();

    return viscous;
}

module.exports = viscous;

},{"same-value":6}],6:[function(require,module,exports){
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
},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92NS4zLjAvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y1LjMuMC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiZXhhbXBsZS9hcHAvYXBwLmpzIiwiaW5kZXguanMiLCJub2RlX21vZHVsZXMvc2h1di9pbmRleC5qcyIsIi4uL3Zpc2NvdXMvaW5kZXguanMiLCIuLi92aXNjb3VzL25vZGVfbW9kdWxlcy9zYW1lLXZhbHVlL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDamJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJ2YXIgbGVuemUgPSByZXF1aXJlKCcuLi8uLi8nKSh7XG4gICAgY2hhbmdlSW50ZXJ2YWw6IDE2LFxuICAgIHNlbmQ6IGZ1bmN0aW9uKGRhdGEpe1xuICAgICAgICBzZWxmLnBvc3RNZXNzYWdlKGRhdGEpO1xuICAgIH0sXG4gICAgcmVjZWl2ZTogZnVuY3Rpb24oY2FsbGJhY2spe1xuICAgICAgICBzZWxmLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbihtZXNzYWdlKXtcbiAgICAgICAgICAgIGNhbGxiYWNrKG1lc3NhZ2UuZGF0YSk7XG4gICAgICAgIH0pO1xuICAgIH1cbn0pO1xuXG52YXIgc3RhdGUgPSBsZW56ZS5zdGF0ZTtcblxuc3RhdGUuc2V0SGVhZGluZyA9IGZ1bmN0aW9uKHZhbHVlKXtcbiAgICBzdGF0ZS5oZWFkaW5nID0gJ0hlbGxvICcgKyAodmFsdWUgfHwgJ1dvcmxkJyk7XG59O1xuc3RhdGUuc2V0SGVhZGluZygpO1xuXG5zdGF0ZS5vYmpzID0gW107XG5zdGF0ZS54ID0ge307XG5zdGF0ZS55ID0gc3RhdGUueDtcblxuc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgIHN0YXRlLnogPSBzdGF0ZS54O1xufSwgMTAwMCk7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHZpc2NvdXMgPSByZXF1aXJlKCd2aXNjb3VzJyksXG4gICAgc2h1diA9IHJlcXVpcmUoJ3NodXYnKTtcblxudmFyIElOVk9LRSA9ICdpJztcbnZhciBDSEFOR0VTID0gJ2MnO1xudmFyIENPTk5FQ1QgPSAnbyc7XG52YXIgU1RBVEUgPSAncyc7XG52YXIgTEVOWkVfRlVOQ1RJT04gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4MTkyKTtcblxuZnVuY3Rpb24gY3JlYXRlQ2hhbmdlcyhzY29wZSwgY2hhbmdlcyl7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGNoYW5nZXMpO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlQ2hhbmdlcyhzY29wZSwgZGF0YSl7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTWVzc2FnZShkYXRhKXtcbiAgICB2YXIgbWVzc2FnZSA9IGRhdGEubWF0Y2goL14oXFx3Kz8pXFw6KC4qKS8pO1xuXG4gICAgaWYobWVzc2FnZSl7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBtZXNzYWdlWzFdLFxuICAgICAgICAgICAgZGF0YTogbWVzc2FnZVsyXVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZWNlaXZlKHNjb3BlLCBkYXRhKXtcbiAgICB2YXIgbWVzc2FnZSA9IHBhcnNlTWVzc2FnZShkYXRhKTtcblxuICAgIGlmKCFtZXNzYWdlKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmKG1lc3NhZ2UudHlwZSA9PT0gSU5WT0tFKXtcbiAgICAgICAgc2NvcGUuaGFuZGxlRnVuY3Rpb24uYXBwbHkobnVsbCwgSlNPTi5wYXJzZShtZXNzYWdlLmRhdGEpKTtcbiAgICB9XG5cbiAgICBpZihtZXNzYWdlLnR5cGUgPT09IENPTk5FQ1Qpe1xuICAgICAgICBzY29wZS5zZW5kKENPTk5FQ1QsIHNjb3BlLnZpc2NvdXMuc3RhdGUoKSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB1cGRhdGUoKXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIHZhciBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgaWYoXG4gICAgICAgIG5vdyAtIHNjb3BlLmxhc3RVcGRhdGUgPCBzY29wZS5tYXhJbnRlcnZhbCAmJlxuICAgICAgICBub3cgLSBzY29wZS5sYXN0Q2hhbmdlID4gc2NvcGUuZG96ZVRpbWVcbiAgICApe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2NvcGUubGFzdFVwZGF0ZSA9IG5vdztcblxuICAgIHZhciBjaGFuZ2VzID0gc2NvcGUudmlzY291cy5jaGFuZ2VzKCk7XG5cbiAgICBpZihjaGFuZ2VzLmxlbmd0aCA+IDIgfHwgY2hhbmdlc1sxXS5sZW5ndGggPiAxKXtcbiAgICAgICAgc2NvcGUubGFzdENoYW5nZSA9IG5vdztcblxuICAgICAgICBzY29wZS5sZW56ZS5lbWl0KCdjaGFuZ2UnLCBjaGFuZ2VzKTtcblxuICAgICAgICBpZihzY29wZS5zZW5kKXtcbiAgICAgICAgICAgIHNjb3BlLnNlbmQoQ0hBTkdFUywgY2hhbmdlcyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZUZ1bmN0aW9uKHNjb3BlLCBpZCl7XG4gICAgc2NvcGUubGFzdENoYW5nZSA9IERhdGUubm93KCk7XG4gICAgc2NvcGUudmlzY291cy5nZXRJbnN0YW5jZShpZCkuYXBwbHkodGhpcywgc2NvcGUudmlzY291cy5pbmZsYXRlKEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMikpKTtcbiAgICBzY29wZS5sZW56ZS51cGRhdGUoKTtcbn1cblxuZnVuY3Rpb24gc2VuZChzY29wZSwgc2VuZCwgdHlwZSwgZGF0YSl7XG4gICAgaWYodHlwZSA9PT0gQ0hBTkdFUyB8fCB0eXBlID09PSBDT05ORUNUKXtcbiAgICAgICAgc2VuZCh0eXBlICsgJzonICsgY3JlYXRlQ2hhbmdlcyhzY29wZSwgZGF0YSkpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc2VuZEludm9rZShzY29wZSwgc2VuZEludm9rZSl7XG4gICAgc2VuZEludm9rZShJTlZPS0UgKyAnOicgKyBKU09OLnN0cmluZ2lmeShBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpKSk7XG59XG5cbmZ1bmN0aW9uIGdldENoYW5nZUluZm8oc2NvcGUsIGNoYW5nZSl7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdGFyZ2V0OiBzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKGNoYW5nZVswXSksXG4gICAgICAgIGtleTogY2hhbmdlWzFdLFxuICAgICAgICB0eXBlOiBjaGFuZ2VbMl0sXG4gICAgICAgIHZhbHVlOiBBcnJheS5pc0FycmF5KGNoYW5nZVszXSkgPyBzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKGNoYW5nZVszXSkgOiBjaGFuZ2VbM11cbiAgICB9O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpc2UodmFsdWUpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBpZih0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpe1xuICAgICAgICB2YXIgcmVzdWx0ID0ge307XG5cbiAgICAgICAgZm9yKHZhciBrZXkgaW4gdmFsdWUpe1xuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZVtrZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFtyZXN1bHQsIExFTlpFX0ZVTkNUSU9OXTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRlc2VyaWFsaXNlKGRlZmluaXRpb24pe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBpZihkZWZpbml0aW9uWzFdID09PSBMRU5aRV9GVU5DVElPTil7XG4gICAgICAgIHZhciB2YWx1ZSA9IGRlZmluaXRpb25bMF0sXG4gICAgICAgICAgICByZXN1bHQgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIHNjb3BlLmludm9rZS5hcHBseShudWxsLCBbc2NvcGUudmlzY291cy5nZXRJZChyZXN1bHQpXS5jb25jYXQoc2NvcGUudmlzY291cy5kZXNjcmliZShBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKSkpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICBmb3IodmFyIGtleSBpbiB2YWx1ZSl7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlW2tleV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaW5pdFNjb3BlKHN0YXRlLCBzZXR0aW5ncyl7XG5cbiAgICBpZighc2V0dGluZ3Mpe1xuICAgICAgICBzZXR0aW5ncyA9IHt9O1xuICAgIH1cblxuICAgIHZhciBzdGF0ZSA9IHN0YXRlIHx8IHt9O1xuXG4gICAgdmFyIHNjb3BlID0ge307XG5cbiAgICBzY29wZS5sZW56ZSA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgICBzY29wZS52aXNjb3VzID0gdmlzY291cyhzdGF0ZSwge1xuICAgICAgICBzZXJpYWxpc2VyOiBzZXJpYWxpc2UuYmluZChzY29wZSksXG4gICAgICAgIGRlc2VyaWFsaXNlcjogZGVzZXJpYWxpc2UuYmluZChzY29wZSlcbiAgICB9KTtcblxuICAgIHNjb3BlLmxlbnplLnVwZGF0ZSA9IHVwZGF0ZS5iaW5kKHNjb3BlKTtcbiAgICBzY29wZS5sZW56ZS5nZXRDaGFuZ2VJbmZvID0gc2h1dihnZXRDaGFuZ2VJbmZvLCBzY29wZSk7XG4gICAgc2NvcGUubGVuemUuc3RhdGUgPSBzdGF0ZTtcblxuICAgIHJldHVybiBzY29wZTtcbn1cblxuZnVuY3Rpb24gaW5pdChzdGF0ZSwgc2V0dGluZ3Mpe1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPCAyKXtcbiAgICAgICAgc2V0dGluZ3MgPSBzdGF0ZTtcbiAgICAgICAgc3RhdGUgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBzY29wZSA9IGluaXRTY29wZShzdGF0ZSwgc2V0dGluZ3MpO1xuXG4gICAgc2NvcGUuaGFuZGxlRnVuY3Rpb24gPSBzaHV2KGhhbmRsZUZ1bmN0aW9uLCBzY29wZSk7XG4gICAgc2NvcGUuc2VuZCA9IHNodXYoc2VuZCwgc2NvcGUsIHNldHRpbmdzLnNlbmQpO1xuICAgIHNldHRpbmdzLnJlY2VpdmUoc2h1dihyZWNlaXZlLCBzY29wZSkpO1xuXG4gICAgc2NvcGUubWluSW50ZXJ2YWwgPSBzZXR0aW5ncy5taW5JbnRlcnZhbCB8fCAzMDsgLy8gQWJvdXQgdHdvIGZyYW1lc1xuICAgIHNjb3BlLm1heEludGVydmFsID0gc2V0dGluZ3MubWF4SW50ZXJ2YWwgfHwgMzAwOyAvLyBBYm91dCB3aGF0IGh1bWFucyBmaW5kIFwicXVpY2tcIlxuICAgIHNjb3BlLmRvemVUaW1lID0gc2V0dGluZ3MuZG96ZVRpbWUgfHwgMTAwMDsgLy8gQWJvdXQgaG93IGxvbmcgYmV0d2VlbiBsaW5rZWQgaHVtYW4gYWN0aW9uc1xuXG4gICAgc2V0SW50ZXJ2YWwoc2NvcGUubGVuemUudXBkYXRlLCBzY29wZS5taW5JbnRlcnZhbCk7XG5cbiAgICByZXR1cm4gc2NvcGUubGVuemU7XG59XG5cbmZ1bmN0aW9uIHJlcGxpY2FudChzdGF0ZSwgc2V0dGluZ3Mpe1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPCAyKXtcbiAgICAgICAgc2V0dGluZ3MgPSBzdGF0ZTtcbiAgICAgICAgc3RhdGUgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBzY29wZSA9IGluaXRTY29wZShzdGF0ZSk7XG5cbiAgICBzY29wZS5pbnN0YW5jZUhhc2ggPSB7fTtcblxuICAgIHNldHRpbmdzLnJlY2VpdmUoZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIGlmKCFzY29wZS5yZWFkeSl7XG4gICAgICAgICAgICBzY29wZS5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBzY29wZS5sZW56ZS5lbWl0KCdyZWFkeScpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG1lc3NhZ2UgPSBwYXJzZU1lc3NhZ2UoZGF0YSk7XG5cbiAgICAgICAgaWYoIW1lc3NhZ2Upe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoXG4gICAgICAgICAgICBtZXNzYWdlLnR5cGUgPT09IENIQU5HRVMgfHxcbiAgICAgICAgICAgIG1lc3NhZ2UudHlwZSA9PT0gU1RBVEUgfHxcbiAgICAgICAgICAgIG1lc3NhZ2UudHlwZSA9PT0gQ09OTkVDVFxuICAgICAgICApe1xuICAgICAgICAgICAgc2NvcGUudmlzY291cy5hcHBseShpbmZsYXRlQ2hhbmdlcyhzY29wZSwgbWVzc2FnZS5kYXRhKSk7XG4gICAgICAgICAgICBzY29wZS5sZW56ZS51cGRhdGUoKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgc2NvcGUuaW52b2tlID0gc2h1dihzZW5kSW52b2tlLCBzY29wZSwgc2V0dGluZ3Muc2VuZCk7XG5cbiAgICBzZXR0aW5ncy5zZW5kKENPTk5FQ1QgKyAnOicpO1xuXG4gICAgcmV0dXJuIHNjb3BlLmxlbnplXG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdDtcbm1vZHVsZS5leHBvcnRzLnJlcGxpY2FudCA9IHJlcGxpY2FudDtcbiIsInZhciBwbGFjZWhvbGRlciA9IHt9LFxuICAgIGVuZE9mQXJncyA9IHt9LFxuICAgIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwuYmluZChBcnJheS5wcm90b3R5cGUuc2xpY2UpO1xuXG5mdW5jdGlvbiBzaHV2KGZuKXtcbiAgICB2YXIgb3V0ZXJBcmdzID0gc2xpY2UoYXJndW1lbnRzLCAxKTtcblxuICAgIGlmKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJyl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gb3Igbm9uLWZ1bmN0aW9uIHBhc3NlZCB0byBzaHV2Jyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBjb250ZXh0ID0gdGhpcyxcbiAgICAgICAgICAgIGlubmVyQXJncyA9IHNsaWNlKGFyZ3VtZW50cyksXG4gICAgICAgICAgICBmaW5hbEFyZ3MgPSBbXSxcbiAgICAgICAgICAgIGFwcGVuZCA9IHRydWU7XG5cbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IG91dGVyQXJncy5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICB2YXIgb3V0ZXJBcmcgPSBvdXRlckFyZ3NbaV07XG5cbiAgICAgICAgICAgIGlmKG91dGVyQXJnID09PSBlbmRPZkFyZ3Mpe1xuICAgICAgICAgICAgICAgIGFwcGVuZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihvdXRlckFyZyA9PT0gcGxhY2Vob2xkZXIpe1xuICAgICAgICAgICAgICAgIGZpbmFsQXJncy5wdXNoKGlubmVyQXJncy5zaGlmdCgpKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZmluYWxBcmdzLnB1c2gob3V0ZXJBcmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoYXBwZW5kKXtcbiAgICAgICAgICAgIGZpbmFsQXJncyA9IGZpbmFsQXJncy5jb25jYXQoaW5uZXJBcmdzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmbi5hcHBseShjb250ZXh0LCBmaW5hbEFyZ3MpO1xuICAgIH07XG59XG5cbnNodXYuXyA9IHBsYWNlaG9sZGVyO1xuc2h1di4kID0gZW5kT2ZBcmdzO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHNodXY7IiwidmFyIHNhbWVWYWx1ZSA9IHJlcXVpcmUoJ3NhbWUtdmFsdWUnKTtcbnZhciBSRU1PVkVEID0gJ3InO1xudmFyIEFEREVEID0gJ2EnO1xudmFyIEVESVRFRCA9ICdlJztcblxudmFyIEFSUkFZID0gJ2EnO1xudmFyIEZVTkNUSU9OID0gJ2YnO1xudmFyIERBVEUgPSAnZCc7XG5cbmZ1bmN0aW9uIGlzSW5zdGFuY2UodmFsdWUpe1xuICAgIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICAgIHJldHVybiB2YWx1ZSAmJiB0eXBlID09PSAnb2JqZWN0JyB8fCB0eXBlID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBzYW1lKGEsIGIpe1xuICAgIGlmKGlzSW5zdGFuY2UoYSkgJiYgYSBpbnN0YW5jZW9mIERhdGUgJiYgYSAhPT0gYil7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2FtZVZhbHVlKGEsIGIpO1xufVxuXG5mdW5jdGlvbiBnZXRJZChpbnQpe1xuICAgIHJldHVybiBpbnQudG9TdHJpbmcoMzYpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJZCgpe1xuICAgIHJldHVybiB0aGlzLmdldElkKHRoaXMuY3VycmVudElkKyspO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJbnN0YW5jZUluZm8oc2NvcGUsIGlkLCBpbnN0YW5jZUlkLCB2YWx1ZSl7XG4gICAgdmFyIGluc3RhbmNlSW5mbyA9IHtcbiAgICAgICAgICAgIGlkOiBpZCxcbiAgICAgICAgICAgIGluc3RhbmNlOiB2YWx1ZSxcbiAgICAgICAgICAgIGluc3RhbmNlSWQ6IGluc3RhbmNlSWQsXG4gICAgICAgICAgICBsYXN0U3RhdGU6IHt9LFxuICAgICAgICAgICAgbmV3OiB0cnVlXG4gICAgICAgIH07XG5cbiAgICBzY29wZS5zZXRJbnN0YW5jZShpZCwgdmFsdWUsIGluc3RhbmNlSWQpO1xuICAgIHNjb3BlLnRyYWNrZWRNYXAuc2V0KHZhbHVlLCBpbnN0YW5jZUluZm8pO1xuXG4gICAgcmV0dXJuIGluc3RhbmNlSW5mbztcbn1cblxuZnVuY3Rpb24gZ2V0SW5zdGFuY2VJbmZvKHNjb3BlLCB2YWx1ZSl7XG4gICAgaWYoIWlzSW5zdGFuY2UodmFsdWUpKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBpbnN0YW5jZUluZm8gPSBzY29wZS50cmFja2VkTWFwLmdldCh2YWx1ZSk7XG5cbiAgICBpZighaW5zdGFuY2VJbmZvKXtcbiAgICAgICAgaW5zdGFuY2VJbmZvID0gY3JlYXRlSW5zdGFuY2VJbmZvKHNjb3BlLCBzY29wZS5jcmVhdGVJZCgpLCBudWxsLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGluc3RhbmNlSW5mbztcbn1cblxuZnVuY3Rpb24gZ2V0SW5zdGFuY2VJZCh2YWx1ZSl7XG4gICAgdmFyIGluZm8gPSBnZXRJbnN0YW5jZUluZm8odGhpcywgdmFsdWUpO1xuXG4gICAgcmV0dXJuIGluZm8gJiYgaW5mby5pZDtcbn1cblxuZnVuY3Rpb24gZ2V0UmVtb3ZlZENoYW5nZShpbnN0YW5jZUluZm8sIG9iamVjdCwgb2xkS2V5KXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuXG4gICAgaWYoIShvbGRLZXkgaW4gb2JqZWN0KSl7XG4gICAgICAgIHZhciBvbGRWYWx1ZSA9IGluc3RhbmNlSW5mby5sYXN0U3RhdGVbb2xkS2V5XTtcbiAgICAgICAgdGhpcy5uZXh0Q2hhbmdlLnB1c2goW2luc3RhbmNlSW5mby5pZCwgb2xkS2V5LCBSRU1PVkVEXSk7XG5cbiAgICAgICAgZGVsZXRlIGluc3RhbmNlSW5mby5sYXN0U3RhdGVbb2xkS2V5XTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldFJlbW92ZWRDaGFuZ2VzKGluc3RhbmNlSW5mbywgb2JqZWN0KXtcbiAgICBmdW5jdGlvbiBnZXRDaGFuZ2Uob2xkS2V5KXtcbiAgICAgICAgdGhpcy5nZXRSZW1vdmVkQ2hhbmdlKGluc3RhbmNlSW5mbywgb2JqZWN0LCBvbGRLZXkpO1xuICAgIH1cblxuICAgIE9iamVjdC5rZXlzKGluc3RhbmNlSW5mby5sYXN0U3RhdGUpLmZvckVhY2goZ2V0Q2hhbmdlLCB0aGlzKTtcbn1cblxuZnVuY3Rpb24gZ2V0Q3VycmVudENoYW5nZShpbnN0YW5jZUluZm8sIGluc3RhbmNlLCBjdXJyZW50S2V5KXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuXG4gICAgdmFyIHR5cGUgPSBpbnN0YW5jZUluZm8ubGFzdFN0YXRlLmhhc093blByb3BlcnR5KGN1cnJlbnRLZXkpID8gRURJVEVEIDogQURERUQsXG4gICAgICAgIG9sZFZhbHVlID0gaW5zdGFuY2VJbmZvLmxhc3RTdGF0ZVtjdXJyZW50S2V5XSxcbiAgICAgICAgY3VycmVudFZhbHVlID0gaW5zdGFuY2VbY3VycmVudEtleV0sXG4gICAgICAgIGNoYW5nZSA9IFtpbnN0YW5jZUluZm8uaWQsIGN1cnJlbnRLZXksIHR5cGVdLFxuICAgICAgICBjaGFuZ2VkID0gIXNhbWUob2xkVmFsdWUsIGN1cnJlbnRWYWx1ZSk7XG5cbiAgICBpZihjaGFuZ2VkIHx8IHR5cGUgPT09IEFEREVEKXtcbiAgICAgICAgaW5zdGFuY2VJbmZvLmxhc3RTdGF0ZVtjdXJyZW50S2V5XSA9IGN1cnJlbnRWYWx1ZTtcbiAgICAgICAgdGhpcy5uZXh0Q2hhbmdlLnB1c2goY2hhbmdlKTtcbiAgICB9XG5cbiAgICBpZighaXNJbnN0YW5jZShjdXJyZW50VmFsdWUpKXtcbiAgICAgICAgY2hhbmdlLnB1c2goY3VycmVudFZhbHVlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBpbnN0YW5jZUlkID0gc2NvcGUuZ2V0SW5zdGFuY2VJZChpbnN0YW5jZVtjdXJyZW50S2V5XSk7XG5cbiAgICBzY29wZS5jdXJyZW50SW5zdGFuY2VzLmFkZChpbnN0YW5jZUlkKTtcblxuICAgIHNjb3BlLmdldE9iamVjdENoYW5nZXMoY3VycmVudFZhbHVlKTtcblxuICAgIGlmKGNoYW5nZWQpe1xuICAgICAgICBjaGFuZ2UucHVzaChbaW5zdGFuY2VJZF0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q3VycmVudENoYW5nZXMoaW5zdGFuY2VJbmZvLCBpbnN0YW5jZSl7XG4gICAgZnVuY3Rpb24gZ2V0Q2hhbmdlKGN1cnJlbnRLZXkpe1xuICAgICAgICB0aGlzLmdldEN1cnJlbnRDaGFuZ2UoaW5zdGFuY2VJbmZvLCBpbnN0YW5jZSwgY3VycmVudEtleSk7XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMoaW5zdGFuY2UpLmZvckVhY2goZ2V0Q2hhbmdlLCB0aGlzKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSW5zdGFuY2VEZWZpbml0aW9uKHNjb3BlLCBpbnN0YW5jZSl7XG4gICAgdmFyIHJlc3VsdCA9IHNjb3BlLnNldHRpbmdzLnNlcmlhbGlzZXIoaW5zdGFuY2UpO1xuXG4gICAgaWYoIXJlc3VsdCl7XG4gICAgICAgIHJlc3VsdCA9IFtdO1xuICAgICAgICB2YXIgdmFsdWUgPSBpbnN0YW5jZTtcblxuICAgICAgICBpZih2YWx1ZSBpbnN0YW5jZW9mIERhdGUpe1xuICAgICAgICAgICAgcmV0dXJuIFt2YWx1ZS50b0lTT1N0cmluZygpLCBEQVRFXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyl7XG4gICAgICAgICAgICByZXN1bHQucHVzaChmdW5jdGlvbigpe3JldHVybiBpbnN0YW5jZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpfSwgRlVOQ1RJT04pO1xuICAgICAgICB9ZWxzZSBpZihBcnJheS5pc0FycmF5KHZhbHVlKSl7XG4gICAgICAgICAgICByZXN1bHQucHVzaCh7fSwgQVJSQVkpO1xuICAgICAgICB9ZWxzZSBpZih2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKXtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHt9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIE9iamVjdC5rZXlzKGluc3RhbmNlKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIHZhciBpZCA9IHNjb3BlLmdldEluc3RhbmNlSWQoaW5zdGFuY2Vba2V5XSk7XG4gICAgICAgIHJlc3VsdFswXVtrZXldID0gaWQgPyBbaWRdIDogaW5zdGFuY2Vba2V5XTtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGdldE9iamVjdENoYW5nZXMob2JqZWN0KXtcbiAgICBpZih0aGlzLnNjYW5uZWQuaGFzKG9iamVjdCkpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuc2Nhbm5lZC5hZGQob2JqZWN0KTtcblxuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICB2YXIgaW5zdGFuY2VJbmZvID0gZ2V0SW5zdGFuY2VJbmZvKHNjb3BlLCBvYmplY3QpLFxuICAgICAgICBpc05ldyA9IGluc3RhbmNlSW5mby5uZXcgJiYgb2JqZWN0ICE9PSBzY29wZS5zdGF0ZTtcblxuICAgIHNjb3BlLmdldFJlbW92ZWRDaGFuZ2VzKGluc3RhbmNlSW5mbywgb2JqZWN0KTtcbiAgICBzY29wZS5nZXRDdXJyZW50Q2hhbmdlcyhpbnN0YW5jZUluZm8sIG9iamVjdCk7XG5cbiAgICBpZighaXNOZXcpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaW5zdGFuY2VJbmZvLm5ldyA9IGZhbHNlO1xuICAgIHRoaXMubmV4dENoYW5nZVswXS5wdXNoKFtpbnN0YW5jZUluZm8uaWQsIGNyZWF0ZUluc3RhbmNlRGVmaW5pdGlvbihzY29wZSwgb2JqZWN0KV0pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVHYXJiYWdlQ2hhbmdlKGlkKXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIGlmKCFzY29wZS5jdXJyZW50SW5zdGFuY2VzLmhhcyhpZCkpe1xuICAgICAgICBzY29wZS50cmFja2VkTWFwLmRlbGV0ZShzY29wZS5nZXRJbnN0YW5jZShpZCkpO1xuICAgICAgICBzY29wZS5yZW1vdmVJbnN0YW5jZShpZCk7XG4gICAgICAgIHNjb3BlLm5leHRDaGFuZ2VbMF0udW5zaGlmdChbaWQsIFJFTU9WRURdKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNoYW5nZXMoKXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuXG4gICAgLy8gVGhpcyBpcyBob3cgbm90IHRvIHdyaXRlIGNvZGUgMTAxLFxuICAgIC8vIEJ1dCBhbnl0aGluZyBpbiB0aGUgbmFtZSBvZiBwZXJmb3JtYW5jZSA6UFxuXG4gICAgc2NvcGUubmV4dENoYW5nZVswXSA9IFtdO1xuICAgIHNjb3BlLnNjYW5uZWQgPSBuZXcgV2Vha1NldCgpO1xuICAgIHNjb3BlLmN1cnJlbnRJbnN0YW5jZXMuY2xlYXIoKTtcbiAgICBzY29wZS5jdXJyZW50SW5zdGFuY2VzLmFkZCh0aGlzLmdldElkKDApKTtcblxuICAgIHNjb3BlLmdldE9iamVjdENoYW5nZXMoc2NvcGUuc3RhdGUpO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5nZXRJbnN0YW5jZXMoKSkuZm9yRWFjaChjcmVhdGVHYXJiYWdlQ2hhbmdlLCB0aGlzKTtcblxuICAgIHZhciBjaGFuZ2VzID0gc2NvcGUubmV4dENoYW5nZS5zcGxpY2UoMCwgc2NvcGUubmV4dENoYW5nZS5sZW5ndGgpO1xuXG4gICAgY2hhbmdlcy51bnNoaWZ0KHNjb3BlLmluc3RhbmNlSWQpO1xuXG4gICAgcmV0dXJuIGNoYW5nZXM7XG59XG5cbmZ1bmN0aW9uIGdldFN0YXRlKCl7XG4gICAgdmFyIHNjb3BlID0gdGhpcztcblxuICAgIHNjb3BlLmNoYW5nZXMoKTtcblxuICAgIHJldHVybiBbc2NvcGUuaW5zdGFuY2VJZCwgT2JqZWN0LmtleXMoc2NvcGUuZ2V0SW5zdGFuY2VzKCkpLnJldmVyc2UoKS5tYXAoZnVuY3Rpb24oa2V5KXtcbiAgICAgICAgcmV0dXJuIFtrZXksIGNyZWF0ZUluc3RhbmNlRGVmaW5pdGlvbihzY29wZSwgc2NvcGUuZ2V0SW5zdGFuY2VzKClba2V5XSldO1xuICAgIH0pXTtcbn1cblxuZnVuY3Rpb24gYXBwbHlPYmplY3RDaGFuZ2UodGFyZ2V0LCBuZXdTdGF0ZSwgdG9JbmZsYXRlKXtcbiAgICBpZihBcnJheS5pc0FycmF5KG5ld1N0YXRlKSl7XG4gICAgICAgIG5ld1N0YXRlID0gbmV3U3RhdGVbMF07XG4gICAgICAgIHRvSW5mbGF0ZS5wdXNoKFt0YXJnZXQsIG5ld1N0YXRlXSk7XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXModGFyZ2V0KS5mb3JFYWNoKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIGlmKCFrZXkgaW4gbmV3U3RhdGUpe1xuICAgICAgICAgICAgZGVsZXRlIHRhcmdldFtrZXldO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBPYmplY3Qua2V5cyhuZXdTdGF0ZSkuZm9yRWFjaChmdW5jdGlvbihrZXkpe1xuICAgICAgICB0YXJnZXRba2V5XSA9IG5ld1N0YXRlW2tleV07XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGFwcGx5Um9vdENoYW5nZShzY29wZSwgbmV3U3RhdGUsIHRvSW5mbGF0ZSl7XG4gICAgYXBwbHlPYmplY3RDaGFuZ2Uoc2NvcGUuc3RhdGUsIG5ld1N0YXRlLCB0b0luZmxhdGUpO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlRGVmaW5pdGlvbihzY29wZSwgcmVzdWx0LCBwcm9wZXJ0aWVzKXtcbiAgICBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIGlmKEFycmF5LmlzQXJyYXkocHJvcGVydGllc1trZXldKSl7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IHNjb3BlLmdldEluc3RhbmNlKHByb3BlcnRpZXNba2V5XVswXSk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBwcm9wZXJ0aWVzW2tleV07XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSW5zdGFuY2Uoc2NvcGUsIGRlZmluaXRpb24sIHRvSW5mbGF0ZSl7XG4gICAgaWYoQXJyYXkuaXNBcnJheShkZWZpbml0aW9uKSl7XG4gICAgICAgIHZhciB0eXBlID0gZGVmaW5pdGlvblsxXSxcbiAgICAgICAgICAgIHByb3BlcnRpZXMgPSBkZWZpbml0aW9uWzBdO1xuXG4gICAgICAgIHZhciByZXN1bHQgPSBzY29wZS5zZXR0aW5ncy5kZXNlcmlhbGlzZXIoZGVmaW5pdGlvbik7XG5cbiAgICAgICAgaWYocmVzdWx0KXtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZighdHlwZSl7XG4gICAgICAgICAgICByZXN1bHQgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZih0eXBlID09PSBBUlJBWSl7XG4gICAgICAgICAgICByZXN1bHQgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBpZih0eXBlID09PSBGVU5DVElPTil7XG4gICAgICAgICAgICByZXN1bHQgPSBwcm9wZXJ0aWVzO1xuICAgICAgICB9XG4gICAgICAgIGlmKHR5cGUgPT09IERBVEUpe1xuICAgICAgICAgICAgcmVzdWx0ID0gbmV3IERhdGUocHJvcGVydGllcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihpc0luc3RhbmNlKHJlc3VsdCkpe1xuICAgICAgICAgICAgdG9JbmZsYXRlLnB1c2goW3Jlc3VsdCwgcHJvcGVydGllc10pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5KGNoYW5nZXMpe1xuICAgIHZhciBzY29wZSA9IHRoaXMsXG4gICAgICAgIGluc3RhbmNlSWQgPSBjaGFuZ2VzWzBdLFxuICAgICAgICBpbnN0YW5jZUNoYW5nZXMgPSBjaGFuZ2VzWzFdLFxuICAgICAgICB0b0luZmxhdGUgPSBbXTtcblxuICAgIGluc3RhbmNlQ2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGluc3RhbmNlQ2hhbmdlKXtcbiAgICAgICAgaWYoaW5zdGFuY2VDaGFuZ2VbMV0gPT09IFJFTU9WRUQpe1xuICAgICAgICAgICAgdmFyIGluc3RhbmNlID0gc2NvcGUuZ2V0SW5zdGFuY2UoaW5zdGFuY2VDaGFuZ2VbMF0sIGluc3RhbmNlSWQpO1xuICAgICAgICAgICAgc2NvcGUudHJhY2tlZE1hcC5kZWxldGUoaW5zdGFuY2UpO1xuICAgICAgICAgICAgc2NvcGUucmVtb3ZlSW5zdGFuY2UoaW5zdGFuY2VDaGFuZ2VbMF0sIGluc3RhbmNlSWQpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIGlmKHNjb3BlLmdldEluc3RhbmNlKGluc3RhbmNlQ2hhbmdlWzBdLCBpbnN0YW5jZUlkKSA9PT0gc2NvcGUuc3RhdGUpe1xuICAgICAgICAgICAgICAgIGFwcGx5Um9vdENoYW5nZShzY29wZSwgaW5zdGFuY2VDaGFuZ2VbMV0sIHRvSW5mbGF0ZSk7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICBjcmVhdGVJbnN0YW5jZUluZm8oc2NvcGUsIGluc3RhbmNlQ2hhbmdlWzBdLCBpbnN0YW5jZUlkLCBjcmVhdGVJbnN0YW5jZShzY29wZSwgaW5zdGFuY2VDaGFuZ2VbMV0sIHRvSW5mbGF0ZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICB0b0luZmxhdGUuZm9yRWFjaChmdW5jdGlvbihjaGFuZ2Upe1xuICAgICAgICBpbmZsYXRlRGVmaW5pdGlvbihzY29wZSwgY2hhbmdlWzBdLCBjaGFuZ2VbMV0pO1xuICAgIH0pO1xuXG4gICAgZm9yKHZhciBpID0gMjsgaSA8IGNoYW5nZXMubGVuZ3RoOyBpKyspe1xuICAgICAgICB2YXIgY2hhbmdlID0gY2hhbmdlc1tpXTtcblxuICAgICAgICBpZihjaGFuZ2VbMl0gPT09IFJFTU9WRUQpe1xuICAgICAgICAgICAgZGVsZXRlIHNjb3BlLmdldEluc3RhbmNlKGNoYW5nZVswXSwgaW5zdGFuY2VJZClbY2hhbmdlWzFdXTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBjaGFuZ2VbM107XG5cbiAgICAgICAgICAgIGlmKEFycmF5LmlzQXJyYXkoY2hhbmdlWzNdKSl7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBzY29wZS5nZXRJbnN0YW5jZShjaGFuZ2VbM10sIGluc3RhbmNlSWQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzY29wZS5nZXRJbnN0YW5jZShjaGFuZ2VbMF0sIGluc3RhbmNlSWQpW2NoYW5nZVsxXV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gc2V0SW5zdGFuY2VJZChzY29wZSwgaWQpe1xuICAgIHZhciBvbGRJZCA9IHNjb3BlLmluc3RhbmNlSWQ7XG4gICAgc2NvcGUuaW5zdGFuY2VJZCA9IGlkO1xuICAgIHJldHVybiBzY29wZS5pbnN0YW5jZXNbc2NvcGUuaW5zdGFuY2VJZF0gPSBzY29wZS5pbnN0YW5jZXNbb2xkSWRdIHx8IHt9O1xufVxuXG5mdW5jdGlvbiBnZXRJbnN0YW5jZXMoaW5zdGFuY2VJZCl7XG4gICAgaWYoaW5zdGFuY2VJZCA9IG51bGwpe1xuICAgICAgICBpbnN0YW5jZUlkID0gdGhpcy5pbnN0YW5jZUlkO1xuICAgIH1cblxuICAgIGlmKCEoaW5zdGFuY2VJZCBpbiB0aGlzLmluc3RhbmNlcykpe1xuICAgICAgICB0aGlzLmluc3RhbmNlc1tpbnN0YW5jZUlkXSA9IHt9O1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmluc3RhbmNlc1tpbnN0YW5jZUlkXTtcbn1cblxuZnVuY3Rpb24gZ2V0SW5zdGFuY2VCeUlkKGlkLCBpbnN0YW5jZUlkKXtcbiAgICByZXR1cm4gdGhpcy5nZXRJbnN0YW5jZXMoaW5zdGFuY2VJZClbaWRdO1xufVxuXG5mdW5jdGlvbiBzZXRJbnN0YW5jZUJ5SWQoaWQsIHZhbHVlLCBpbnN0YW5jZUlkKXtcbiAgICB0aGlzLmdldEluc3RhbmNlcyhpbnN0YW5jZUlkKVtpZF0gPSB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlSW5zdGFuY2VCeUlkKGlkLCBpbnN0YW5jZUlkKXtcbiAgICBkZWxldGUgdGhpcy5nZXRJbnN0YW5jZXMoaW5zdGFuY2VJZClbaWRdO1xufVxuXG5mdW5jdGlvbiBkZXNjcmliZShkYXRhKXtcbiAgICBpZihpc0luc3RhbmNlKGRhdGEpKXtcbiAgICAgICAgaWYodGhpcy50cmFja2VkTWFwLmhhcyhkYXRhKSl7XG4gICAgICAgICAgICByZXR1cm4gW3RoaXMuZ2V0SW5zdGFuY2VJZChkYXRhKV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNyZWF0ZUluc3RhbmNlRGVmaW5pdGlvbih0aGlzLCBkYXRhKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGF0YTtcbn1cblxuZnVuY3Rpb24gaW5mbGF0ZShkZXNjcmlwdGlvbil7XG4gICAgdmFyIHNjb3BlID0gdGhpcztcblxuICAgIGlmKEFycmF5LmlzQXJyYXkoZGVzY3JpcHRpb24pICYmIHR5cGVvZiBkZXNjcmlwdGlvblswXSA9PT0gJ3N0cmluZycpe1xuICAgICAgICByZXR1cm4gc2NvcGUuZ2V0SW5zdGFuY2UoZGVzY3JpcHRpb25bMF0pO1xuICAgIH1cblxuICAgIGlmKGlzSW5zdGFuY2UoZGVzY3JpcHRpb24pKXtcbiAgICAgICAgdmFyIHRvSW5mbGF0ZSA9IFtdO1xuXG4gICAgICAgIHZhciByZXN1bHQgPSBjcmVhdGVJbnN0YW5jZShzY29wZSwgZGVzY3JpcHRpb24sIHRvSW5mbGF0ZSk7XG5cbiAgICAgICAgdG9JbmZsYXRlLmZvckVhY2goZnVuY3Rpb24oY2hhbmdlKXtcbiAgICAgICAgICAgIGluZmxhdGVEZWZpbml0aW9uKHNjb3BlLCBjaGFuZ2VbMF0sIGNoYW5nZVsxXSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlc2NyaXB0aW9uO1xufVxuXG5mdW5jdGlvbiB2aXNjb3VzKHN0YXRlLCBzZXR0aW5ncyl7XG4gICAgaWYoIXNldHRpbmdzKXtcbiAgICAgICAgc2V0dGluZ3MgPSB7XG4gICAgICAgICAgICBzZXJpYWxpc2VyOiBmdW5jdGlvbigpe30sXG4gICAgICAgICAgICBkZXNlcmlhbGlzZXI6IGZ1bmN0aW9uKCl7fVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHZhciB2aXNjb3VzID0ge307XG5cbiAgICB2YXIgc2NvcGUgPSB7XG4gICAgICAgIG5leHRDaGFuZ2U6IFtdLFxuICAgICAgICBjdXJyZW50SW5zdGFuY2VzOiBuZXcgU2V0KCksXG4gICAgICAgIHNldHRpbmdzOiBzZXR0aW5ncyxcbiAgICAgICAgdmlzY291czogdmlzY291cyxcbiAgICAgICAgY3VycmVudElkOiAwLFxuICAgICAgICBzdGF0ZTogc3RhdGUgfHwge30sXG4gICAgICAgIHRyYWNrZWRNYXA6IG5ldyBXZWFrTWFwKCksXG4gICAgICAgIGluc3RhbmNlczoge31cbiAgICB9O1xuXG4gICAgLy8gU2NvcGUgYm91bmQgZm9yIHBlcmYuXG4gICAgc2NvcGUuZ2V0Q3VycmVudENoYW5nZXMgPSBnZXRDdXJyZW50Q2hhbmdlcy5iaW5kKHNjb3BlKTtcbiAgICBzY29wZS5nZXRDdXJyZW50Q2hhbmdlID0gZ2V0Q3VycmVudENoYW5nZS5iaW5kKHNjb3BlKTtcbiAgICBzY29wZS5nZXRSZW1vdmVkQ2hhbmdlcyA9IGdldFJlbW92ZWRDaGFuZ2VzLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmdldFJlbW92ZWRDaGFuZ2UgPSBnZXRSZW1vdmVkQ2hhbmdlLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmdldE9iamVjdENoYW5nZXMgPSBnZXRPYmplY3RDaGFuZ2VzLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmdldEluc3RhbmNlcyA9IGdldEluc3RhbmNlcy5iaW5kKHNjb3BlKTtcbiAgICBzY29wZS5nZXRJbnN0YW5jZSA9IGdldEluc3RhbmNlQnlJZC5iaW5kKHNjb3BlKTtcbiAgICBzY29wZS5zZXRJbnN0YW5jZSA9IHNldEluc3RhbmNlQnlJZC5iaW5kKHNjb3BlKTtcbiAgICBzY29wZS5yZW1vdmVJbnN0YW5jZSA9IHJlbW92ZUluc3RhbmNlQnlJZC5iaW5kKHNjb3BlKTtcbiAgICBzY29wZS5nZXRJbnN0YW5jZUlkID0gZ2V0SW5zdGFuY2VJZC5iaW5kKHNjb3BlKTtcbiAgICBzY29wZS5jaGFuZ2VzID0gY2hhbmdlcy5iaW5kKHNjb3BlKTtcblxuICAgIHNjb3BlLmdldElkID0gZ2V0SWQuYmluZChzY29wZSk7XG4gICAgc2NvcGUuY3JlYXRlSWQgPSBjcmVhdGVJZC5iaW5kKHNjb3BlKTtcblxuICAgIHZpc2NvdXMuY2hhbmdlcyA9IHNjb3BlLmNoYW5nZXM7XG4gICAgdmlzY291cy5hcHBseSA9IGFwcGx5LmJpbmQoc2NvcGUpO1xuICAgIHZpc2NvdXMuc3RhdGUgPSBnZXRTdGF0ZS5iaW5kKHNjb3BlKTtcbiAgICB2aXNjb3VzLmdldElkID0gc2NvcGUuZ2V0SW5zdGFuY2VJZDtcbiAgICB2aXNjb3VzLmdldEluc3RhbmNlID0gc2NvcGUuZ2V0SW5zdGFuY2U7XG4gICAgdmlzY291cy5kZXNjcmliZSA9IGRlc2NyaWJlLmJpbmQoc2NvcGUpO1xuICAgIHZpc2NvdXMuaW5mbGF0ZSA9IGluZmxhdGUuYmluZChzY29wZSk7XG5cbiAgICBzZXRJbnN0YW5jZUlkKHNjb3BlLCBwYXJzZUludChNYXRoLnJhbmRvbSgpICogTWF0aC5wb3coMzYsMikpLnRvU3RyaW5nKDM2KSk7XG5cbiAgICB2aXNjb3VzLmNoYW5nZXMoKTtcblxuICAgIHJldHVybiB2aXNjb3VzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHZpc2NvdXM7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzU2FtZShhLCBiKXtcbiAgICBpZihhID09PSBiKXtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYoXG4gICAgICAgIHR5cGVvZiBhICE9PSB0eXBlb2YgYiB8fFxuICAgICAgICB0eXBlb2YgYSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgIShhIGluc3RhbmNlb2YgRGF0ZSAmJiBiIGluc3RhbmNlb2YgRGF0ZSlcbiAgICApe1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIFN0cmluZyhhKSA9PT0gU3RyaW5nKGIpO1xufTsiXX0=
