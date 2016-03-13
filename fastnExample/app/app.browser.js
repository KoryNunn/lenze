(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var cpjax = require('cpjax'),
    EventEmitter = require('events'),
    app = new EventEmitter(),
    lenze = require('../../')(app, {
        changeInterval: 16,
        send: function(data){
            console.log(data);
            self.postMessage(data);
        },
        receive: function(callback){
            self.addEventListener('message', function(message){
                console.log(message.data);
                callback(message.data);
            });
        }
    });

function updateUsers(){
    app.visibleUsers = app.users && app.users.filter(function(user){
        return ~user.name.indexOf(app.search || '');
    });
};

app.setSearch = function(value){
    app.search = value;
    updateUsers();
};

cpjax({
    url: 'users.json',
    dataType: 'json'
}, function(error, data){
    if(error){
        return;
    }

    app.users = data.map(function(user){
        user.logName = function(){
            console.log(user.name);
        };
        user.dob = new Date(1930 + (Math.random() * 90), 1, 1);
        return user;
    });

    updateUsers();
});
},{"../../":2,"cpjax":3,"events":9}],2:[function(require,module,exports){
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

function serialise(scope, value){
    if(typeof value === 'function'){
        var result = {};

        for(var key in value){
            result[key] = value[key];
        }

        return [result, LENZE_FUNCTION];
    }
}

function deserialise(scope, definition){
    if(definition[1] === LENZE_FUNCTION){
        var value = definition[0],
            result = function(){
                scope.invoke.apply(null, [scope.viscous.getId(result)].concat(Array.prototype.slice.call(arguments)));
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
        serialiser: shuv(serialise, scope),
        deserialiser: shuv(deserialise, scope)
    });

    scope.lenze.update = shuv(update, scope);
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

    setInterval(scope.lenze.update, settings.changeInterval || 100);

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

        if(message.type === STATE || message.type === CONNECT){
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

},{"events":9,"shuv":6,"viscous":7}],3:[function(require,module,exports){
var Ajax = require('simple-ajax');

module.exports = function(settings, callback){
    if(typeof settings === 'string'){
        settings = {
            url: settings
        };
    }

    if(typeof settings !== 'object'){
        throw 'settings must be a string or object';
    }

    if(typeof callback !== 'function'){
        throw 'cpjax must be passed a callback as the second parameter';
    }

    var ajax = new Ajax(settings);

    ajax.on('success', function(event, data) {
        callback(null, data, event);
    });
    ajax.on('error', function(event) {
        callback(new Error(event.target.responseText), null, event);
    });

    ajax.send();

    return ajax;
};
},{"simple-ajax":4}],4:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter,
    queryString = require('query-string');

function tryParseJson(data){
    try{
        return JSON.parse(data);
    }catch(error){
        return error;
    }
}

function timeout(){
   this.request.abort();
   this.emit('timeout');
}

function Ajax(settings){
    var queryStringData,
        ajax = this;

    if(typeof settings === 'string'){
        settings = {
            url: settings
        };
    }

    if(typeof settings !== 'object'){
        settings = {};
    }

    ajax.settings = settings;
    ajax.request = new XMLHttpRequest();
    ajax.settings.method = ajax.settings.method || 'get';

    if(ajax.settings.cors){
        if ('withCredentials' in ajax.request) {
            ajax.request.withCredentials = !!settings.withCredentials;
        } else if (typeof XDomainRequest !== 'undefined') {
            // XDomainRequest only exists in IE, and is IE's way of making CORS requests.
            ajax.request = new XDomainRequest();
        } else {
            // Otherwise, CORS is not supported by the browser.
            ajax.emit('error', new Error('Cors is not supported by this browser'));
        }
    }

    if(ajax.settings.cache === false){
        ajax.settings.data = ajax.settings.data || {};
        ajax.settings.data._ = new Date().getTime();
    }

    if(ajax.settings.method.toLowerCase() === 'get' && typeof ajax.settings.data === 'object'){
        var urlParts = ajax.settings.url.split('?');

        queryStringData = queryString.parse(urlParts[1]);

        for(var key in ajax.settings.data){
            queryStringData[key] = ajax.settings.data[key];
        }

        ajax.settings.url = urlParts[0] + '?' + queryString.stringify(queryStringData);
        ajax.settings.data = null;
    }

    ajax.request.addEventListener('progress', function(event){
        ajax.emit('progress', event);
    }, false);

    ajax.request.addEventListener('load', function(event){
        var data = event.target.responseText;

        if(ajax.settings.dataType && ajax.settings.dataType.toLowerCase() === 'json'){
            if(data === ''){
                data = undefined;
            }else{
                data = tryParseJson(data);
                if(data instanceof Error){
                    ajax.emit('error', event, data);
                    return;
                }
            }
        }

        if(event.target.status >= 400){
            ajax.emit('error', event, data);
        } else {
            ajax.emit('success', event, data);
        }

    }, false);

    ajax.request.addEventListener('error', function(event){
        ajax.emit('error', event);
    }, false);

    ajax.request.addEventListener('abort', function(event){
        ajax.emit('error', event, new Error('Connection Aborted'));
        ajax.emit('abort', event);
    }, false);

    ajax.request.addEventListener('loadend', function(event){
        clearTimeout(this._requestTimeout);
        ajax.emit('complete', event);
    }, false);

    ajax.request.open(ajax.settings.method || 'get', ajax.settings.url, true);

    // Set default headers
    if(ajax.settings.contentType !== false){
        ajax.request.setRequestHeader('Content-Type', ajax.settings.contentType || 'application/json; charset=utf-8');
    }
    if(ajax.settings.requestedWith !== false) {
        ajax.request.setRequestHeader('X-Requested-With', ajax.settings.requestedWith || 'XMLHttpRequest');
    }
    if(ajax.settings.auth){
        ajax.request.setRequestHeader('Authorization', ajax.settings.auth);
    }

    // Set custom headers
    for(var headerKey in ajax.settings.headers){
        ajax.request.setRequestHeader(headerKey, ajax.settings.headers[headerKey]);
    }

    if(ajax.settings.processData !== false && ajax.settings.dataType === 'json'){
        ajax.settings.data = JSON.stringify(ajax.settings.data);
    }
}

Ajax.prototype = Object.create(EventEmitter.prototype);

Ajax.prototype.send = function(){
    this._requestTimeout = setTimeout(
        timeout.bind(this),
        this.settings.timeout || 120000
    );
    this.request.send(this.settings.data && this.settings.data);
};

module.exports = Ajax;

},{"events":9,"query-string":5}],5:[function(require,module,exports){
/*!
	query-string
	Parse and stringify URL query strings
	https://github.com/sindresorhus/query-string
	by Sindre Sorhus
	MIT License
*/
(function () {
	'use strict';
	var queryString = {};

	queryString.parse = function (str) {
		if (typeof str !== 'string') {
			return {};
		}

		str = str.trim().replace(/^(\?|#)/, '');

		if (!str) {
			return {};
		}

		return str.trim().split('&').reduce(function (ret, param) {
			var parts = param.replace(/\+/g, ' ').split('=');
			var key = parts[0];
			var val = parts[1];

			key = decodeURIComponent(key);
			// missing `=` should be `null`:
			// http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
			val = val === undefined ? null : decodeURIComponent(val);

			if (!ret.hasOwnProperty(key)) {
				ret[key] = val;
			} else if (Array.isArray(ret[key])) {
				ret[key].push(val);
			} else {
				ret[key] = [ret[key], val];
			}

			return ret;
		}, {});
	};

	queryString.stringify = function (obj) {
		return obj ? Object.keys(obj).map(function (key) {
			var val = obj[key];

			if (Array.isArray(val)) {
				return val.map(function (val2) {
					return encodeURIComponent(key) + '=' + encodeURIComponent(val2);
				}).join('&');
			}

			return encodeURIComponent(key) + '=' + encodeURIComponent(val);
		}).join('&') : '';
	};

	if (typeof define === 'function' && define.amd) {
		define(function() { return queryString; });
	} else if (typeof module !== 'undefined' && module.exports) {
		module.exports = queryString;
	} else {
		self.queryString = queryString;
	}
})();

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
var same = require('same-value');

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

function createInstanceInfo(scope, id, value){
    var lastInfo = {
            id: id,
            instance: value,
            lastState: {},
            occurances: false
        };

    scope.instances[lastInfo.id] = value;
    scope.trackedMap.set(value, lastInfo);

    return lastInfo;
}

function getInstanceInfo(scope, value){
    if(!isInstance(value)){
        return;
    }

    var lastInfo = scope.trackedMap.get(value);

    if(!lastInfo){
        lastInfo = createInstanceInfo(scope, scope.getId(), value);
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
        changes.push([lastInfo.id, oldKey, REMOVED]);

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
    var type = currentKey in lastInfo.lastState ? EDITED : ADDED,
        oldValue = lastInfo.lastState[currentKey],
        currentValue = object[currentKey],
        change = [lastInfo.id, currentKey, type],
        changed = !same(oldValue, currentValue);

    if(changed){
        if(isInstance(oldValue) && scope.trackedMap.has(oldValue)){
            objectRemovedChanges(scope, oldValue);
        }

    }else if(type === 'a'){ // Previously no key, now key, but value is undefined.
        changes.push(change);
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

    for(var key in instance){
        var id = scope.viscous.getId(instance[key]);
        result[0][key] = id ? [id] : instance[key];
    }

    return result;
}

function getObjectChanges(scope, object, scanned){
    if(scanned.has(object)){
        return;
    }
    scanned.add(object);

    var lastInfo = getInstanceInfo(scope, object),
        newKeys,
        removedKeys,
        instanceChanges = [];


    var isNew = lastInfo.occurances === false && object !== scope.state;

    if(isNew){
        lastInfo.occurances = 0;
    }

    var changes = [];
    getRemovedChanges(scope, changes, lastInfo, object);
    getCurrentChanges(scope, changes, lastInfo, object, scanned, instanceChanges);

    if(isNew){
        instanceChanges.push([lastInfo.id, createInstanceDefinition(scope, object)]);
    }

    return {
        instanceChanges: instanceChanges,
        changes: changes
    };
}

function changes(){
    var scope = this,
        result = getObjectChanges(scope, scope.state, new WeakSet());

    var instanceChanges = Object.keys(scope.instances).reduce(function(changes, key){
        var instance = scope.instances[key],
            itemInfo = scope.trackedMap.get(instance);

        if(instance !== scope.state && !itemInfo.occurances){
            scope.trackedMap.delete(instance);
            delete scope.instances[itemInfo.id];
            changes.push([itemInfo.id, REMOVED]);
        }

        return changes;
    }, []);

    return [result.instanceChanges.concat(instanceChanges)].concat(result.changes);
}

function getState(){
    var scope = this;

    scope.viscous.changes();

    return [Object.keys(scope.instances).reverse().map(function(key){
        return [key, createInstanceDefinition(scope, scope.instances[key])];
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

function inflateDefinition(scope, definition){
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

        if(result){
            for(var key in properties){
                if(Array.isArray(properties[key])){
                    result[key] = scope.viscous.getInstance(properties[key]);
                }
            }
        }

        return result;
    }
}

function apply(changes){
    var scope = this,
        instanceChanges = changes[0];

    instanceChanges.forEach(function(instanceChange){
        if(instanceChange[1] === REMOVED){
            var instance = scope.instances[instanceChange[0]];
            scope.trackedMap.delete(instance);
            delete scope.instances[instanceChange[0]];
        }else{
            if(scope.instances[instanceChange[0]] === scope.state){
                applyRootChange(scope, inflateDefinition(scope, instanceChange[1]));
            }else{
                createInstanceInfo(scope, instanceChange[0], inflateDefinition(scope, instanceChange[1]));
            }
        }
    });

    for(var i = 1; i < changes.length; i++){
        var change = changes[i];

        if(change[2] === REMOVED){
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

function viscous(state, settings){
    if(!settings){
        settings = {
            serialiser: function(){},
            deserialiser: function(){}
        };
    }

    var viscous = {};

    var scope = {
        settings: settings,
        viscous: viscous,
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

},{"same-value":8}],8:[function(require,module,exports){
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
},{}],9:[function(require,module,exports){
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
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

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
    var m;
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
  } else {
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

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
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

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Vzci9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJmYXN0bkV4YW1wbGUvYXBwL2FwcC5qcyIsImluZGV4LmpzIiwibm9kZV9tb2R1bGVzL2NwamF4L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2NwamF4L25vZGVfbW9kdWxlcy9zaW1wbGUtYWpheC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jcGpheC9ub2RlX21vZHVsZXMvc2ltcGxlLWFqYXgvbm9kZV9tb2R1bGVzL3F1ZXJ5LXN0cmluZy9xdWVyeS1zdHJpbmcuanMiLCJub2RlX21vZHVsZXMvc2h1di9pbmRleC5qcyIsIi4uL3Zpc2NvdXMvaW5kZXguanMiLCIuLi92aXNjb3VzL25vZGVfbW9kdWxlcy9zYW1lLXZhbHVlL2luZGV4LmpzIiwiLi4vLi4vLi4vLi4vdXNyL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwidmFyIGNwamF4ID0gcmVxdWlyZSgnY3BqYXgnKSxcbiAgICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICBhcHAgPSBuZXcgRXZlbnRFbWl0dGVyKCksXG4gICAgbGVuemUgPSByZXF1aXJlKCcuLi8uLi8nKShhcHAsIHtcbiAgICAgICAgY2hhbmdlSW50ZXJ2YWw6IDE2LFxuICAgICAgICBzZW5kOiBmdW5jdGlvbihkYXRhKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuICAgICAgICAgICAgc2VsZi5wb3N0TWVzc2FnZShkYXRhKTtcbiAgICAgICAgfSxcbiAgICAgICAgcmVjZWl2ZTogZnVuY3Rpb24oY2FsbGJhY2spe1xuICAgICAgICAgICAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24obWVzc2FnZSl7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cobWVzc2FnZS5kYXRhKTtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhtZXNzYWdlLmRhdGEpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuZnVuY3Rpb24gdXBkYXRlVXNlcnMoKXtcbiAgICBhcHAudmlzaWJsZVVzZXJzID0gYXBwLnVzZXJzICYmIGFwcC51c2Vycy5maWx0ZXIoZnVuY3Rpb24odXNlcil7XG4gICAgICAgIHJldHVybiB+dXNlci5uYW1lLmluZGV4T2YoYXBwLnNlYXJjaCB8fCAnJyk7XG4gICAgfSk7XG59O1xuXG5hcHAuc2V0U2VhcmNoID0gZnVuY3Rpb24odmFsdWUpe1xuICAgIGFwcC5zZWFyY2ggPSB2YWx1ZTtcbiAgICB1cGRhdGVVc2VycygpO1xufTtcblxuY3BqYXgoe1xuICAgIHVybDogJ3VzZXJzLmpzb24nLFxuICAgIGRhdGFUeXBlOiAnanNvbidcbn0sIGZ1bmN0aW9uKGVycm9yLCBkYXRhKXtcbiAgICBpZihlcnJvcil7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBhcHAudXNlcnMgPSBkYXRhLm1hcChmdW5jdGlvbih1c2VyKXtcbiAgICAgICAgdXNlci5sb2dOYW1lID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHVzZXIubmFtZSk7XG4gICAgICAgIH07XG4gICAgICAgIHVzZXIuZG9iID0gbmV3IERhdGUoMTkzMCArIChNYXRoLnJhbmRvbSgpICogOTApLCAxLCAxKTtcbiAgICAgICAgcmV0dXJuIHVzZXI7XG4gICAgfSk7XG5cbiAgICB1cGRhdGVVc2VycygpO1xufSk7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHZpc2NvdXMgPSByZXF1aXJlKCd2aXNjb3VzJyksXG4gICAgc2h1diA9IHJlcXVpcmUoJ3NodXYnKTtcblxudmFyIElOVk9LRSA9ICdpJztcbnZhciBDSEFOR0VTID0gJ2MnO1xudmFyIENPTk5FQ1QgPSAnbyc7XG52YXIgU1RBVEUgPSAncyc7XG52YXIgTEVOWkVfRlVOQ1RJT04gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4MTkyKTtcblxuZnVuY3Rpb24gY3JlYXRlQ2hhbmdlcyhzY29wZSwgY2hhbmdlcyl7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGNoYW5nZXMpO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlQ2hhbmdlcyhzY29wZSwgZGF0YSl7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTWVzc2FnZShkYXRhKXtcbiAgICB2YXIgbWVzc2FnZSA9IGRhdGEubWF0Y2goL14oXFx3Kz8pXFw6KC4qKS8pO1xuXG4gICAgaWYobWVzc2FnZSl7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBtZXNzYWdlWzFdLFxuICAgICAgICAgICAgZGF0YTogbWVzc2FnZVsyXVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZWNlaXZlKHNjb3BlLCBkYXRhKXtcbiAgICB2YXIgbWVzc2FnZSA9IHBhcnNlTWVzc2FnZShkYXRhKTtcblxuICAgIGlmKCFtZXNzYWdlKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmKG1lc3NhZ2UudHlwZSA9PT0gSU5WT0tFKXtcbiAgICAgICAgc2NvcGUuaGFuZGxlRnVuY3Rpb24uYXBwbHkobnVsbCwgSlNPTi5wYXJzZShtZXNzYWdlLmRhdGEpKTtcbiAgICB9XG5cbiAgICBpZihtZXNzYWdlLnR5cGUgPT09IENPTk5FQ1Qpe1xuICAgICAgICBzY29wZS5zZW5kKENPTk5FQ1QsIHNjb3BlLnZpc2NvdXMuc3RhdGUoKSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB1cGRhdGUoc2NvcGUpe1xuICAgIHZhciBjaGFuZ2VzID0gc2NvcGUudmlzY291cy5jaGFuZ2VzKCk7XG5cbiAgICBpZihjaGFuZ2VzLmxlbmd0aCA+IDEpe1xuICAgICAgICBzY29wZS5sZW56ZS5lbWl0KCdjaGFuZ2UnLCBjaGFuZ2VzKTtcblxuICAgICAgICBpZihzY29wZS5zZW5kKXtcbiAgICAgICAgICAgIHNjb3BlLnNlbmQoQ0hBTkdFUywgY2hhbmdlcyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZUZ1bmN0aW9uKHNjb3BlLCBpZCl7XG4gICAgc2NvcGUudmlzY291cy5nZXRJbnN0YW5jZShpZCkuYXBwbHkodGhpcywgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSk7XG59XG5cbmZ1bmN0aW9uIHNlbmQoc2NvcGUsIHNlbmQsIHR5cGUsIGRhdGEpe1xuICAgIGlmKHR5cGUgPT09IENIQU5HRVMgfHwgdHlwZSA9PT0gQ09OTkVDVCl7XG4gICAgICAgIHNlbmQodHlwZSArICc6JyArIGNyZWF0ZUNoYW5nZXMoc2NvcGUsIGRhdGEpKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNlbmRJbnZva2Uoc2NvcGUsIHNlbmRJbnZva2Upe1xuICAgIHNlbmRJbnZva2UoSU5WT0tFICsgJzonICsgSlNPTi5zdHJpbmdpZnkoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSkpO1xufVxuXG5mdW5jdGlvbiBnZXRDaGFuZ2VJbmZvKHNjb3BlLCBjaGFuZ2Upe1xuICAgIHJldHVybiB7XG4gICAgICAgIHRhcmdldDogc2NvcGUudmlzY291cy5nZXRJbnN0YW5jZShjaGFuZ2VbMF0pLFxuICAgICAgICBrZXk6IGNoYW5nZVsxXSxcbiAgICAgICAgdHlwZTogY2hhbmdlWzJdLFxuICAgICAgICB2YWx1ZTogQXJyYXkuaXNBcnJheShjaGFuZ2VbM10pID8gc2NvcGUudmlzY291cy5nZXRJbnN0YW5jZShjaGFuZ2VbM10pIDogY2hhbmdlWzNdXG4gICAgfTtcbn1cblxuZnVuY3Rpb24gc2VyaWFsaXNlKHNjb3BlLCB2YWx1ZSl7XG4gICAgaWYodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHt9O1xuXG4gICAgICAgIGZvcih2YXIga2V5IGluIHZhbHVlKXtcbiAgICAgICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWVba2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBbcmVzdWx0LCBMRU5aRV9GVU5DVElPTl07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkZXNlcmlhbGlzZShzY29wZSwgZGVmaW5pdGlvbil7XG4gICAgaWYoZGVmaW5pdGlvblsxXSA9PT0gTEVOWkVfRlVOQ1RJT04pe1xuICAgICAgICB2YXIgdmFsdWUgPSBkZWZpbml0aW9uWzBdLFxuICAgICAgICAgICAgcmVzdWx0ID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICBzY29wZS5pbnZva2UuYXBwbHkobnVsbCwgW3Njb3BlLnZpc2NvdXMuZ2V0SWQocmVzdWx0KV0uY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgZm9yKHZhciBrZXkgaW4gdmFsdWUpe1xuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZVtrZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGluaXRTY29wZShzdGF0ZSwgc2V0dGluZ3Mpe1xuXG4gICAgaWYoIXNldHRpbmdzKXtcbiAgICAgICAgc2V0dGluZ3MgPSB7fTtcbiAgICB9XG5cbiAgICB2YXIgc3RhdGUgPSBzdGF0ZSB8fCB7fTtcblxuICAgIHZhciBzY29wZSA9IHt9O1xuXG4gICAgc2NvcGUubGVuemUgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG4gICAgc2NvcGUudmlzY291cyA9IHZpc2NvdXMoc3RhdGUsIHtcbiAgICAgICAgc2VyaWFsaXNlcjogc2h1dihzZXJpYWxpc2UsIHNjb3BlKSxcbiAgICAgICAgZGVzZXJpYWxpc2VyOiBzaHV2KGRlc2VyaWFsaXNlLCBzY29wZSlcbiAgICB9KTtcblxuICAgIHNjb3BlLmxlbnplLnVwZGF0ZSA9IHNodXYodXBkYXRlLCBzY29wZSk7XG4gICAgc2NvcGUubGVuemUuZ2V0Q2hhbmdlSW5mbyA9IHNodXYoZ2V0Q2hhbmdlSW5mbywgc2NvcGUpO1xuICAgIHNjb3BlLmxlbnplLnN0YXRlID0gc3RhdGU7XG5cbiAgICByZXR1cm4gc2NvcGU7XG59XG5cbmZ1bmN0aW9uIGluaXQoc3RhdGUsIHNldHRpbmdzKXtcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoIDwgMil7XG4gICAgICAgIHNldHRpbmdzID0gc3RhdGU7XG4gICAgICAgIHN0YXRlID0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgc2NvcGUgPSBpbml0U2NvcGUoc3RhdGUsIHNldHRpbmdzKTtcblxuICAgIHNjb3BlLmhhbmRsZUZ1bmN0aW9uID0gc2h1dihoYW5kbGVGdW5jdGlvbiwgc2NvcGUpO1xuICAgIHNjb3BlLnNlbmQgPSBzaHV2KHNlbmQsIHNjb3BlLCBzZXR0aW5ncy5zZW5kKTtcbiAgICBzZXR0aW5ncy5yZWNlaXZlKHNodXYocmVjZWl2ZSwgc2NvcGUpKTtcblxuICAgIHNldEludGVydmFsKHNjb3BlLmxlbnplLnVwZGF0ZSwgc2V0dGluZ3MuY2hhbmdlSW50ZXJ2YWwgfHwgMTAwKTtcblxuICAgIHJldHVybiBzY29wZS5sZW56ZTtcbn1cblxuZnVuY3Rpb24gcmVwbGljYW50KHN0YXRlLCBzZXR0aW5ncyl7XG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA8IDIpe1xuICAgICAgICBzZXR0aW5ncyA9IHN0YXRlO1xuICAgICAgICBzdGF0ZSA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHNjb3BlID0gaW5pdFNjb3BlKHN0YXRlKTtcblxuICAgIHNjb3BlLmluc3RhbmNlSGFzaCA9IHt9O1xuXG4gICAgc2V0dGluZ3MucmVjZWl2ZShmdW5jdGlvbihkYXRhKXtcbiAgICAgICAgaWYoIXNjb3BlLnJlYWR5KXtcbiAgICAgICAgICAgIHNjb3BlLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHNjb3BlLmxlbnplLmVtaXQoJ3JlYWR5Jyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbWVzc2FnZSA9IHBhcnNlTWVzc2FnZShkYXRhKTtcblxuICAgICAgICBpZighbWVzc2FnZSl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZihtZXNzYWdlLnR5cGUgPT09IFNUQVRFIHx8IG1lc3NhZ2UudHlwZSA9PT0gQ09OTkVDVCl7XG4gICAgICAgICAgICBzY29wZS52aXNjb3VzLmFwcGx5KGluZmxhdGVDaGFuZ2VzKHNjb3BlLCBtZXNzYWdlLmRhdGEpKTtcbiAgICAgICAgICAgIHVwZGF0ZShzY29wZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihtZXNzYWdlLnR5cGUgPT09IENIQU5HRVMpe1xuICAgICAgICAgICAgc2NvcGUudmlzY291cy5hcHBseShpbmZsYXRlQ2hhbmdlcyhzY29wZSwgbWVzc2FnZS5kYXRhKSk7XG4gICAgICAgICAgICB1cGRhdGUoc2NvcGUpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBzY29wZS5pbnZva2UgPSBzaHV2KHNlbmRJbnZva2UsIHNjb3BlLCBzZXR0aW5ncy5zZW5kKTtcblxuICAgIHNldHRpbmdzLnNlbmQoQ09OTkVDVCArICc6Jyk7XG5cbiAgICByZXR1cm4gc2NvcGUubGVuemVcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xubW9kdWxlLmV4cG9ydHMucmVwbGljYW50ID0gcmVwbGljYW50O1xuIiwidmFyIEFqYXggPSByZXF1aXJlKCdzaW1wbGUtYWpheCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHNldHRpbmdzLCBjYWxsYmFjayl7XG4gICAgaWYodHlwZW9mIHNldHRpbmdzID09PSAnc3RyaW5nJyl7XG4gICAgICAgIHNldHRpbmdzID0ge1xuICAgICAgICAgICAgdXJsOiBzZXR0aW5nc1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGlmKHR5cGVvZiBzZXR0aW5ncyAhPT0gJ29iamVjdCcpe1xuICAgICAgICB0aHJvdyAnc2V0dGluZ3MgbXVzdCBiZSBhIHN0cmluZyBvciBvYmplY3QnO1xuICAgIH1cblxuICAgIGlmKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJyl7XG4gICAgICAgIHRocm93ICdjcGpheCBtdXN0IGJlIHBhc3NlZCBhIGNhbGxiYWNrIGFzIHRoZSBzZWNvbmQgcGFyYW1ldGVyJztcbiAgICB9XG5cbiAgICB2YXIgYWpheCA9IG5ldyBBamF4KHNldHRpbmdzKTtcblxuICAgIGFqYXgub24oJ3N1Y2Nlc3MnLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBkYXRhLCBldmVudCk7XG4gICAgfSk7XG4gICAgYWpheC5vbignZXJyb3InLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBjYWxsYmFjayhuZXcgRXJyb3IoZXZlbnQudGFyZ2V0LnJlc3BvbnNlVGV4dCksIG51bGwsIGV2ZW50KTtcbiAgICB9KTtcblxuICAgIGFqYXguc2VuZCgpO1xuXG4gICAgcmV0dXJuIGFqYXg7XG59OyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXG4gICAgcXVlcnlTdHJpbmcgPSByZXF1aXJlKCdxdWVyeS1zdHJpbmcnKTtcblxuZnVuY3Rpb24gdHJ5UGFyc2VKc29uKGRhdGEpe1xuICAgIHRyeXtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG4gICAgfWNhdGNoKGVycm9yKXtcbiAgICAgICAgcmV0dXJuIGVycm9yO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdGltZW91dCgpe1xuICAgdGhpcy5yZXF1ZXN0LmFib3J0KCk7XG4gICB0aGlzLmVtaXQoJ3RpbWVvdXQnKTtcbn1cblxuZnVuY3Rpb24gQWpheChzZXR0aW5ncyl7XG4gICAgdmFyIHF1ZXJ5U3RyaW5nRGF0YSxcbiAgICAgICAgYWpheCA9IHRoaXM7XG5cbiAgICBpZih0eXBlb2Ygc2V0dGluZ3MgPT09ICdzdHJpbmcnKXtcbiAgICAgICAgc2V0dGluZ3MgPSB7XG4gICAgICAgICAgICB1cmw6IHNldHRpbmdzXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgaWYodHlwZW9mIHNldHRpbmdzICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHNldHRpbmdzID0ge307XG4gICAgfVxuXG4gICAgYWpheC5zZXR0aW5ncyA9IHNldHRpbmdzO1xuICAgIGFqYXgucmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIGFqYXguc2V0dGluZ3MubWV0aG9kID0gYWpheC5zZXR0aW5ncy5tZXRob2QgfHwgJ2dldCc7XG5cbiAgICBpZihhamF4LnNldHRpbmdzLmNvcnMpe1xuICAgICAgICBpZiAoJ3dpdGhDcmVkZW50aWFscycgaW4gYWpheC5yZXF1ZXN0KSB7XG4gICAgICAgICAgICBhamF4LnJlcXVlc3Qud2l0aENyZWRlbnRpYWxzID0gISFzZXR0aW5ncy53aXRoQ3JlZGVudGlhbHM7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIFhEb21haW5SZXF1ZXN0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgLy8gWERvbWFpblJlcXVlc3Qgb25seSBleGlzdHMgaW4gSUUsIGFuZCBpcyBJRSdzIHdheSBvZiBtYWtpbmcgQ09SUyByZXF1ZXN0cy5cbiAgICAgICAgICAgIGFqYXgucmVxdWVzdCA9IG5ldyBYRG9tYWluUmVxdWVzdCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCBDT1JTIGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhlIGJyb3dzZXIuXG4gICAgICAgICAgICBhamF4LmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdDb3JzIGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBicm93c2VyJykpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYoYWpheC5zZXR0aW5ncy5jYWNoZSA9PT0gZmFsc2Upe1xuICAgICAgICBhamF4LnNldHRpbmdzLmRhdGEgPSBhamF4LnNldHRpbmdzLmRhdGEgfHwge307XG4gICAgICAgIGFqYXguc2V0dGluZ3MuZGF0YS5fID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgfVxuXG4gICAgaWYoYWpheC5zZXR0aW5ncy5tZXRob2QudG9Mb3dlckNhc2UoKSA9PT0gJ2dldCcgJiYgdHlwZW9mIGFqYXguc2V0dGluZ3MuZGF0YSA9PT0gJ29iamVjdCcpe1xuICAgICAgICB2YXIgdXJsUGFydHMgPSBhamF4LnNldHRpbmdzLnVybC5zcGxpdCgnPycpO1xuXG4gICAgICAgIHF1ZXJ5U3RyaW5nRGF0YSA9IHF1ZXJ5U3RyaW5nLnBhcnNlKHVybFBhcnRzWzFdKTtcblxuICAgICAgICBmb3IodmFyIGtleSBpbiBhamF4LnNldHRpbmdzLmRhdGEpe1xuICAgICAgICAgICAgcXVlcnlTdHJpbmdEYXRhW2tleV0gPSBhamF4LnNldHRpbmdzLmRhdGFba2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFqYXguc2V0dGluZ3MudXJsID0gdXJsUGFydHNbMF0gKyAnPycgKyBxdWVyeVN0cmluZy5zdHJpbmdpZnkocXVlcnlTdHJpbmdEYXRhKTtcbiAgICAgICAgYWpheC5zZXR0aW5ncy5kYXRhID0gbnVsbDtcbiAgICB9XG5cbiAgICBhamF4LnJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcigncHJvZ3Jlc3MnLCBmdW5jdGlvbihldmVudCl7XG4gICAgICAgIGFqYXguZW1pdCgncHJvZ3Jlc3MnLCBldmVudCk7XG4gICAgfSwgZmFsc2UpO1xuXG4gICAgYWpheC5yZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbihldmVudCl7XG4gICAgICAgIHZhciBkYXRhID0gZXZlbnQudGFyZ2V0LnJlc3BvbnNlVGV4dDtcblxuICAgICAgICBpZihhamF4LnNldHRpbmdzLmRhdGFUeXBlICYmIGFqYXguc2V0dGluZ3MuZGF0YVR5cGUudG9Mb3dlckNhc2UoKSA9PT0gJ2pzb24nKXtcbiAgICAgICAgICAgIGlmKGRhdGEgPT09ICcnKXtcbiAgICAgICAgICAgICAgICBkYXRhID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHRyeVBhcnNlSnNvbihkYXRhKTtcbiAgICAgICAgICAgICAgICBpZihkYXRhIGluc3RhbmNlb2YgRXJyb3Ipe1xuICAgICAgICAgICAgICAgICAgICBhamF4LmVtaXQoJ2Vycm9yJywgZXZlbnQsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYoZXZlbnQudGFyZ2V0LnN0YXR1cyA+PSA0MDApe1xuICAgICAgICAgICAgYWpheC5lbWl0KCdlcnJvcicsIGV2ZW50LCBkYXRhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFqYXguZW1pdCgnc3VjY2VzcycsIGV2ZW50LCBkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgfSwgZmFsc2UpO1xuXG4gICAgYWpheC5yZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgICBhamF4LmVtaXQoJ2Vycm9yJywgZXZlbnQpO1xuICAgIH0sIGZhbHNlKTtcblxuICAgIGFqYXgucmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsIGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgICAgYWpheC5lbWl0KCdlcnJvcicsIGV2ZW50LCBuZXcgRXJyb3IoJ0Nvbm5lY3Rpb24gQWJvcnRlZCcpKTtcbiAgICAgICAgYWpheC5lbWl0KCdhYm9ydCcsIGV2ZW50KTtcbiAgICB9LCBmYWxzZSk7XG5cbiAgICBhamF4LnJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVuZCcsIGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3JlcXVlc3RUaW1lb3V0KTtcbiAgICAgICAgYWpheC5lbWl0KCdjb21wbGV0ZScsIGV2ZW50KTtcbiAgICB9LCBmYWxzZSk7XG5cbiAgICBhamF4LnJlcXVlc3Qub3BlbihhamF4LnNldHRpbmdzLm1ldGhvZCB8fCAnZ2V0JywgYWpheC5zZXR0aW5ncy51cmwsIHRydWUpO1xuXG4gICAgLy8gU2V0IGRlZmF1bHQgaGVhZGVyc1xuICAgIGlmKGFqYXguc2V0dGluZ3MuY29udGVudFR5cGUgIT09IGZhbHNlKXtcbiAgICAgICAgYWpheC5yZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIGFqYXguc2V0dGluZ3MuY29udGVudFR5cGUgfHwgJ2FwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLTgnKTtcbiAgICB9XG4gICAgaWYoYWpheC5zZXR0aW5ncy5yZXF1ZXN0ZWRXaXRoICE9PSBmYWxzZSkge1xuICAgICAgICBhamF4LnJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcignWC1SZXF1ZXN0ZWQtV2l0aCcsIGFqYXguc2V0dGluZ3MucmVxdWVzdGVkV2l0aCB8fCAnWE1MSHR0cFJlcXVlc3QnKTtcbiAgICB9XG4gICAgaWYoYWpheC5zZXR0aW5ncy5hdXRoKXtcbiAgICAgICAgYWpheC5yZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoJ0F1dGhvcml6YXRpb24nLCBhamF4LnNldHRpbmdzLmF1dGgpO1xuICAgIH1cblxuICAgIC8vIFNldCBjdXN0b20gaGVhZGVyc1xuICAgIGZvcih2YXIgaGVhZGVyS2V5IGluIGFqYXguc2V0dGluZ3MuaGVhZGVycyl7XG4gICAgICAgIGFqYXgucmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKGhlYWRlcktleSwgYWpheC5zZXR0aW5ncy5oZWFkZXJzW2hlYWRlcktleV0pO1xuICAgIH1cblxuICAgIGlmKGFqYXguc2V0dGluZ3MucHJvY2Vzc0RhdGEgIT09IGZhbHNlICYmIGFqYXguc2V0dGluZ3MuZGF0YVR5cGUgPT09ICdqc29uJyl7XG4gICAgICAgIGFqYXguc2V0dGluZ3MuZGF0YSA9IEpTT04uc3RyaW5naWZ5KGFqYXguc2V0dGluZ3MuZGF0YSk7XG4gICAgfVxufVxuXG5BamF4LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbkFqYXgucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbigpe1xuICAgIHRoaXMuX3JlcXVlc3RUaW1lb3V0ID0gc2V0VGltZW91dChcbiAgICAgICAgdGltZW91dC5iaW5kKHRoaXMpLFxuICAgICAgICB0aGlzLnNldHRpbmdzLnRpbWVvdXQgfHwgMTIwMDAwXG4gICAgKTtcbiAgICB0aGlzLnJlcXVlc3Quc2VuZCh0aGlzLnNldHRpbmdzLmRhdGEgJiYgdGhpcy5zZXR0aW5ncy5kYXRhKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQWpheDtcbiIsIi8qIVxuXHRxdWVyeS1zdHJpbmdcblx0UGFyc2UgYW5kIHN0cmluZ2lmeSBVUkwgcXVlcnkgc3RyaW5nc1xuXHRodHRwczovL2dpdGh1Yi5jb20vc2luZHJlc29yaHVzL3F1ZXJ5LXN0cmluZ1xuXHRieSBTaW5kcmUgU29yaHVzXG5cdE1JVCBMaWNlbnNlXG4qL1xuKGZ1bmN0aW9uICgpIHtcblx0J3VzZSBzdHJpY3QnO1xuXHR2YXIgcXVlcnlTdHJpbmcgPSB7fTtcblxuXHRxdWVyeVN0cmluZy5wYXJzZSA9IGZ1bmN0aW9uIChzdHIpIHtcblx0XHRpZiAodHlwZW9mIHN0ciAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9XG5cblx0XHRzdHIgPSBzdHIudHJpbSgpLnJlcGxhY2UoL14oXFw/fCMpLywgJycpO1xuXG5cdFx0aWYgKCFzdHIpIHtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyLnRyaW0oKS5zcGxpdCgnJicpLnJlZHVjZShmdW5jdGlvbiAocmV0LCBwYXJhbSkge1xuXHRcdFx0dmFyIHBhcnRzID0gcGFyYW0ucmVwbGFjZSgvXFwrL2csICcgJykuc3BsaXQoJz0nKTtcblx0XHRcdHZhciBrZXkgPSBwYXJ0c1swXTtcblx0XHRcdHZhciB2YWwgPSBwYXJ0c1sxXTtcblxuXHRcdFx0a2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KGtleSk7XG5cdFx0XHQvLyBtaXNzaW5nIGA9YCBzaG91bGQgYmUgYG51bGxgOlxuXHRcdFx0Ly8gaHR0cDovL3czLm9yZy9UUi8yMDEyL1dELXVybC0yMDEyMDUyNC8jY29sbGVjdC11cmwtcGFyYW1ldGVyc1xuXHRcdFx0dmFsID0gdmFsID09PSB1bmRlZmluZWQgPyBudWxsIDogZGVjb2RlVVJJQ29tcG9uZW50KHZhbCk7XG5cblx0XHRcdGlmICghcmV0Lmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0cmV0W2tleV0gPSB2YWw7XG5cdFx0XHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocmV0W2tleV0pKSB7XG5cdFx0XHRcdHJldFtrZXldLnB1c2godmFsKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldFtrZXldID0gW3JldFtrZXldLCB2YWxdO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmV0O1xuXHRcdH0sIHt9KTtcblx0fTtcblxuXHRxdWVyeVN0cmluZy5zdHJpbmdpZnkgPSBmdW5jdGlvbiAob2JqKSB7XG5cdFx0cmV0dXJuIG9iaiA/IE9iamVjdC5rZXlzKG9iaikubWFwKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdHZhciB2YWwgPSBvYmpba2V5XTtcblxuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkodmFsKSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsLm1hcChmdW5jdGlvbiAodmFsMikge1xuXHRcdFx0XHRcdHJldHVybiBlbmNvZGVVUklDb21wb25lbnQoa2V5KSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWwyKTtcblx0XHRcdFx0fSkuam9pbignJicpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KGtleSkgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQodmFsKTtcblx0XHR9KS5qb2luKCcmJykgOiAnJztcblx0fTtcblxuXHRpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG5cdFx0ZGVmaW5lKGZ1bmN0aW9uKCkgeyByZXR1cm4gcXVlcnlTdHJpbmc7IH0pO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdFx0bW9kdWxlLmV4cG9ydHMgPSBxdWVyeVN0cmluZztcblx0fSBlbHNlIHtcblx0XHRzZWxmLnF1ZXJ5U3RyaW5nID0gcXVlcnlTdHJpbmc7XG5cdH1cbn0pKCk7XG4iLCJ2YXIgcGxhY2Vob2xkZXIgPSB7fSxcbiAgICBlbmRPZkFyZ3MgPSB7fSxcbiAgICBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsLmJpbmQoQXJyYXkucHJvdG90eXBlLnNsaWNlKTtcblxuZnVuY3Rpb24gc2h1dihmbil7XG4gICAgdmFyIG91dGVyQXJncyA9IHNsaWNlKGFyZ3VtZW50cywgMSk7XG5cbiAgICBpZih0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG9yIG5vbi1mdW5jdGlvbiBwYXNzZWQgdG8gc2h1dicpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbigpe1xuICAgICAgICB2YXIgY29udGV4dCA9IHRoaXMsXG4gICAgICAgICAgICBpbm5lckFyZ3MgPSBzbGljZShhcmd1bWVudHMpLFxuICAgICAgICAgICAgZmluYWxBcmdzID0gW10sXG4gICAgICAgICAgICBhcHBlbmQgPSB0cnVlO1xuXG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBvdXRlckFyZ3MubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgdmFyIG91dGVyQXJnID0gb3V0ZXJBcmdzW2ldO1xuXG4gICAgICAgICAgICBpZihvdXRlckFyZyA9PT0gZW5kT2ZBcmdzKXtcbiAgICAgICAgICAgICAgICBhcHBlbmQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYob3V0ZXJBcmcgPT09IHBsYWNlaG9sZGVyKXtcbiAgICAgICAgICAgICAgICBmaW5hbEFyZ3MucHVzaChpbm5lckFyZ3Muc2hpZnQoKSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZpbmFsQXJncy5wdXNoKG91dGVyQXJnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGFwcGVuZCl7XG4gICAgICAgICAgICBmaW5hbEFyZ3MgPSBmaW5hbEFyZ3MuY29uY2F0KGlubmVyQXJncyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZm4uYXBwbHkoY29udGV4dCwgZmluYWxBcmdzKTtcbiAgICB9O1xufVxuXG5zaHV2Ll8gPSBwbGFjZWhvbGRlcjtcbnNodXYuJCA9IGVuZE9mQXJncztcblxubW9kdWxlLmV4cG9ydHMgPSBzaHV2OyIsInZhciBzYW1lID0gcmVxdWlyZSgnc2FtZS12YWx1ZScpO1xuXG52YXIgUkVNT1ZFRCA9ICdyJztcbnZhciBBRERFRCA9ICdhJztcbnZhciBFRElURUQgPSAnZSc7XG5cbnZhciBBUlJBWSA9ICdhJztcbnZhciBGVU5DVElPTiA9ICdmJztcbnZhciBEQVRFID0gJ2QnO1xuXG5mdW5jdGlvbiBpc0luc3RhbmNlKHZhbHVlKXtcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiB2YWx1ZTtcbiAgICByZXR1cm4gdmFsdWUgJiYgdHlwZSA9PT0gJ29iamVjdCcgfHwgdHlwZSA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gZ2V0SWQoKXtcbiAgICByZXR1cm4gKHRoaXMuY3VycmVudElkKyspLnRvU3RyaW5nKDM2KTtcbn1cblxuZnVuY3Rpb24gb2JqZWN0UmVtb3ZlZENoYW5nZXMoc2NvcGUsIG9iamVjdCl7XG4gICAgdmFyIGl0ZW1JbmZvID0gc2NvcGUudHJhY2tlZE1hcC5nZXQob2JqZWN0KTtcblxuICAgIGl0ZW1JbmZvLm9jY3VyYW5jZXMtLTtcblxuICAgIGZvcihrZXkgaW4gb2JqZWN0KXtcbiAgICAgICAgaWYoaXNJbnN0YW5jZShvYmplY3Rba2V5XSkpe1xuICAgICAgICAgICAgb2JqZWN0UmVtb3ZlZENoYW5nZXMoc2NvcGUsIG9iamVjdFtrZXldKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlSW5zdGFuY2VJbmZvKHNjb3BlLCBpZCwgdmFsdWUpe1xuICAgIHZhciBsYXN0SW5mbyA9IHtcbiAgICAgICAgICAgIGlkOiBpZCxcbiAgICAgICAgICAgIGluc3RhbmNlOiB2YWx1ZSxcbiAgICAgICAgICAgIGxhc3RTdGF0ZToge30sXG4gICAgICAgICAgICBvY2N1cmFuY2VzOiBmYWxzZVxuICAgICAgICB9O1xuXG4gICAgc2NvcGUuaW5zdGFuY2VzW2xhc3RJbmZvLmlkXSA9IHZhbHVlO1xuICAgIHNjb3BlLnRyYWNrZWRNYXAuc2V0KHZhbHVlLCBsYXN0SW5mbyk7XG5cbiAgICByZXR1cm4gbGFzdEluZm87XG59XG5cbmZ1bmN0aW9uIGdldEluc3RhbmNlSW5mbyhzY29wZSwgdmFsdWUpe1xuICAgIGlmKCFpc0luc3RhbmNlKHZhbHVlKSl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgbGFzdEluZm8gPSBzY29wZS50cmFja2VkTWFwLmdldCh2YWx1ZSk7XG5cbiAgICBpZighbGFzdEluZm8pe1xuICAgICAgICBsYXN0SW5mbyA9IGNyZWF0ZUluc3RhbmNlSW5mbyhzY29wZSwgc2NvcGUuZ2V0SWQoKSwgdmFsdWUpO1xuICAgIH1cblxuICAgIHJldHVybiBsYXN0SW5mbztcbn1cblxuZnVuY3Rpb24gZ2V0SW5zdGFuY2VJZCh2YWx1ZSl7XG4gICAgdmFyIGluZm8gPSBnZXRJbnN0YW5jZUluZm8odGhpcywgdmFsdWUpO1xuXG4gICAgcmV0dXJuIGluZm8gJiYgaW5mby5pZDtcbn1cblxuZnVuY3Rpb24gZ2V0UmVtb3ZlZENoYW5nZShzY29wZSwgY2hhbmdlcywgbGFzdEluZm8sIG9iamVjdCwgb2xkS2V5KXtcbiAgICBpZighKG9sZEtleSBpbiBvYmplY3QpKXtcbiAgICAgICAgdmFyIG9sZFZhbHVlID0gbGFzdEluZm8ubGFzdFN0YXRlW29sZEtleV07XG4gICAgICAgIGNoYW5nZXMucHVzaChbbGFzdEluZm8uaWQsIG9sZEtleSwgUkVNT1ZFRF0pO1xuXG4gICAgICAgIGlmKGlzSW5zdGFuY2Uob2xkVmFsdWUpICYmIHNjb3BlLnRyYWNrZWRNYXAuaGFzKG9sZFZhbHVlKSl7XG4gICAgICAgICAgICBvYmplY3RSZW1vdmVkQ2hhbmdlcyhzY29wZSwgb2xkVmFsdWUpO1xuICAgICAgICB9XG5cbiAgICAgICAgZGVsZXRlIGxhc3RJbmZvLmxhc3RTdGF0ZVtvbGRLZXldO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0UmVtb3ZlZENoYW5nZXMoc2NvcGUsIGNoYW5nZXMsIGxhc3RJbmZvLCBvYmplY3Qpe1xuICAgIGZvcih2YXIgb2xkS2V5IGluIGxhc3RJbmZvLmxhc3RTdGF0ZSl7XG4gICAgICAgIGdldFJlbW92ZWRDaGFuZ2Uoc2NvcGUsIGNoYW5nZXMsIGxhc3RJbmZvLCBvYmplY3QsIG9sZEtleSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDdXJyZW50Q2hhbmdlKHNjb3BlLCBjaGFuZ2VzLCBsYXN0SW5mbywgb2JqZWN0LCBjdXJyZW50S2V5LCBzY2FubmVkLCBpbnN0YW5jZUNoYW5nZXMpe1xuICAgIHZhciB0eXBlID0gY3VycmVudEtleSBpbiBsYXN0SW5mby5sYXN0U3RhdGUgPyBFRElURUQgOiBBRERFRCxcbiAgICAgICAgb2xkVmFsdWUgPSBsYXN0SW5mby5sYXN0U3RhdGVbY3VycmVudEtleV0sXG4gICAgICAgIGN1cnJlbnRWYWx1ZSA9IG9iamVjdFtjdXJyZW50S2V5XSxcbiAgICAgICAgY2hhbmdlID0gW2xhc3RJbmZvLmlkLCBjdXJyZW50S2V5LCB0eXBlXSxcbiAgICAgICAgY2hhbmdlZCA9ICFzYW1lKG9sZFZhbHVlLCBjdXJyZW50VmFsdWUpO1xuXG4gICAgaWYoY2hhbmdlZCl7XG4gICAgICAgIGlmKGlzSW5zdGFuY2Uob2xkVmFsdWUpICYmIHNjb3BlLnRyYWNrZWRNYXAuaGFzKG9sZFZhbHVlKSl7XG4gICAgICAgICAgICBvYmplY3RSZW1vdmVkQ2hhbmdlcyhzY29wZSwgb2xkVmFsdWUpO1xuICAgICAgICB9XG5cbiAgICB9ZWxzZSBpZih0eXBlID09PSAnYScpeyAvLyBQcmV2aW91c2x5IG5vIGtleSwgbm93IGtleSwgYnV0IHZhbHVlIGlzIHVuZGVmaW5lZC5cbiAgICAgICAgY2hhbmdlcy5wdXNoKGNoYW5nZSk7XG4gICAgfVxuXG4gICAgbGFzdEluZm8ubGFzdFN0YXRlW2N1cnJlbnRLZXldID0gY3VycmVudFZhbHVlO1xuXG4gICAgaWYoIWlzSW5zdGFuY2UoY3VycmVudFZhbHVlKSl7XG4gICAgICAgIGNoYW5nZS5wdXNoKGN1cnJlbnRWYWx1ZSk7XG4gICAgfWVsc2V7XG4gICAgICAgIHZhciB2YWx1ZUNoYW5nZXMgPSBnZXRPYmplY3RDaGFuZ2VzKHNjb3BlLCBjdXJyZW50VmFsdWUsIHNjYW5uZWQpLFxuICAgICAgICAgICAgdmFsdWVJbmZvID0gc2NvcGUudHJhY2tlZE1hcC5nZXQoY3VycmVudFZhbHVlKTtcblxuICAgICAgICB2YWx1ZUluZm8ub2NjdXJhbmNlcysrO1xuICAgICAgICBjaGFuZ2UucHVzaChbdmFsdWVJbmZvLmlkXSk7XG5cbiAgICAgICAgaWYodmFsdWVDaGFuZ2VzKXtcbiAgICAgICAgICAgIGNoYW5nZXMucHVzaC5hcHBseShjaGFuZ2VzLCB2YWx1ZUNoYW5nZXMuY2hhbmdlcyk7XG4gICAgICAgICAgICBpbnN0YW5jZUNoYW5nZXMucHVzaC5hcHBseShpbnN0YW5jZUNoYW5nZXMsIHZhbHVlQ2hhbmdlcy5pbnN0YW5jZUNoYW5nZXMpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYoY2hhbmdlZCl7XG4gICAgICAgIGNoYW5nZXMucHVzaChjaGFuZ2UpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q3VycmVudENoYW5nZXMoc2NvcGUsIGNoYW5nZXMsIGxhc3RJbmZvLCBvYmplY3QsIHNjYW5uZWQsIGluc3RhbmNlQ2hhbmdlcyl7XG4gICAgZm9yKHZhciBjdXJyZW50S2V5IGluIG9iamVjdCl7XG4gICAgICAgIGdldEN1cnJlbnRDaGFuZ2Uoc2NvcGUsIGNoYW5nZXMsIGxhc3RJbmZvLCBvYmplY3QsIGN1cnJlbnRLZXksIHNjYW5uZWQsIGluc3RhbmNlQ2hhbmdlcyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVJbnN0YW5jZURlZmluaXRpb24oc2NvcGUsIGluc3RhbmNlKXtcbiAgICB2YXIgcmVzdWx0ID0gc2NvcGUuc2V0dGluZ3Muc2VyaWFsaXNlcihpbnN0YW5jZSk7XG5cbiAgICBpZighcmVzdWx0KXtcbiAgICAgICAgcmVzdWx0ID0gW107XG4gICAgICAgIHZhciB2YWx1ZSA9IGluc3RhbmNlO1xuXG4gICAgICAgIGlmKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSl7XG4gICAgICAgICAgICByZXR1cm4gW3ZhbHVlLnRvSVNPU3RyaW5nKCksIERBVEVdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKGZ1bmN0aW9uKCl7cmV0dXJuIGluc3RhbmNlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyl9LCBGVU5DVElPTik7XG4gICAgICAgIH1lbHNlIGlmKEFycmF5LmlzQXJyYXkodmFsdWUpKXtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHt9LCBBUlJBWSk7XG4gICAgICAgIH1lbHNlIGlmKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpe1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goe30pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yKHZhciBrZXkgaW4gaW5zdGFuY2Upe1xuICAgICAgICB2YXIgaWQgPSBzY29wZS52aXNjb3VzLmdldElkKGluc3RhbmNlW2tleV0pO1xuICAgICAgICByZXN1bHRbMF1ba2V5XSA9IGlkID8gW2lkXSA6IGluc3RhbmNlW2tleV07XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gZ2V0T2JqZWN0Q2hhbmdlcyhzY29wZSwgb2JqZWN0LCBzY2FubmVkKXtcbiAgICBpZihzY2FubmVkLmhhcyhvYmplY3QpKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzY2FubmVkLmFkZChvYmplY3QpO1xuXG4gICAgdmFyIGxhc3RJbmZvID0gZ2V0SW5zdGFuY2VJbmZvKHNjb3BlLCBvYmplY3QpLFxuICAgICAgICBuZXdLZXlzLFxuICAgICAgICByZW1vdmVkS2V5cyxcbiAgICAgICAgaW5zdGFuY2VDaGFuZ2VzID0gW107XG5cblxuICAgIHZhciBpc05ldyA9IGxhc3RJbmZvLm9jY3VyYW5jZXMgPT09IGZhbHNlICYmIG9iamVjdCAhPT0gc2NvcGUuc3RhdGU7XG5cbiAgICBpZihpc05ldyl7XG4gICAgICAgIGxhc3RJbmZvLm9jY3VyYW5jZXMgPSAwO1xuICAgIH1cblxuICAgIHZhciBjaGFuZ2VzID0gW107XG4gICAgZ2V0UmVtb3ZlZENoYW5nZXMoc2NvcGUsIGNoYW5nZXMsIGxhc3RJbmZvLCBvYmplY3QpO1xuICAgIGdldEN1cnJlbnRDaGFuZ2VzKHNjb3BlLCBjaGFuZ2VzLCBsYXN0SW5mbywgb2JqZWN0LCBzY2FubmVkLCBpbnN0YW5jZUNoYW5nZXMpO1xuXG4gICAgaWYoaXNOZXcpe1xuICAgICAgICBpbnN0YW5jZUNoYW5nZXMucHVzaChbbGFzdEluZm8uaWQsIGNyZWF0ZUluc3RhbmNlRGVmaW5pdGlvbihzY29wZSwgb2JqZWN0KV0pO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGluc3RhbmNlQ2hhbmdlczogaW5zdGFuY2VDaGFuZ2VzLFxuICAgICAgICBjaGFuZ2VzOiBjaGFuZ2VzXG4gICAgfTtcbn1cblxuZnVuY3Rpb24gY2hhbmdlcygpe1xuICAgIHZhciBzY29wZSA9IHRoaXMsXG4gICAgICAgIHJlc3VsdCA9IGdldE9iamVjdENoYW5nZXMoc2NvcGUsIHNjb3BlLnN0YXRlLCBuZXcgV2Vha1NldCgpKTtcblxuICAgIHZhciBpbnN0YW5jZUNoYW5nZXMgPSBPYmplY3Qua2V5cyhzY29wZS5pbnN0YW5jZXMpLnJlZHVjZShmdW5jdGlvbihjaGFuZ2VzLCBrZXkpe1xuICAgICAgICB2YXIgaW5zdGFuY2UgPSBzY29wZS5pbnN0YW5jZXNba2V5XSxcbiAgICAgICAgICAgIGl0ZW1JbmZvID0gc2NvcGUudHJhY2tlZE1hcC5nZXQoaW5zdGFuY2UpO1xuXG4gICAgICAgIGlmKGluc3RhbmNlICE9PSBzY29wZS5zdGF0ZSAmJiAhaXRlbUluZm8ub2NjdXJhbmNlcyl7XG4gICAgICAgICAgICBzY29wZS50cmFja2VkTWFwLmRlbGV0ZShpbnN0YW5jZSk7XG4gICAgICAgICAgICBkZWxldGUgc2NvcGUuaW5zdGFuY2VzW2l0ZW1JbmZvLmlkXTtcbiAgICAgICAgICAgIGNoYW5nZXMucHVzaChbaXRlbUluZm8uaWQsIFJFTU9WRURdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjaGFuZ2VzO1xuICAgIH0sIFtdKTtcblxuICAgIHJldHVybiBbcmVzdWx0Lmluc3RhbmNlQ2hhbmdlcy5jb25jYXQoaW5zdGFuY2VDaGFuZ2VzKV0uY29uY2F0KHJlc3VsdC5jaGFuZ2VzKTtcbn1cblxuZnVuY3Rpb24gZ2V0U3RhdGUoKXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuXG4gICAgc2NvcGUudmlzY291cy5jaGFuZ2VzKCk7XG5cbiAgICByZXR1cm4gW09iamVjdC5rZXlzKHNjb3BlLmluc3RhbmNlcykucmV2ZXJzZSgpLm1hcChmdW5jdGlvbihrZXkpe1xuICAgICAgICByZXR1cm4gW2tleSwgY3JlYXRlSW5zdGFuY2VEZWZpbml0aW9uKHNjb3BlLCBzY29wZS5pbnN0YW5jZXNba2V5XSldO1xuICAgIH0pXTtcbn1cblxuZnVuY3Rpb24gYXBwbHlSb290Q2hhbmdlKHNjb3BlLCBuZXdTdGF0ZSl7XG4gICAgZm9yKHZhciBrZXkgaW4gc2NvcGUuc3RhdGUpe1xuICAgICAgICBpZigha2V5IGluIG5ld1N0YXRlKXtcbiAgICAgICAgICAgIGRlbGV0ZSBzY29wZS5zdGF0ZVtrZXldO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZvcih2YXIga2V5IGluIG5ld1N0YXRlKXtcbiAgICAgICAgc2NvcGUuc3RhdGVba2V5XSA9IG5ld1N0YXRlW2tleV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpbmZsYXRlRGVmaW5pdGlvbihzY29wZSwgZGVmaW5pdGlvbil7XG4gICAgaWYoQXJyYXkuaXNBcnJheShkZWZpbml0aW9uKSl7XG4gICAgICAgIHZhciB0eXBlID0gZGVmaW5pdGlvblsxXSxcbiAgICAgICAgICAgIHByb3BlcnRpZXMgPSBkZWZpbml0aW9uWzBdO1xuXG4gICAgICAgIHZhciByZXN1bHQgPSBzY29wZS5zZXR0aW5ncy5kZXNlcmlhbGlzZXIoZGVmaW5pdGlvbik7XG5cbiAgICAgICAgaWYocmVzdWx0KXtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZighdHlwZSl7XG4gICAgICAgICAgICByZXN1bHQgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZih0eXBlID09PSBBUlJBWSl7XG4gICAgICAgICAgICByZXN1bHQgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBpZih0eXBlID09PSBGVU5DVElPTil7XG4gICAgICAgICAgICByZXN1bHQgPSBwcm9wZXJ0aWVzO1xuICAgICAgICB9XG4gICAgICAgIGlmKHR5cGUgPT09IERBVEUpe1xuICAgICAgICAgICAgcmVzdWx0ID0gbmV3IERhdGUocHJvcGVydGllcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihyZXN1bHQpe1xuICAgICAgICAgICAgZm9yKHZhciBrZXkgaW4gcHJvcGVydGllcyl7XG4gICAgICAgICAgICAgICAgaWYoQXJyYXkuaXNBcnJheShwcm9wZXJ0aWVzW2tleV0pKXtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKHByb3BlcnRpZXNba2V5XSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5KGNoYW5nZXMpe1xuICAgIHZhciBzY29wZSA9IHRoaXMsXG4gICAgICAgIGluc3RhbmNlQ2hhbmdlcyA9IGNoYW5nZXNbMF07XG5cbiAgICBpbnN0YW5jZUNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbihpbnN0YW5jZUNoYW5nZSl7XG4gICAgICAgIGlmKGluc3RhbmNlQ2hhbmdlWzFdID09PSBSRU1PVkVEKXtcbiAgICAgICAgICAgIHZhciBpbnN0YW5jZSA9IHNjb3BlLmluc3RhbmNlc1tpbnN0YW5jZUNoYW5nZVswXV07XG4gICAgICAgICAgICBzY29wZS50cmFja2VkTWFwLmRlbGV0ZShpbnN0YW5jZSk7XG4gICAgICAgICAgICBkZWxldGUgc2NvcGUuaW5zdGFuY2VzW2luc3RhbmNlQ2hhbmdlWzBdXTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICBpZihzY29wZS5pbnN0YW5jZXNbaW5zdGFuY2VDaGFuZ2VbMF1dID09PSBzY29wZS5zdGF0ZSl7XG4gICAgICAgICAgICAgICAgYXBwbHlSb290Q2hhbmdlKHNjb3BlLCBpbmZsYXRlRGVmaW5pdGlvbihzY29wZSwgaW5zdGFuY2VDaGFuZ2VbMV0pKTtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIGNyZWF0ZUluc3RhbmNlSW5mbyhzY29wZSwgaW5zdGFuY2VDaGFuZ2VbMF0sIGluZmxhdGVEZWZpbml0aW9uKHNjb3BlLCBpbnN0YW5jZUNoYW5nZVsxXSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBmb3IodmFyIGkgPSAxOyBpIDwgY2hhbmdlcy5sZW5ndGg7IGkrKyl7XG4gICAgICAgIHZhciBjaGFuZ2UgPSBjaGFuZ2VzW2ldO1xuXG4gICAgICAgIGlmKGNoYW5nZVsyXSA9PT0gUkVNT1ZFRCl7XG4gICAgICAgICAgICBkZWxldGUgc2NvcGUuaW5zdGFuY2VzW2NoYW5nZVswXV1bY2hhbmdlWzFdXTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBjaGFuZ2VbM107XG5cbiAgICAgICAgICAgIGlmKEFycmF5LmlzQXJyYXkoY2hhbmdlWzNdKSl7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBzY29wZS5pbnN0YW5jZXNbY2hhbmdlWzNdXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2NvcGUuaW5zdGFuY2VzW2NoYW5nZVswXV1bY2hhbmdlWzFdXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRJbnN0YW5jZUJ5SWQoaWQpe1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlc1tpZF07XG59XG5cbmZ1bmN0aW9uIHZpc2NvdXMoc3RhdGUsIHNldHRpbmdzKXtcbiAgICBpZighc2V0dGluZ3Mpe1xuICAgICAgICBzZXR0aW5ncyA9IHtcbiAgICAgICAgICAgIHNlcmlhbGlzZXI6IGZ1bmN0aW9uKCl7fSxcbiAgICAgICAgICAgIGRlc2VyaWFsaXNlcjogZnVuY3Rpb24oKXt9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIHZpc2NvdXMgPSB7fTtcblxuICAgIHZhciBzY29wZSA9IHtcbiAgICAgICAgc2V0dGluZ3M6IHNldHRpbmdzLFxuICAgICAgICB2aXNjb3VzOiB2aXNjb3VzLFxuICAgICAgICBjdXJyZW50SWQ6IDAsXG4gICAgICAgIHN0YXRlOiBzdGF0ZSB8fCB7fSxcbiAgICAgICAgdHJhY2tlZE1hcDogbmV3IFdlYWtNYXAoKSxcbiAgICAgICAgaW5zdGFuY2VzOiB7fVxuICAgIH07XG5cbiAgICBzY29wZS5nZXRJZCA9IGdldElkLmJpbmQoc2NvcGUpO1xuXG4gICAgdmlzY291cy5jaGFuZ2VzID0gY2hhbmdlcy5iaW5kKHNjb3BlKTtcbiAgICB2aXNjb3VzLmFwcGx5ID0gYXBwbHkuYmluZChzY29wZSk7XG4gICAgdmlzY291cy5zdGF0ZSA9IGdldFN0YXRlLmJpbmQoc2NvcGUpO1xuICAgIHZpc2NvdXMuZ2V0SWQgPSBnZXRJbnN0YW5jZUlkLmJpbmQoc2NvcGUpO1xuICAgIHZpc2NvdXMuZ2V0SW5zdGFuY2UgPSBnZXRJbnN0YW5jZUJ5SWQuYmluZChzY29wZSk7XG5cbiAgICB2aXNjb3VzLmNoYW5nZXMoKTtcblxuICAgIHJldHVybiB2aXNjb3VzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHZpc2NvdXM7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzU2FtZShhLCBiKXtcbiAgICBpZihhID09PSBiKXtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYoXG4gICAgICAgIHR5cGVvZiBhICE9PSB0eXBlb2YgYiB8fFxuICAgICAgICB0eXBlb2YgYSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgIShhIGluc3RhbmNlb2YgRGF0ZSAmJiBiIGluc3RhbmNlb2YgRGF0ZSlcbiAgICApe1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIFN0cmluZyhhKSA9PT0gU3RyaW5nKGIpO1xufTsiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iXX0=
