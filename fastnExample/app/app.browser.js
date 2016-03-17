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
var cpjax = require('cpjax'),
    EventEmitter = require('events'),
    app = new EventEmitter(),
    lenze = require('../../')(app, {
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

function updateUsers(){
    app.visibleUsers = app.users && app.users.filter(function(user){
        return ~user.name.indexOf(app.search || '');
    });
};

app.setSearch = function(value){
    app.search = value;
    updateUsers();
};

app.setSelectedUser = function(user){
    app.selectedUser = user;
};

cpjax({
    url: 'users.json',
    dataType: 'json'
}, function(error, data){
    if(error){
        return;
    }

    app.users = data.map(function(user){
        user.setName = function(newName){
            user.name = newName;
            updateUsers();
        };
        user.dob = new Date(1930 + (Math.random() * 90), 1, 1);
        return user;
    });

    updateUsers();
});
},{"../../":3,"cpjax":4,"events":1}],3:[function(require,module,exports){
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

    if(changes.length > 1 || changes[0].length > 1){
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

        if(message.type === STATE || message.type === CONNECT){
            scope.viscous.apply(inflateChanges(scope, message.data));
            scope.lenze.update();
        }

        if(message.type === CHANGES){
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

},{"events":1,"shuv":6,"viscous":8}],4:[function(require,module,exports){
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
},{"simple-ajax":7}],5:[function(require,module,exports){
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

},{"events":1,"query-string":5}],8:[function(require,module,exports){
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

function getId(){
    return (this.currentId++).toString(36);
}

function createInstanceInfo(scope, id, value){
    var instanceInfo = {
            id: id,
            instance: value,
            lastState: {},
            new: true
        };

    scope.instances[instanceInfo.id] = value;
    scope.trackedMap.set(value, instanceInfo);

    return instanceInfo;
}

function getInstanceInfo(scope, value){
    if(!isInstance(value)){
        return;
    }

    var instanceInfo = scope.trackedMap.get(value);

    if(!instanceInfo){
        instanceInfo = createInstanceInfo(scope, scope.getId(), value);
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

    var instanceId = scope.viscous.getId(instance[currentKey]);

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
        var id = scope.viscous.getId(instance[key]);
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
        scope.trackedMap.delete(scope.instances[id]);
        delete scope.instances[id];
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
    scope.currentInstances.add('0');

    scope.getObjectChanges(scope.state);

    Object.keys(this.instances).forEach(createGarbageChange, this);

    return scope.nextChange.splice(0, scope.nextChange.length);
}

function getState(){
    var scope = this;

    scope.viscous.changes();

    return [Object.keys(scope.instances).reverse().map(function(key){
        return [key, createInstanceDefinition(scope, scope.instances[key])];
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
            result[key] = scope.viscous.getInstance(properties[key][0]);
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
        instanceChanges = changes[0],
        toInflate = [];

    instanceChanges.forEach(function(instanceChange){
        if(instanceChange[1] === REMOVED){
            var instance = scope.instances[instanceChange[0]];
            scope.trackedMap.delete(instance);
            delete scope.instances[instanceChange[0]];
        }else{
            if(scope.viscous.getInstance(instanceChange[0]) === scope.state){
                applyRootChange(scope, instanceChange[1], toInflate);
            }else{
                createInstanceInfo(scope, instanceChange[0], createInstance(scope, instanceChange[1], toInflate));
            }
        }
    });

    toInflate.forEach(function(change){
        inflateDefinition(scope, change[0], change[1]);
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

function describe(data){
    if(isInstance(data)){
        if(this.trackedMap.has(data)){
            return [this.viscous.getId(data)];
        }
        return createInstanceDefinition(this, data);
    }

    return data;
}

function inflate(description){
    var scope = this;

    if(Array.isArray(description) && typeof description[0] === 'string'){
        return scope.viscous.getInstance(description[0]);
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

    scope.getId = getId.bind(scope);

    viscous.changes = changes.bind(scope);
    viscous.apply = apply.bind(scope);
    viscous.state = getState.bind(scope);
    viscous.getId = getInstanceId.bind(scope);
    viscous.getInstance = getInstanceById.bind(scope);
    viscous.describe = describe.bind(scope);
    viscous.inflate = inflate.bind(scope);

    viscous.changes();

    return viscous;
}

module.exports = viscous;

},{"same-value":9}],9:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92NS4zLjAvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y1LjMuMC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiZmFzdG5FeGFtcGxlL2FwcC9hcHAuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jcGpheC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyeS1zdHJpbmcvcXVlcnktc3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL3NodXYvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc2ltcGxlLWFqYXgvaW5kZXguanMiLCIuLi92aXNjb3VzL2luZGV4LmpzIiwiLi4vdmlzY291cy9ub2RlX21vZHVsZXMvc2FtZS12YWx1ZS9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcllBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJ2YXIgY3BqYXggPSByZXF1aXJlKCdjcGpheCcpLFxuICAgIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIGFwcCA9IG5ldyBFdmVudEVtaXR0ZXIoKSxcbiAgICBsZW56ZSA9IHJlcXVpcmUoJy4uLy4uLycpKGFwcCwge1xuICAgICAgICBjaGFuZ2VJbnRlcnZhbDogMTYsXG4gICAgICAgIHNlbmQ6IGZ1bmN0aW9uKGRhdGEpe1xuICAgICAgICAgICAgc2VsZi5wb3N0TWVzc2FnZShkYXRhKTtcbiAgICAgICAgfSxcbiAgICAgICAgcmVjZWl2ZTogZnVuY3Rpb24oY2FsbGJhY2spe1xuICAgICAgICAgICAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24obWVzc2FnZSl7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobWVzc2FnZS5kYXRhKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG5cbmZ1bmN0aW9uIHVwZGF0ZVVzZXJzKCl7XG4gICAgYXBwLnZpc2libGVVc2VycyA9IGFwcC51c2VycyAmJiBhcHAudXNlcnMuZmlsdGVyKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICByZXR1cm4gfnVzZXIubmFtZS5pbmRleE9mKGFwcC5zZWFyY2ggfHwgJycpO1xuICAgIH0pO1xufTtcblxuYXBwLnNldFNlYXJjaCA9IGZ1bmN0aW9uKHZhbHVlKXtcbiAgICBhcHAuc2VhcmNoID0gdmFsdWU7XG4gICAgdXBkYXRlVXNlcnMoKTtcbn07XG5cbmFwcC5zZXRTZWxlY3RlZFVzZXIgPSBmdW5jdGlvbih1c2VyKXtcbiAgICBhcHAuc2VsZWN0ZWRVc2VyID0gdXNlcjtcbn07XG5cbmNwamF4KHtcbiAgICB1cmw6ICd1c2Vycy5qc29uJyxcbiAgICBkYXRhVHlwZTogJ2pzb24nXG59LCBmdW5jdGlvbihlcnJvciwgZGF0YSl7XG4gICAgaWYoZXJyb3Ipe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgYXBwLnVzZXJzID0gZGF0YS5tYXAoZnVuY3Rpb24odXNlcil7XG4gICAgICAgIHVzZXIuc2V0TmFtZSA9IGZ1bmN0aW9uKG5ld05hbWUpe1xuICAgICAgICAgICAgdXNlci5uYW1lID0gbmV3TmFtZTtcbiAgICAgICAgICAgIHVwZGF0ZVVzZXJzKCk7XG4gICAgICAgIH07XG4gICAgICAgIHVzZXIuZG9iID0gbmV3IERhdGUoMTkzMCArIChNYXRoLnJhbmRvbSgpICogOTApLCAxLCAxKTtcbiAgICAgICAgcmV0dXJuIHVzZXI7XG4gICAgfSk7XG5cbiAgICB1cGRhdGVVc2VycygpO1xufSk7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLFxuICAgIHZpc2NvdXMgPSByZXF1aXJlKCd2aXNjb3VzJyksXG4gICAgc2h1diA9IHJlcXVpcmUoJ3NodXYnKTtcblxudmFyIElOVk9LRSA9ICdpJztcbnZhciBDSEFOR0VTID0gJ2MnO1xudmFyIENPTk5FQ1QgPSAnbyc7XG52YXIgU1RBVEUgPSAncyc7XG52YXIgTEVOWkVfRlVOQ1RJT04gPSBTdHJpbmcuZnJvbUNoYXJDb2RlKDB4MTkyKTtcblxuZnVuY3Rpb24gY3JlYXRlQ2hhbmdlcyhzY29wZSwgY2hhbmdlcyl7XG4gICAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGNoYW5nZXMpO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlQ2hhbmdlcyhzY29wZSwgZGF0YSl7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTWVzc2FnZShkYXRhKXtcbiAgICB2YXIgbWVzc2FnZSA9IGRhdGEubWF0Y2goL14oXFx3Kz8pXFw6KC4qKS8pO1xuXG4gICAgaWYobWVzc2FnZSl7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBtZXNzYWdlWzFdLFxuICAgICAgICAgICAgZGF0YTogbWVzc2FnZVsyXVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZWNlaXZlKHNjb3BlLCBkYXRhKXtcbiAgICB2YXIgbWVzc2FnZSA9IHBhcnNlTWVzc2FnZShkYXRhKTtcblxuICAgIGlmKCFtZXNzYWdlKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmKG1lc3NhZ2UudHlwZSA9PT0gSU5WT0tFKXtcbiAgICAgICAgc2NvcGUuaGFuZGxlRnVuY3Rpb24uYXBwbHkobnVsbCwgSlNPTi5wYXJzZShtZXNzYWdlLmRhdGEpKTtcbiAgICB9XG5cbiAgICBpZihtZXNzYWdlLnR5cGUgPT09IENPTk5FQ1Qpe1xuICAgICAgICBzY29wZS5zZW5kKENPTk5FQ1QsIHNjb3BlLnZpc2NvdXMuc3RhdGUoKSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB1cGRhdGUoKXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIHZhciBub3cgPSBEYXRlLm5vdygpO1xuXG4gICAgaWYoXG4gICAgICAgIG5vdyAtIHNjb3BlLmxhc3RVcGRhdGUgPCBzY29wZS5tYXhJbnRlcnZhbCAmJlxuICAgICAgICBub3cgLSBzY29wZS5sYXN0Q2hhbmdlID4gc2NvcGUuZG96ZVRpbWVcbiAgICApe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2NvcGUubGFzdFVwZGF0ZSA9IG5vdztcblxuICAgIHZhciBjaGFuZ2VzID0gc2NvcGUudmlzY291cy5jaGFuZ2VzKCk7XG5cbiAgICBpZihjaGFuZ2VzLmxlbmd0aCA+IDEgfHwgY2hhbmdlc1swXS5sZW5ndGggPiAxKXtcbiAgICAgICAgc2NvcGUubGFzdENoYW5nZSA9IG5vdztcblxuICAgICAgICBzY29wZS5sZW56ZS5lbWl0KCdjaGFuZ2UnLCBjaGFuZ2VzKTtcblxuICAgICAgICBpZihzY29wZS5zZW5kKXtcbiAgICAgICAgICAgIHNjb3BlLnNlbmQoQ0hBTkdFUywgY2hhbmdlcyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZUZ1bmN0aW9uKHNjb3BlLCBpZCl7XG4gICAgc2NvcGUubGFzdENoYW5nZSA9IERhdGUubm93KCk7XG4gICAgc2NvcGUudmlzY291cy5nZXRJbnN0YW5jZShpZCkuYXBwbHkodGhpcywgc2NvcGUudmlzY291cy5pbmZsYXRlKEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMikpKTtcbiAgICBzY29wZS5sZW56ZS51cGRhdGUoKTtcbn1cblxuZnVuY3Rpb24gc2VuZChzY29wZSwgc2VuZCwgdHlwZSwgZGF0YSl7XG4gICAgaWYodHlwZSA9PT0gQ0hBTkdFUyB8fCB0eXBlID09PSBDT05ORUNUKXtcbiAgICAgICAgc2VuZCh0eXBlICsgJzonICsgY3JlYXRlQ2hhbmdlcyhzY29wZSwgZGF0YSkpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc2VuZEludm9rZShzY29wZSwgc2VuZEludm9rZSl7XG4gICAgc2VuZEludm9rZShJTlZPS0UgKyAnOicgKyBKU09OLnN0cmluZ2lmeShBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpKSk7XG59XG5cbmZ1bmN0aW9uIGdldENoYW5nZUluZm8oc2NvcGUsIGNoYW5nZSl7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdGFyZ2V0OiBzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKGNoYW5nZVswXSksXG4gICAgICAgIGtleTogY2hhbmdlWzFdLFxuICAgICAgICB0eXBlOiBjaGFuZ2VbMl0sXG4gICAgICAgIHZhbHVlOiBBcnJheS5pc0FycmF5KGNoYW5nZVszXSkgPyBzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKGNoYW5nZVszXSkgOiBjaGFuZ2VbM11cbiAgICB9O1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpc2UodmFsdWUpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBpZih0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpe1xuICAgICAgICB2YXIgcmVzdWx0ID0ge307XG5cbiAgICAgICAgZm9yKHZhciBrZXkgaW4gdmFsdWUpe1xuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZVtrZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFtyZXN1bHQsIExFTlpFX0ZVTkNUSU9OXTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRlc2VyaWFsaXNlKGRlZmluaXRpb24pe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBpZihkZWZpbml0aW9uWzFdID09PSBMRU5aRV9GVU5DVElPTil7XG4gICAgICAgIHZhciB2YWx1ZSA9IGRlZmluaXRpb25bMF0sXG4gICAgICAgICAgICByZXN1bHQgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgICAgIHNjb3BlLmludm9rZS5hcHBseShudWxsLCBbc2NvcGUudmlzY291cy5nZXRJZChyZXN1bHQpXS5jb25jYXQoc2NvcGUudmlzY291cy5kZXNjcmliZShBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKSkpO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICBmb3IodmFyIGtleSBpbiB2YWx1ZSl7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlW2tleV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaW5pdFNjb3BlKHN0YXRlLCBzZXR0aW5ncyl7XG5cbiAgICBpZighc2V0dGluZ3Mpe1xuICAgICAgICBzZXR0aW5ncyA9IHt9O1xuICAgIH1cblxuICAgIHZhciBzdGF0ZSA9IHN0YXRlIHx8IHt9O1xuXG4gICAgdmFyIHNjb3BlID0ge307XG5cbiAgICBzY29wZS5sZW56ZSA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgICBzY29wZS52aXNjb3VzID0gdmlzY291cyhzdGF0ZSwge1xuICAgICAgICBzZXJpYWxpc2VyOiBzZXJpYWxpc2UuYmluZChzY29wZSksXG4gICAgICAgIGRlc2VyaWFsaXNlcjogZGVzZXJpYWxpc2UuYmluZChzY29wZSlcbiAgICB9KTtcblxuICAgIHNjb3BlLmxlbnplLnVwZGF0ZSA9IHVwZGF0ZS5iaW5kKHNjb3BlKTtcbiAgICBzY29wZS5sZW56ZS5nZXRDaGFuZ2VJbmZvID0gc2h1dihnZXRDaGFuZ2VJbmZvLCBzY29wZSk7XG4gICAgc2NvcGUubGVuemUuc3RhdGUgPSBzdGF0ZTtcblxuICAgIHJldHVybiBzY29wZTtcbn1cblxuZnVuY3Rpb24gaW5pdChzdGF0ZSwgc2V0dGluZ3Mpe1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPCAyKXtcbiAgICAgICAgc2V0dGluZ3MgPSBzdGF0ZTtcbiAgICAgICAgc3RhdGUgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBzY29wZSA9IGluaXRTY29wZShzdGF0ZSwgc2V0dGluZ3MpO1xuXG4gICAgc2NvcGUuaGFuZGxlRnVuY3Rpb24gPSBzaHV2KGhhbmRsZUZ1bmN0aW9uLCBzY29wZSk7XG4gICAgc2NvcGUuc2VuZCA9IHNodXYoc2VuZCwgc2NvcGUsIHNldHRpbmdzLnNlbmQpO1xuICAgIHNldHRpbmdzLnJlY2VpdmUoc2h1dihyZWNlaXZlLCBzY29wZSkpO1xuXG4gICAgc2NvcGUubWluSW50ZXJ2YWwgPSBzZXR0aW5ncy5taW5JbnRlcnZhbCB8fCAzMDsgLy8gQWJvdXQgdHdvIGZyYW1lc1xuICAgIHNjb3BlLm1heEludGVydmFsID0gc2V0dGluZ3MubWF4SW50ZXJ2YWwgfHwgMzAwOyAvLyBBYm91dCB3aGF0IGh1bWFucyBmaW5kIFwicXVpY2tcIlxuICAgIHNjb3BlLmRvemVUaW1lID0gc2V0dGluZ3MuZG96ZVRpbWUgfHwgMTAwMDsgLy8gQWJvdXQgaG93IGxvbmcgYmV0d2VlbiBsaW5rZWQgaHVtYW4gYWN0aW9uc1xuXG4gICAgc2V0SW50ZXJ2YWwoc2NvcGUubGVuemUudXBkYXRlLCBzY29wZS5taW5JbnRlcnZhbCk7XG5cbiAgICByZXR1cm4gc2NvcGUubGVuemU7XG59XG5cbmZ1bmN0aW9uIHJlcGxpY2FudChzdGF0ZSwgc2V0dGluZ3Mpe1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPCAyKXtcbiAgICAgICAgc2V0dGluZ3MgPSBzdGF0ZTtcbiAgICAgICAgc3RhdGUgPSBudWxsO1xuICAgIH1cblxuICAgIHZhciBzY29wZSA9IGluaXRTY29wZShzdGF0ZSk7XG5cbiAgICBzY29wZS5pbnN0YW5jZUhhc2ggPSB7fTtcblxuICAgIHNldHRpbmdzLnJlY2VpdmUoZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIGlmKCFzY29wZS5yZWFkeSl7XG4gICAgICAgICAgICBzY29wZS5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBzY29wZS5sZW56ZS5lbWl0KCdyZWFkeScpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG1lc3NhZ2UgPSBwYXJzZU1lc3NhZ2UoZGF0YSk7XG5cbiAgICAgICAgaWYoIW1lc3NhZ2Upe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYobWVzc2FnZS50eXBlID09PSBTVEFURSB8fCBtZXNzYWdlLnR5cGUgPT09IENPTk5FQ1Qpe1xuICAgICAgICAgICAgc2NvcGUudmlzY291cy5hcHBseShpbmZsYXRlQ2hhbmdlcyhzY29wZSwgbWVzc2FnZS5kYXRhKSk7XG4gICAgICAgICAgICBzY29wZS5sZW56ZS51cGRhdGUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKG1lc3NhZ2UudHlwZSA9PT0gQ0hBTkdFUyl7XG4gICAgICAgICAgICBzY29wZS52aXNjb3VzLmFwcGx5KGluZmxhdGVDaGFuZ2VzKHNjb3BlLCBtZXNzYWdlLmRhdGEpKTtcbiAgICAgICAgICAgIHNjb3BlLmxlbnplLnVwZGF0ZSgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBzY29wZS5pbnZva2UgPSBzaHV2KHNlbmRJbnZva2UsIHNjb3BlLCBzZXR0aW5ncy5zZW5kKTtcblxuICAgIHNldHRpbmdzLnNlbmQoQ09OTkVDVCArICc6Jyk7XG5cbiAgICByZXR1cm4gc2NvcGUubGVuemVcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xubW9kdWxlLmV4cG9ydHMucmVwbGljYW50ID0gcmVwbGljYW50O1xuIiwidmFyIEFqYXggPSByZXF1aXJlKCdzaW1wbGUtYWpheCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHNldHRpbmdzLCBjYWxsYmFjayl7XG4gICAgaWYodHlwZW9mIHNldHRpbmdzID09PSAnc3RyaW5nJyl7XG4gICAgICAgIHNldHRpbmdzID0ge1xuICAgICAgICAgICAgdXJsOiBzZXR0aW5nc1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGlmKHR5cGVvZiBzZXR0aW5ncyAhPT0gJ29iamVjdCcpe1xuICAgICAgICB0aHJvdyAnc2V0dGluZ3MgbXVzdCBiZSBhIHN0cmluZyBvciBvYmplY3QnO1xuICAgIH1cblxuICAgIGlmKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJyl7XG4gICAgICAgIHRocm93ICdjcGpheCBtdXN0IGJlIHBhc3NlZCBhIGNhbGxiYWNrIGFzIHRoZSBzZWNvbmQgcGFyYW1ldGVyJztcbiAgICB9XG5cbiAgICB2YXIgYWpheCA9IG5ldyBBamF4KHNldHRpbmdzKTtcblxuICAgIGFqYXgub24oJ3N1Y2Nlc3MnLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBkYXRhLCBldmVudCk7XG4gICAgfSk7XG4gICAgYWpheC5vbignZXJyb3InLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBjYWxsYmFjayhuZXcgRXJyb3IoZXZlbnQudGFyZ2V0LnJlc3BvbnNlVGV4dCksIG51bGwsIGV2ZW50KTtcbiAgICB9KTtcblxuICAgIGFqYXguc2VuZCgpO1xuXG4gICAgcmV0dXJuIGFqYXg7XG59OyIsIi8qIVxuXHRxdWVyeS1zdHJpbmdcblx0UGFyc2UgYW5kIHN0cmluZ2lmeSBVUkwgcXVlcnkgc3RyaW5nc1xuXHRodHRwczovL2dpdGh1Yi5jb20vc2luZHJlc29yaHVzL3F1ZXJ5LXN0cmluZ1xuXHRieSBTaW5kcmUgU29yaHVzXG5cdE1JVCBMaWNlbnNlXG4qL1xuKGZ1bmN0aW9uICgpIHtcblx0J3VzZSBzdHJpY3QnO1xuXHR2YXIgcXVlcnlTdHJpbmcgPSB7fTtcblxuXHRxdWVyeVN0cmluZy5wYXJzZSA9IGZ1bmN0aW9uIChzdHIpIHtcblx0XHRpZiAodHlwZW9mIHN0ciAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9XG5cblx0XHRzdHIgPSBzdHIudHJpbSgpLnJlcGxhY2UoL14oXFw/fCMpLywgJycpO1xuXG5cdFx0aWYgKCFzdHIpIHtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3RyLnRyaW0oKS5zcGxpdCgnJicpLnJlZHVjZShmdW5jdGlvbiAocmV0LCBwYXJhbSkge1xuXHRcdFx0dmFyIHBhcnRzID0gcGFyYW0ucmVwbGFjZSgvXFwrL2csICcgJykuc3BsaXQoJz0nKTtcblx0XHRcdHZhciBrZXkgPSBwYXJ0c1swXTtcblx0XHRcdHZhciB2YWwgPSBwYXJ0c1sxXTtcblxuXHRcdFx0a2V5ID0gZGVjb2RlVVJJQ29tcG9uZW50KGtleSk7XG5cdFx0XHQvLyBtaXNzaW5nIGA9YCBzaG91bGQgYmUgYG51bGxgOlxuXHRcdFx0Ly8gaHR0cDovL3czLm9yZy9UUi8yMDEyL1dELXVybC0yMDEyMDUyNC8jY29sbGVjdC11cmwtcGFyYW1ldGVyc1xuXHRcdFx0dmFsID0gdmFsID09PSB1bmRlZmluZWQgPyBudWxsIDogZGVjb2RlVVJJQ29tcG9uZW50KHZhbCk7XG5cblx0XHRcdGlmICghcmV0Lmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRcdFx0cmV0W2tleV0gPSB2YWw7XG5cdFx0XHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkocmV0W2tleV0pKSB7XG5cdFx0XHRcdHJldFtrZXldLnB1c2godmFsKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldFtrZXldID0gW3JldFtrZXldLCB2YWxdO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmV0O1xuXHRcdH0sIHt9KTtcblx0fTtcblxuXHRxdWVyeVN0cmluZy5zdHJpbmdpZnkgPSBmdW5jdGlvbiAob2JqKSB7XG5cdFx0cmV0dXJuIG9iaiA/IE9iamVjdC5rZXlzKG9iaikubWFwKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRcdHZhciB2YWwgPSBvYmpba2V5XTtcblxuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkodmFsKSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsLm1hcChmdW5jdGlvbiAodmFsMikge1xuXHRcdFx0XHRcdHJldHVybiBlbmNvZGVVUklDb21wb25lbnQoa2V5KSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWwyKTtcblx0XHRcdFx0fSkuam9pbignJicpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KGtleSkgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQodmFsKTtcblx0XHR9KS5qb2luKCcmJykgOiAnJztcblx0fTtcblxuXHRpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG5cdFx0ZGVmaW5lKGZ1bmN0aW9uKCkgeyByZXR1cm4gcXVlcnlTdHJpbmc7IH0pO1xuXHR9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG5cdFx0bW9kdWxlLmV4cG9ydHMgPSBxdWVyeVN0cmluZztcblx0fSBlbHNlIHtcblx0XHRzZWxmLnF1ZXJ5U3RyaW5nID0gcXVlcnlTdHJpbmc7XG5cdH1cbn0pKCk7XG4iLCJ2YXIgcGxhY2Vob2xkZXIgPSB7fSxcbiAgICBlbmRPZkFyZ3MgPSB7fSxcbiAgICBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsLmJpbmQoQXJyYXkucHJvdG90eXBlLnNsaWNlKTtcblxuZnVuY3Rpb24gc2h1dihmbil7XG4gICAgdmFyIG91dGVyQXJncyA9IHNsaWNlKGFyZ3VtZW50cywgMSk7XG5cbiAgICBpZih0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG9yIG5vbi1mdW5jdGlvbiBwYXNzZWQgdG8gc2h1dicpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbigpe1xuICAgICAgICB2YXIgY29udGV4dCA9IHRoaXMsXG4gICAgICAgICAgICBpbm5lckFyZ3MgPSBzbGljZShhcmd1bWVudHMpLFxuICAgICAgICAgICAgZmluYWxBcmdzID0gW10sXG4gICAgICAgICAgICBhcHBlbmQgPSB0cnVlO1xuXG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBvdXRlckFyZ3MubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgdmFyIG91dGVyQXJnID0gb3V0ZXJBcmdzW2ldO1xuXG4gICAgICAgICAgICBpZihvdXRlckFyZyA9PT0gZW5kT2ZBcmdzKXtcbiAgICAgICAgICAgICAgICBhcHBlbmQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYob3V0ZXJBcmcgPT09IHBsYWNlaG9sZGVyKXtcbiAgICAgICAgICAgICAgICBmaW5hbEFyZ3MucHVzaChpbm5lckFyZ3Muc2hpZnQoKSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZpbmFsQXJncy5wdXNoKG91dGVyQXJnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGFwcGVuZCl7XG4gICAgICAgICAgICBmaW5hbEFyZ3MgPSBmaW5hbEFyZ3MuY29uY2F0KGlubmVyQXJncyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZm4uYXBwbHkoY29udGV4dCwgZmluYWxBcmdzKTtcbiAgICB9O1xufVxuXG5zaHV2Ll8gPSBwbGFjZWhvbGRlcjtcbnNodXYuJCA9IGVuZE9mQXJncztcblxubW9kdWxlLmV4cG9ydHMgPSBzaHV2OyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXG4gICAgcXVlcnlTdHJpbmcgPSByZXF1aXJlKCdxdWVyeS1zdHJpbmcnKTtcblxuZnVuY3Rpb24gdHJ5UGFyc2VKc29uKGRhdGEpe1xuICAgIHRyeXtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UoZGF0YSk7XG4gICAgfWNhdGNoKGVycm9yKXtcbiAgICAgICAgcmV0dXJuIGVycm9yO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdGltZW91dCgpe1xuICAgdGhpcy5yZXF1ZXN0LmFib3J0KCk7XG4gICB0aGlzLmVtaXQoJ3RpbWVvdXQnKTtcbn1cblxuZnVuY3Rpb24gQWpheChzZXR0aW5ncyl7XG4gICAgdmFyIHF1ZXJ5U3RyaW5nRGF0YSxcbiAgICAgICAgYWpheCA9IHRoaXM7XG5cbiAgICBpZih0eXBlb2Ygc2V0dGluZ3MgPT09ICdzdHJpbmcnKXtcbiAgICAgICAgc2V0dGluZ3MgPSB7XG4gICAgICAgICAgICB1cmw6IHNldHRpbmdzXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgaWYodHlwZW9mIHNldHRpbmdzICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHNldHRpbmdzID0ge307XG4gICAgfVxuXG4gICAgYWpheC5zZXR0aW5ncyA9IHNldHRpbmdzO1xuICAgIGFqYXgucmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgIGFqYXguc2V0dGluZ3MubWV0aG9kID0gYWpheC5zZXR0aW5ncy5tZXRob2QgfHwgJ2dldCc7XG5cbiAgICBpZihhamF4LnNldHRpbmdzLmNvcnMpe1xuICAgICAgICBpZiAoJ3dpdGhDcmVkZW50aWFscycgaW4gYWpheC5yZXF1ZXN0KSB7XG4gICAgICAgICAgICBhamF4LnJlcXVlc3Qud2l0aENyZWRlbnRpYWxzID0gISFzZXR0aW5ncy53aXRoQ3JlZGVudGlhbHM7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIFhEb21haW5SZXF1ZXN0ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgLy8gWERvbWFpblJlcXVlc3Qgb25seSBleGlzdHMgaW4gSUUsIGFuZCBpcyBJRSdzIHdheSBvZiBtYWtpbmcgQ09SUyByZXF1ZXN0cy5cbiAgICAgICAgICAgIGFqYXgucmVxdWVzdCA9IG5ldyBYRG9tYWluUmVxdWVzdCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gT3RoZXJ3aXNlLCBDT1JTIGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhlIGJyb3dzZXIuXG4gICAgICAgICAgICBhamF4LmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKCdDb3JzIGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBicm93c2VyJykpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYoYWpheC5zZXR0aW5ncy5jYWNoZSA9PT0gZmFsc2Upe1xuICAgICAgICBhamF4LnNldHRpbmdzLmRhdGEgPSBhamF4LnNldHRpbmdzLmRhdGEgfHwge307XG4gICAgICAgIGFqYXguc2V0dGluZ3MuZGF0YS5fID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgfVxuXG4gICAgaWYoYWpheC5zZXR0aW5ncy5tZXRob2QudG9Mb3dlckNhc2UoKSA9PT0gJ2dldCcgJiYgdHlwZW9mIGFqYXguc2V0dGluZ3MuZGF0YSA9PT0gJ29iamVjdCcpe1xuICAgICAgICB2YXIgdXJsUGFydHMgPSBhamF4LnNldHRpbmdzLnVybC5zcGxpdCgnPycpO1xuXG4gICAgICAgIHF1ZXJ5U3RyaW5nRGF0YSA9IHF1ZXJ5U3RyaW5nLnBhcnNlKHVybFBhcnRzWzFdKTtcblxuICAgICAgICBmb3IodmFyIGtleSBpbiBhamF4LnNldHRpbmdzLmRhdGEpe1xuICAgICAgICAgICAgcXVlcnlTdHJpbmdEYXRhW2tleV0gPSBhamF4LnNldHRpbmdzLmRhdGFba2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFqYXguc2V0dGluZ3MudXJsID0gdXJsUGFydHNbMF0gKyAnPycgKyBxdWVyeVN0cmluZy5zdHJpbmdpZnkocXVlcnlTdHJpbmdEYXRhKTtcbiAgICAgICAgYWpheC5zZXR0aW5ncy5kYXRhID0gbnVsbDtcbiAgICB9XG5cbiAgICBhamF4LnJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcigncHJvZ3Jlc3MnLCBmdW5jdGlvbihldmVudCl7XG4gICAgICAgIGFqYXguZW1pdCgncHJvZ3Jlc3MnLCBldmVudCk7XG4gICAgfSwgZmFsc2UpO1xuXG4gICAgYWpheC5yZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbihldmVudCl7XG4gICAgICAgIHZhciBkYXRhID0gZXZlbnQudGFyZ2V0LnJlc3BvbnNlVGV4dDtcblxuICAgICAgICBpZihhamF4LnNldHRpbmdzLmRhdGFUeXBlICYmIGFqYXguc2V0dGluZ3MuZGF0YVR5cGUudG9Mb3dlckNhc2UoKSA9PT0gJ2pzb24nKXtcbiAgICAgICAgICAgIGlmKGRhdGEgPT09ICcnKXtcbiAgICAgICAgICAgICAgICBkYXRhID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHRyeVBhcnNlSnNvbihkYXRhKTtcbiAgICAgICAgICAgICAgICBpZihkYXRhIGluc3RhbmNlb2YgRXJyb3Ipe1xuICAgICAgICAgICAgICAgICAgICBhamF4LmVtaXQoJ2Vycm9yJywgZXZlbnQsIGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYoZXZlbnQudGFyZ2V0LnN0YXR1cyA+PSA0MDApe1xuICAgICAgICAgICAgYWpheC5lbWl0KCdlcnJvcicsIGV2ZW50LCBkYXRhKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFqYXguZW1pdCgnc3VjY2VzcycsIGV2ZW50LCBkYXRhKTtcbiAgICAgICAgfVxuXG4gICAgfSwgZmFsc2UpO1xuXG4gICAgYWpheC5yZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgICBhamF4LmVtaXQoJ2Vycm9yJywgZXZlbnQpO1xuICAgIH0sIGZhbHNlKTtcblxuICAgIGFqYXgucmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdhYm9ydCcsIGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgICAgYWpheC5lbWl0KCdlcnJvcicsIGV2ZW50LCBuZXcgRXJyb3IoJ0Nvbm5lY3Rpb24gQWJvcnRlZCcpKTtcbiAgICAgICAgYWpheC5lbWl0KCdhYm9ydCcsIGV2ZW50KTtcbiAgICB9LCBmYWxzZSk7XG5cbiAgICBhamF4LnJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignbG9hZGVuZCcsIGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3JlcXVlc3RUaW1lb3V0KTtcbiAgICAgICAgYWpheC5lbWl0KCdjb21wbGV0ZScsIGV2ZW50KTtcbiAgICB9LCBmYWxzZSk7XG5cbiAgICBhamF4LnJlcXVlc3Qub3BlbihhamF4LnNldHRpbmdzLm1ldGhvZCB8fCAnZ2V0JywgYWpheC5zZXR0aW5ncy51cmwsIHRydWUpO1xuXG4gICAgLy8gU2V0IGRlZmF1bHQgaGVhZGVyc1xuICAgIGlmKGFqYXguc2V0dGluZ3MuY29udGVudFR5cGUgIT09IGZhbHNlKXtcbiAgICAgICAgYWpheC5yZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIGFqYXguc2V0dGluZ3MuY29udGVudFR5cGUgfHwgJ2FwcGxpY2F0aW9uL2pzb247IGNoYXJzZXQ9dXRmLTgnKTtcbiAgICB9XG4gICAgaWYoYWpheC5zZXR0aW5ncy5yZXF1ZXN0ZWRXaXRoICE9PSBmYWxzZSkge1xuICAgICAgICBhamF4LnJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcignWC1SZXF1ZXN0ZWQtV2l0aCcsIGFqYXguc2V0dGluZ3MucmVxdWVzdGVkV2l0aCB8fCAnWE1MSHR0cFJlcXVlc3QnKTtcbiAgICB9XG4gICAgaWYoYWpheC5zZXR0aW5ncy5hdXRoKXtcbiAgICAgICAgYWpheC5yZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoJ0F1dGhvcml6YXRpb24nLCBhamF4LnNldHRpbmdzLmF1dGgpO1xuICAgIH1cblxuICAgIC8vIFNldCBjdXN0b20gaGVhZGVyc1xuICAgIGZvcih2YXIgaGVhZGVyS2V5IGluIGFqYXguc2V0dGluZ3MuaGVhZGVycyl7XG4gICAgICAgIGFqYXgucmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKGhlYWRlcktleSwgYWpheC5zZXR0aW5ncy5oZWFkZXJzW2hlYWRlcktleV0pO1xuICAgIH1cblxuICAgIGlmKGFqYXguc2V0dGluZ3MucHJvY2Vzc0RhdGEgIT09IGZhbHNlICYmIGFqYXguc2V0dGluZ3MuZGF0YVR5cGUgPT09ICdqc29uJyl7XG4gICAgICAgIGFqYXguc2V0dGluZ3MuZGF0YSA9IEpTT04uc3RyaW5naWZ5KGFqYXguc2V0dGluZ3MuZGF0YSk7XG4gICAgfVxufVxuXG5BamF4LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5cbkFqYXgucHJvdG90eXBlLnNlbmQgPSBmdW5jdGlvbigpe1xuICAgIHRoaXMuX3JlcXVlc3RUaW1lb3V0ID0gc2V0VGltZW91dChcbiAgICAgICAgdGltZW91dC5iaW5kKHRoaXMpLFxuICAgICAgICB0aGlzLnNldHRpbmdzLnRpbWVvdXQgfHwgMTIwMDAwXG4gICAgKTtcbiAgICB0aGlzLnJlcXVlc3Quc2VuZCh0aGlzLnNldHRpbmdzLmRhdGEgJiYgdGhpcy5zZXR0aW5ncy5kYXRhKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQWpheDtcbiIsInZhciBzYW1lVmFsdWUgPSByZXF1aXJlKCdzYW1lLXZhbHVlJyk7XG5cbnZhciBSRU1PVkVEID0gJ3InO1xudmFyIEFEREVEID0gJ2EnO1xudmFyIEVESVRFRCA9ICdlJztcblxudmFyIEFSUkFZID0gJ2EnO1xudmFyIEZVTkNUSU9OID0gJ2YnO1xudmFyIERBVEUgPSAnZCc7XG5cbmZ1bmN0aW9uIGlzSW5zdGFuY2UodmFsdWUpe1xuICAgIHZhciB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICAgIHJldHVybiB2YWx1ZSAmJiB0eXBlID09PSAnb2JqZWN0JyB8fCB0eXBlID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBzYW1lKGEsIGIpe1xuICAgIGlmKGlzSW5zdGFuY2UoYSkgJiYgYSBpbnN0YW5jZW9mIERhdGUgJiYgYSAhPT0gYil7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gc2FtZVZhbHVlKGEsIGIpO1xufVxuXG5mdW5jdGlvbiBnZXRJZCgpe1xuICAgIHJldHVybiAodGhpcy5jdXJyZW50SWQrKykudG9TdHJpbmcoMzYpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJbnN0YW5jZUluZm8oc2NvcGUsIGlkLCB2YWx1ZSl7XG4gICAgdmFyIGluc3RhbmNlSW5mbyA9IHtcbiAgICAgICAgICAgIGlkOiBpZCxcbiAgICAgICAgICAgIGluc3RhbmNlOiB2YWx1ZSxcbiAgICAgICAgICAgIGxhc3RTdGF0ZToge30sXG4gICAgICAgICAgICBuZXc6IHRydWVcbiAgICAgICAgfTtcblxuICAgIHNjb3BlLmluc3RhbmNlc1tpbnN0YW5jZUluZm8uaWRdID0gdmFsdWU7XG4gICAgc2NvcGUudHJhY2tlZE1hcC5zZXQodmFsdWUsIGluc3RhbmNlSW5mbyk7XG5cbiAgICByZXR1cm4gaW5zdGFuY2VJbmZvO1xufVxuXG5mdW5jdGlvbiBnZXRJbnN0YW5jZUluZm8oc2NvcGUsIHZhbHVlKXtcbiAgICBpZighaXNJbnN0YW5jZSh2YWx1ZSkpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGluc3RhbmNlSW5mbyA9IHNjb3BlLnRyYWNrZWRNYXAuZ2V0KHZhbHVlKTtcblxuICAgIGlmKCFpbnN0YW5jZUluZm8pe1xuICAgICAgICBpbnN0YW5jZUluZm8gPSBjcmVhdGVJbnN0YW5jZUluZm8oc2NvcGUsIHNjb3BlLmdldElkKCksIHZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaW5zdGFuY2VJbmZvO1xufVxuXG5mdW5jdGlvbiBnZXRJbnN0YW5jZUlkKHZhbHVlKXtcbiAgICB2YXIgaW5mbyA9IGdldEluc3RhbmNlSW5mbyh0aGlzLCB2YWx1ZSk7XG5cbiAgICByZXR1cm4gaW5mbyAmJiBpbmZvLmlkO1xufVxuXG5mdW5jdGlvbiBnZXRSZW1vdmVkQ2hhbmdlKGluc3RhbmNlSW5mbywgb2JqZWN0LCBvbGRLZXkpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBpZighKG9sZEtleSBpbiBvYmplY3QpKXtcbiAgICAgICAgdmFyIG9sZFZhbHVlID0gaW5zdGFuY2VJbmZvLmxhc3RTdGF0ZVtvbGRLZXldO1xuICAgICAgICB0aGlzLm5leHRDaGFuZ2UucHVzaChbaW5zdGFuY2VJbmZvLmlkLCBvbGRLZXksIFJFTU9WRURdKTtcblxuICAgICAgICBkZWxldGUgaW5zdGFuY2VJbmZvLmxhc3RTdGF0ZVtvbGRLZXldO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0UmVtb3ZlZENoYW5nZXMoaW5zdGFuY2VJbmZvLCBvYmplY3Qpe1xuICAgIGZ1bmN0aW9uIGdldENoYW5nZShvbGRLZXkpe1xuICAgICAgICB0aGlzLmdldFJlbW92ZWRDaGFuZ2UoaW5zdGFuY2VJbmZvLCBvYmplY3QsIG9sZEtleSk7XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMoaW5zdGFuY2VJbmZvLmxhc3RTdGF0ZSkuZm9yRWFjaChnZXRDaGFuZ2UsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiBnZXRDdXJyZW50Q2hhbmdlKGluc3RhbmNlSW5mbywgaW5zdGFuY2UsIGN1cnJlbnRLZXkpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICB2YXIgdHlwZSA9IGluc3RhbmNlSW5mby5sYXN0U3RhdGUuaGFzT3duUHJvcGVydHkoY3VycmVudEtleSkgPyBFRElURUQgOiBBRERFRCxcbiAgICAgICAgb2xkVmFsdWUgPSBpbnN0YW5jZUluZm8ubGFzdFN0YXRlW2N1cnJlbnRLZXldLFxuICAgICAgICBjdXJyZW50VmFsdWUgPSBpbnN0YW5jZVtjdXJyZW50S2V5XSxcbiAgICAgICAgY2hhbmdlID0gW2luc3RhbmNlSW5mby5pZCwgY3VycmVudEtleSwgdHlwZV0sXG4gICAgICAgIGNoYW5nZWQgPSAhc2FtZShvbGRWYWx1ZSwgY3VycmVudFZhbHVlKTtcblxuICAgIGlmKGNoYW5nZWQgfHwgdHlwZSA9PT0gQURERUQpe1xuICAgICAgICBpbnN0YW5jZUluZm8ubGFzdFN0YXRlW2N1cnJlbnRLZXldID0gY3VycmVudFZhbHVlO1xuICAgICAgICB0aGlzLm5leHRDaGFuZ2UucHVzaChjaGFuZ2UpO1xuICAgIH1cblxuICAgIGlmKCFpc0luc3RhbmNlKGN1cnJlbnRWYWx1ZSkpe1xuICAgICAgICBjaGFuZ2UucHVzaChjdXJyZW50VmFsdWUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGluc3RhbmNlSWQgPSBzY29wZS52aXNjb3VzLmdldElkKGluc3RhbmNlW2N1cnJlbnRLZXldKTtcblxuICAgIHNjb3BlLmN1cnJlbnRJbnN0YW5jZXMuYWRkKGluc3RhbmNlSWQpO1xuXG4gICAgc2NvcGUuZ2V0T2JqZWN0Q2hhbmdlcyhjdXJyZW50VmFsdWUpO1xuXG4gICAgaWYoY2hhbmdlZCl7XG4gICAgICAgIGNoYW5nZS5wdXNoKFtpbnN0YW5jZUlkXSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDdXJyZW50Q2hhbmdlcyhpbnN0YW5jZUluZm8sIGluc3RhbmNlKXtcbiAgICBmdW5jdGlvbiBnZXRDaGFuZ2UoY3VycmVudEtleSl7XG4gICAgICAgIHRoaXMuZ2V0Q3VycmVudENoYW5nZShpbnN0YW5jZUluZm8sIGluc3RhbmNlLCBjdXJyZW50S2V5KTtcbiAgICB9XG5cbiAgICBPYmplY3Qua2V5cyhpbnN0YW5jZSkuZm9yRWFjaChnZXRDaGFuZ2UsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJbnN0YW5jZURlZmluaXRpb24oc2NvcGUsIGluc3RhbmNlKXtcbiAgICB2YXIgcmVzdWx0ID0gc2NvcGUuc2V0dGluZ3Muc2VyaWFsaXNlcihpbnN0YW5jZSk7XG5cbiAgICBpZighcmVzdWx0KXtcbiAgICAgICAgcmVzdWx0ID0gW107XG4gICAgICAgIHZhciB2YWx1ZSA9IGluc3RhbmNlO1xuXG4gICAgICAgIGlmKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSl7XG4gICAgICAgICAgICByZXR1cm4gW3ZhbHVlLnRvSVNPU3RyaW5nKCksIERBVEVdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKGZ1bmN0aW9uKCl7cmV0dXJuIGluc3RhbmNlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyl9LCBGVU5DVElPTik7XG4gICAgICAgIH1lbHNlIGlmKEFycmF5LmlzQXJyYXkodmFsdWUpKXtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHt9LCBBUlJBWSk7XG4gICAgICAgIH1lbHNlIGlmKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpe1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goe30pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMoaW5zdGFuY2UpLmZvckVhY2goZnVuY3Rpb24oa2V5KXtcbiAgICAgICAgdmFyIGlkID0gc2NvcGUudmlzY291cy5nZXRJZChpbnN0YW5jZVtrZXldKTtcbiAgICAgICAgcmVzdWx0WzBdW2tleV0gPSBpZCA/IFtpZF0gOiBpbnN0YW5jZVtrZXldO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gZ2V0T2JqZWN0Q2hhbmdlcyhvYmplY3Qpe1xuICAgIGlmKHRoaXMuc2Nhbm5lZC5oYXMob2JqZWN0KSl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5zY2FubmVkLmFkZChvYmplY3QpO1xuXG4gICAgdmFyIHNjb3BlID0gdGhpcztcblxuICAgIHZhciBpbnN0YW5jZUluZm8gPSBnZXRJbnN0YW5jZUluZm8oc2NvcGUsIG9iamVjdCksXG4gICAgICAgIGlzTmV3ID0gaW5zdGFuY2VJbmZvLm5ldyAmJiBvYmplY3QgIT09IHNjb3BlLnN0YXRlO1xuXG4gICAgc2NvcGUuZ2V0UmVtb3ZlZENoYW5nZXMoaW5zdGFuY2VJbmZvLCBvYmplY3QpO1xuICAgIHNjb3BlLmdldEN1cnJlbnRDaGFuZ2VzKGluc3RhbmNlSW5mbywgb2JqZWN0KTtcblxuICAgIGlmKCFpc05ldyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpbnN0YW5jZUluZm8ubmV3ID0gZmFsc2U7XG4gICAgdGhpcy5uZXh0Q2hhbmdlWzBdLnB1c2goW2luc3RhbmNlSW5mby5pZCwgY3JlYXRlSW5zdGFuY2VEZWZpbml0aW9uKHNjb3BlLCBvYmplY3QpXSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUdhcmJhZ2VDaGFuZ2UoaWQpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgaWYoIXNjb3BlLmN1cnJlbnRJbnN0YW5jZXMuaGFzKGlkKSl7XG4gICAgICAgIHNjb3BlLnRyYWNrZWRNYXAuZGVsZXRlKHNjb3BlLmluc3RhbmNlc1tpZF0pO1xuICAgICAgICBkZWxldGUgc2NvcGUuaW5zdGFuY2VzW2lkXTtcbiAgICAgICAgc2NvcGUubmV4dENoYW5nZVswXS51bnNoaWZ0KFtpZCwgUkVNT1ZFRF0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gY2hhbmdlcygpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICAvLyBUaGlzIGlzIGhvdyBub3QgdG8gd3JpdGUgY29kZSAxMDEsXG4gICAgLy8gQnV0IGFueXRoaW5nIGluIHRoZSBuYW1lIG9mIHBlcmZvcm1hbmNlIDpQXG5cbiAgICBzY29wZS5uZXh0Q2hhbmdlWzBdID0gW107XG4gICAgc2NvcGUuc2Nhbm5lZCA9IG5ldyBXZWFrU2V0KCk7XG4gICAgc2NvcGUuY3VycmVudEluc3RhbmNlcy5jbGVhcigpO1xuICAgIHNjb3BlLmN1cnJlbnRJbnN0YW5jZXMuYWRkKCcwJyk7XG5cbiAgICBzY29wZS5nZXRPYmplY3RDaGFuZ2VzKHNjb3BlLnN0YXRlKTtcblxuICAgIE9iamVjdC5rZXlzKHRoaXMuaW5zdGFuY2VzKS5mb3JFYWNoKGNyZWF0ZUdhcmJhZ2VDaGFuZ2UsIHRoaXMpO1xuXG4gICAgcmV0dXJuIHNjb3BlLm5leHRDaGFuZ2Uuc3BsaWNlKDAsIHNjb3BlLm5leHRDaGFuZ2UubGVuZ3RoKTtcbn1cblxuZnVuY3Rpb24gZ2V0U3RhdGUoKXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuXG4gICAgc2NvcGUudmlzY291cy5jaGFuZ2VzKCk7XG5cbiAgICByZXR1cm4gW09iamVjdC5rZXlzKHNjb3BlLmluc3RhbmNlcykucmV2ZXJzZSgpLm1hcChmdW5jdGlvbihrZXkpe1xuICAgICAgICByZXR1cm4gW2tleSwgY3JlYXRlSW5zdGFuY2VEZWZpbml0aW9uKHNjb3BlLCBzY29wZS5pbnN0YW5jZXNba2V5XSldO1xuICAgIH0pXTtcbn1cblxuZnVuY3Rpb24gYXBwbHlPYmplY3RDaGFuZ2UodGFyZ2V0LCBuZXdTdGF0ZSwgdG9JbmZsYXRlKXtcbiAgICBpZihBcnJheS5pc0FycmF5KG5ld1N0YXRlKSl7XG4gICAgICAgIG5ld1N0YXRlID0gbmV3U3RhdGVbMF07XG4gICAgICAgIHRvSW5mbGF0ZS5wdXNoKFt0YXJnZXQsIG5ld1N0YXRlXSk7XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXModGFyZ2V0KS5mb3JFYWNoKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIGlmKCFrZXkgaW4gbmV3U3RhdGUpe1xuICAgICAgICAgICAgZGVsZXRlIHRhcmdldFtrZXldO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBPYmplY3Qua2V5cyhuZXdTdGF0ZSkuZm9yRWFjaChmdW5jdGlvbihrZXkpe1xuICAgICAgICB0YXJnZXRba2V5XSA9IG5ld1N0YXRlW2tleV07XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGFwcGx5Um9vdENoYW5nZShzY29wZSwgbmV3U3RhdGUsIHRvSW5mbGF0ZSl7XG4gICAgYXBwbHlPYmplY3RDaGFuZ2Uoc2NvcGUuc3RhdGUsIG5ld1N0YXRlLCB0b0luZmxhdGUpO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlRGVmaW5pdGlvbihzY29wZSwgcmVzdWx0LCBwcm9wZXJ0aWVzKXtcbiAgICBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIGlmKEFycmF5LmlzQXJyYXkocHJvcGVydGllc1trZXldKSl7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IHNjb3BlLnZpc2NvdXMuZ2V0SW5zdGFuY2UocHJvcGVydGllc1trZXldWzBdKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IHByb3BlcnRpZXNba2V5XTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJbnN0YW5jZShzY29wZSwgZGVmaW5pdGlvbiwgdG9JbmZsYXRlKXtcbiAgICBpZihBcnJheS5pc0FycmF5KGRlZmluaXRpb24pKXtcbiAgICAgICAgdmFyIHR5cGUgPSBkZWZpbml0aW9uWzFdLFxuICAgICAgICAgICAgcHJvcGVydGllcyA9IGRlZmluaXRpb25bMF07XG5cbiAgICAgICAgdmFyIHJlc3VsdCA9IHNjb3BlLnNldHRpbmdzLmRlc2VyaWFsaXNlcihkZWZpbml0aW9uKTtcblxuICAgICAgICBpZihyZXN1bHQpe1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCF0eXBlKXtcbiAgICAgICAgICAgIHJlc3VsdCA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGlmKHR5cGUgPT09IEFSUkFZKXtcbiAgICAgICAgICAgIHJlc3VsdCA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmKHR5cGUgPT09IEZVTkNUSU9OKXtcbiAgICAgICAgICAgIHJlc3VsdCA9IHByb3BlcnRpZXM7XG4gICAgICAgIH1cbiAgICAgICAgaWYodHlwZSA9PT0gREFURSl7XG4gICAgICAgICAgICByZXN1bHQgPSBuZXcgRGF0ZShwcm9wZXJ0aWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGlzSW5zdGFuY2UocmVzdWx0KSl7XG4gICAgICAgICAgICB0b0luZmxhdGUucHVzaChbcmVzdWx0LCBwcm9wZXJ0aWVzXSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuZnVuY3Rpb24gYXBwbHkoY2hhbmdlcyl7XG4gICAgdmFyIHNjb3BlID0gdGhpcyxcbiAgICAgICAgaW5zdGFuY2VDaGFuZ2VzID0gY2hhbmdlc1swXSxcbiAgICAgICAgdG9JbmZsYXRlID0gW107XG5cbiAgICBpbnN0YW5jZUNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbihpbnN0YW5jZUNoYW5nZSl7XG4gICAgICAgIGlmKGluc3RhbmNlQ2hhbmdlWzFdID09PSBSRU1PVkVEKXtcbiAgICAgICAgICAgIHZhciBpbnN0YW5jZSA9IHNjb3BlLmluc3RhbmNlc1tpbnN0YW5jZUNoYW5nZVswXV07XG4gICAgICAgICAgICBzY29wZS50cmFja2VkTWFwLmRlbGV0ZShpbnN0YW5jZSk7XG4gICAgICAgICAgICBkZWxldGUgc2NvcGUuaW5zdGFuY2VzW2luc3RhbmNlQ2hhbmdlWzBdXTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICBpZihzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKGluc3RhbmNlQ2hhbmdlWzBdKSA9PT0gc2NvcGUuc3RhdGUpe1xuICAgICAgICAgICAgICAgIGFwcGx5Um9vdENoYW5nZShzY29wZSwgaW5zdGFuY2VDaGFuZ2VbMV0sIHRvSW5mbGF0ZSk7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICBjcmVhdGVJbnN0YW5jZUluZm8oc2NvcGUsIGluc3RhbmNlQ2hhbmdlWzBdLCBjcmVhdGVJbnN0YW5jZShzY29wZSwgaW5zdGFuY2VDaGFuZ2VbMV0sIHRvSW5mbGF0ZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICB0b0luZmxhdGUuZm9yRWFjaChmdW5jdGlvbihjaGFuZ2Upe1xuICAgICAgICBpbmZsYXRlRGVmaW5pdGlvbihzY29wZSwgY2hhbmdlWzBdLCBjaGFuZ2VbMV0pO1xuICAgIH0pO1xuXG4gICAgZm9yKHZhciBpID0gMTsgaSA8IGNoYW5nZXMubGVuZ3RoOyBpKyspe1xuICAgICAgICB2YXIgY2hhbmdlID0gY2hhbmdlc1tpXTtcblxuICAgICAgICBpZihjaGFuZ2VbMl0gPT09IFJFTU9WRUQpe1xuICAgICAgICAgICAgZGVsZXRlIHNjb3BlLmluc3RhbmNlc1tjaGFuZ2VbMF1dW2NoYW5nZVsxXV07XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdmFyIHZhbHVlID0gY2hhbmdlWzNdO1xuXG4gICAgICAgICAgICBpZihBcnJheS5pc0FycmF5KGNoYW5nZVszXSkpe1xuICAgICAgICAgICAgICAgIHZhbHVlID0gc2NvcGUuaW5zdGFuY2VzW2NoYW5nZVszXV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNjb3BlLmluc3RhbmNlc1tjaGFuZ2VbMF1dW2NoYW5nZVsxXV0gPSB2YWx1ZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0SW5zdGFuY2VCeUlkKGlkKXtcbiAgICByZXR1cm4gdGhpcy5pbnN0YW5jZXNbaWRdO1xufVxuXG5mdW5jdGlvbiBkZXNjcmliZShkYXRhKXtcbiAgICBpZihpc0luc3RhbmNlKGRhdGEpKXtcbiAgICAgICAgaWYodGhpcy50cmFja2VkTWFwLmhhcyhkYXRhKSl7XG4gICAgICAgICAgICByZXR1cm4gW3RoaXMudmlzY291cy5nZXRJZChkYXRhKV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNyZWF0ZUluc3RhbmNlRGVmaW5pdGlvbih0aGlzLCBkYXRhKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGF0YTtcbn1cblxuZnVuY3Rpb24gaW5mbGF0ZShkZXNjcmlwdGlvbil7XG4gICAgdmFyIHNjb3BlID0gdGhpcztcblxuICAgIGlmKEFycmF5LmlzQXJyYXkoZGVzY3JpcHRpb24pICYmIHR5cGVvZiBkZXNjcmlwdGlvblswXSA9PT0gJ3N0cmluZycpe1xuICAgICAgICByZXR1cm4gc2NvcGUudmlzY291cy5nZXRJbnN0YW5jZShkZXNjcmlwdGlvblswXSk7XG4gICAgfVxuXG4gICAgaWYoaXNJbnN0YW5jZShkZXNjcmlwdGlvbikpe1xuICAgICAgICB2YXIgdG9JbmZsYXRlID0gW107XG5cbiAgICAgICAgdmFyIHJlc3VsdCA9IGNyZWF0ZUluc3RhbmNlKHNjb3BlLCBkZXNjcmlwdGlvbiwgdG9JbmZsYXRlKTtcblxuICAgICAgICB0b0luZmxhdGUuZm9yRWFjaChmdW5jdGlvbihjaGFuZ2Upe1xuICAgICAgICAgICAgaW5mbGF0ZURlZmluaXRpb24oc2NvcGUsIGNoYW5nZVswXSwgY2hhbmdlWzFdKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVzY3JpcHRpb247XG59XG5cbmZ1bmN0aW9uIHZpc2NvdXMoc3RhdGUsIHNldHRpbmdzKXtcbiAgICBpZighc2V0dGluZ3Mpe1xuICAgICAgICBzZXR0aW5ncyA9IHtcbiAgICAgICAgICAgIHNlcmlhbGlzZXI6IGZ1bmN0aW9uKCl7fSxcbiAgICAgICAgICAgIGRlc2VyaWFsaXNlcjogZnVuY3Rpb24oKXt9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIHZpc2NvdXMgPSB7fTtcblxuICAgIHZhciBzY29wZSA9IHtcbiAgICAgICAgbmV4dENoYW5nZTogW10sXG4gICAgICAgIGN1cnJlbnRJbnN0YW5jZXM6IG5ldyBTZXQoKSxcbiAgICAgICAgc2V0dGluZ3M6IHNldHRpbmdzLFxuICAgICAgICB2aXNjb3VzOiB2aXNjb3VzLFxuICAgICAgICBjdXJyZW50SWQ6IDAsXG4gICAgICAgIHN0YXRlOiBzdGF0ZSB8fCB7fSxcbiAgICAgICAgdHJhY2tlZE1hcDogbmV3IFdlYWtNYXAoKSxcbiAgICAgICAgaW5zdGFuY2VzOiB7fVxuICAgIH07XG5cbiAgICAvLyBTY29wZSBib3VuZCBmb3IgcGVyZi5cbiAgICBzY29wZS5nZXRDdXJyZW50Q2hhbmdlcyA9IGdldEN1cnJlbnRDaGFuZ2VzLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmdldEN1cnJlbnRDaGFuZ2UgPSBnZXRDdXJyZW50Q2hhbmdlLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmdldFJlbW92ZWRDaGFuZ2VzID0gZ2V0UmVtb3ZlZENoYW5nZXMuYmluZChzY29wZSk7XG4gICAgc2NvcGUuZ2V0UmVtb3ZlZENoYW5nZSA9IGdldFJlbW92ZWRDaGFuZ2UuYmluZChzY29wZSk7XG4gICAgc2NvcGUuZ2V0T2JqZWN0Q2hhbmdlcyA9IGdldE9iamVjdENoYW5nZXMuYmluZChzY29wZSk7XG5cbiAgICBzY29wZS5nZXRJZCA9IGdldElkLmJpbmQoc2NvcGUpO1xuXG4gICAgdmlzY291cy5jaGFuZ2VzID0gY2hhbmdlcy5iaW5kKHNjb3BlKTtcbiAgICB2aXNjb3VzLmFwcGx5ID0gYXBwbHkuYmluZChzY29wZSk7XG4gICAgdmlzY291cy5zdGF0ZSA9IGdldFN0YXRlLmJpbmQoc2NvcGUpO1xuICAgIHZpc2NvdXMuZ2V0SWQgPSBnZXRJbnN0YW5jZUlkLmJpbmQoc2NvcGUpO1xuICAgIHZpc2NvdXMuZ2V0SW5zdGFuY2UgPSBnZXRJbnN0YW5jZUJ5SWQuYmluZChzY29wZSk7XG4gICAgdmlzY291cy5kZXNjcmliZSA9IGRlc2NyaWJlLmJpbmQoc2NvcGUpO1xuICAgIHZpc2NvdXMuaW5mbGF0ZSA9IGluZmxhdGUuYmluZChzY29wZSk7XG5cbiAgICB2aXNjb3VzLmNoYW5nZXMoKTtcblxuICAgIHJldHVybiB2aXNjb3VzO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHZpc2NvdXM7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzU2FtZShhLCBiKXtcbiAgICBpZihhID09PSBiKXtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgaWYoXG4gICAgICAgIHR5cGVvZiBhICE9PSB0eXBlb2YgYiB8fFxuICAgICAgICB0eXBlb2YgYSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgIShhIGluc3RhbmNlb2YgRGF0ZSAmJiBiIGluc3RhbmNlb2YgRGF0ZSlcbiAgICApe1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIFN0cmluZyhhKSA9PT0gU3RyaW5nKGIpO1xufTsiXX0=
