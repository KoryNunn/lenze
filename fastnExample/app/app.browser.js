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
importScripts('http//cdn.polyfill.io/v1/polyfill.min.js?features=all');

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
        return ~user.name.toLowerCase().indexOf((app.search || '').toLowerCase());
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
    isInstance = require('is-instance'),
    shuv = require('shuv');

var INVOKE = 'i';
var CHANGES = 'c';
var CONNECT = 'o';
var STATE = 's';
var RESULT = 'r';
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

function handleFunction(scope, id, timeStamp, args){
    scope.lastChange = Date.now();
    var targetFunction = scope.viscous.getInstance(id);

    if(typeof targetFunction !== 'function'){
       return scope.result(id, timeStamp, {type: 'error', message: 'Target was not a function'});
    }

    scope.viscous.getInstance(id).apply(this, scope.viscous.inflate(args));
    scope.lenze.update();
    scope.result(id, timeStamp, null);
}

function send(scope, send, type, data){
    if(type === CHANGES || type === CONNECT){
        send(type + ':' + createChanges(scope, data));
    }
}

function sendInvoke(scope, send, id, timeStamp, args){
    send(INVOKE + ':' + JSON.stringify([id, timeStamp, args]));
}

function sendResult(scope, send, id, timeStamp, result){
    send(RESULT + ':' + JSON.stringify([id, timeStamp, result]));
}

function getChangeInfo(scope, change){
    return {
        target: scope.viscous.getInstance(change[0]),
        key: change[1],
        type: change[2],
        value: Array.isArray(change[3]) ? scope.viscous.getInstance(change[3]) : change[3]
    };
}

function handleResult(scope, data){
    data = JSON.parse(data);
    var fnId = data[0],
        timeStamp = data[1],
        error = data[2],
        stack = scope.invokes[data[0]][data[1]];

    delete scope.invokes[data[0]][data[1]];

    if(!error){
        return;
    }

    error = new Error(error.message);
    error.stack = stack;
    throw error;
}

function serialise(value){
    var scope = this;

    if(typeof value === 'function'){
        var result = {
            name: value.name
        };

        for(var key in value){
            result[key] = value[key];
        }

        return [result, LENZE_FUNCTION];
    }
}

function createCaller(scope, config){
    var result = function(){
        var args = Array.prototype.map.call(arguments, function(arg){
            if(isInstance(arg)){
                if(arg instanceof Event){
                    console.warn("Lenze does not support the transmission of browser Events");
                    return;
                }
            }
            return arg;
        });

        var stack = new Error().stack,
            fnId = scope.viscous.getId(result),
            timeStamp = Date.now();

        scope.invokes[fnId] = scope.invokes[fnId] || {};
        scope.invokes[fnId][timeStamp] = stack;
        scope.invoke.call(null, scope.viscous.getId(result), timeStamp, scope.viscous.describe(args));
    };
    result.name = config.name;

    return result;
}

function deserialise(definition){
    var scope = this;

    if(definition[1] === LENZE_FUNCTION){
        var value = definition[0],
            result = createCaller(scope, value);

        for(var key in value){
            result[key] = value[key];
        }

        return result;
    }
}

function initScope(state){
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

    var scope = initScope(state);

    scope.handleFunction = shuv(handleFunction, scope);
    scope.send = shuv(send, scope, settings.send);
    scope.result = shuv(sendResult, scope, settings.send);
    settings.receive(shuv(receive, scope));

    scope.minInterval = settings.minInterval || 30; // About two frames
    scope.maxInterval = settings.maxInterval || 300; // About what humans find "quick"
    scope.dozeTime = settings.dozeTime || 1000; // About how long between linked human actions

    setInterval(scope.lenze.update, scope.minInterval);

    setTimeout(function(){
        // Let all replicants know initial state.
        scope.send(CONNECT, scope.viscous.state());
    });

    return scope.lenze;
}

function replicant(state, settings){
    if(arguments.length < 2){
        settings = state;
        state = null;
    }

    var scope = initScope(state);

    scope.invokes = {};
    scope.instanceHash = {};

    settings.receive(function(data){

        var message = parseMessage(data);

        if(!message){
            return;
        }

        if(!scope.ready && message.type !== CONNECT){
            return;
        }

        var type = message.type;

        if(
            type === CHANGES ||
            type === STATE ||
            type === CONNECT
        ){
            scope.viscous.apply(inflateChanges(scope, message.data));
            scope.lenze.update();
        }

        if(type === RESULT){
            handleResult(scope, message.data);
        }

        if(!scope.ready){
            scope.ready = true;
            scope.lenze.emit('ready');
        }
    });

    scope.invoke = shuv(sendInvoke, scope, settings.send);

    settings.send(CONNECT + ':');

    return scope.lenze
}

module.exports = init;
module.exports.replicant = replicant;

},{"events":1,"is-instance":5,"shuv":7,"viscous":9}],4:[function(require,module,exports){
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
},{"simple-ajax":8}],5:[function(require,module,exports){
module.exports = function(value){
    return value && typeof value === 'object' || typeof value === 'function';
};
},{}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
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
},{}],8:[function(require,module,exports){
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

},{"events":1,"query-string":6}],9:[function(require,module,exports){
var sameValue = require('same-value'),
    isInstance = require('is-instance');

var REMOVED = 'r';
var ADDED = 'a';
var EDITED = 'e';

var ARRAY = 'a';
var FUNCTION = 'f';
var DATE = 'd';

function same(a, b){
    if(isInstance(a) && a instanceof Date && a !== b){
        return false;
    }

    return sameValue(a, b);
}

function getId(int){
    if(int === 0){
        return 'root';
    }
    return this.viscousId + ':' + int.toString(36);
}

function createId(){
    return this.getId(this.currentId++);
}

function createInstanceInfo(scope, id, value){
    var instanceInfo = {
            id: id,
            instance: value,
            lastState: {},
            new: true
        };

    scope.setInstance(id, value);
    scope.trackedMap.set(value, instanceInfo);

    return instanceInfo;
}

function getInstanceInfo(scope, value){
    if(!isInstance(value)){
        return;
    }

    var instanceInfo = scope.trackedMap.get(value);

    if(!instanceInfo){
        instanceInfo = createInstanceInfo(scope, scope.createId(), value);
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

    Object.keys(this.instances).forEach(createGarbageChange, this);

    return scope.nextChange.splice(0, scope.nextChange.length);
}

function getState(){
    var scope = this;

    scope.changes();

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
        instanceChanges = changes[0],
        toInflate = [];

    instanceChanges.forEach(function(instanceChange){
        if(instanceChange[1] === REMOVED){
            var instance = scope.getInstance(instanceChange[0]);
            scope.trackedMap.delete(instance);
            scope.removeInstance(instanceChange[0]);
        }else{
            if(scope.getInstance(instanceChange[0]) === scope.state){
                applyRootChange(scope, instanceChange[1], toInflate);
            }else{
                var existingInstance = scope.getInstance(instanceChange[0]);

                if(existingInstance){
                    toInflate.push([existingInstance, instanceChange[1][0]]);
                }else{
                   createInstanceInfo(scope, instanceChange[0], createInstance(scope, instanceChange[1], toInflate));
               }
            }
        }
    });

    toInflate.forEach(function(change){
        inflateDefinition(scope, change[0], change[1]);
    });

    for(var i = 1; i < changes.length; i++){
        var change = changes[i];

        if(change[2] === REMOVED){
            delete scope.getInstance(change[0])[change[1]];
        }else{
            var value = change[3];

            if(Array.isArray(change[3])){
                value = scope.getInstance(change[3]);
            }

            scope.getInstance(change[0])[change[1]] = value;
        }
    }
}

function getInstanceById(id){
    return this.instances[id];
}

function setInstanceById(id, value){
    this.instances[id] = value;
}

function removeInstanceById(id){
    delete this.instances[id];
}

function buildIdMap(scope, data, ids){
    if(!isInstance(data)){
        return;
    }

    if(scope.trackedMap.has(data)){
        ids[scope.getInstanceId(data)] = data;
        return ids;
    }

    ids[scope.getInstanceId(data)] = data;

    for(var key in data){
        buildIdMap(scope, data[key], ids);
    }

    return ids;
}

function describe(data){
    var scope = this;

    if(isInstance(data)){
        if(scope.trackedMap.has(data)){
            return [scope.getInstanceId(data)];
        }

        var ids = buildIdMap(scope, data, {});

        return Object.keys(ids).map(function(key){
            return [key, createInstanceDefinition(scope, scope.instances[key])];
        });
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

        scope.viscous.apply([description]);

        return scope.getInstance(description[0][0]);
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
        viscousId: settings.viscousId || parseInt(Math.random() * Math.pow(36,2)).toString(36),
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

    viscous.changes();

    return viscous;
}

module.exports = viscous;

},{"is-instance":10,"same-value":11}],10:[function(require,module,exports){
arguments[4][5][0].apply(exports,arguments)
},{"dup":5}],11:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92NS4zLjAvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y1LjMuMC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiZmFzdG5FeGFtcGxlL2FwcC9hcHAuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jcGpheC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9pcy1pbnN0YW5jZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9xdWVyeS1zdHJpbmcvcXVlcnktc3RyaW5nLmpzIiwibm9kZV9tb2R1bGVzL3NodXYvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc2ltcGxlLWFqYXgvaW5kZXguanMiLCIuLi92aXNjb3VzL2luZGV4LmpzIiwiLi4vdmlzY291cy9ub2RlX21vZHVsZXMvc2FtZS12YWx1ZS9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTs7QUNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ25iQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiaW1wb3J0U2NyaXB0cygnaHR0cC8vY2RuLnBvbHlmaWxsLmlvL3YxL3BvbHlmaWxsLm1pbi5qcz9mZWF0dXJlcz1hbGwnKTtcblxudmFyIGNwamF4ID0gcmVxdWlyZSgnY3BqYXgnKSxcbiAgICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICBhcHAgPSBuZXcgRXZlbnRFbWl0dGVyKCksXG4gICAgbGVuemUgPSByZXF1aXJlKCcuLi8uLi8nKShhcHAsIHtcbiAgICAgICAgY2hhbmdlSW50ZXJ2YWw6IDE2LFxuICAgICAgICBzZW5kOiBmdW5jdGlvbihkYXRhKXtcbiAgICAgICAgICAgIHNlbGYucG9zdE1lc3NhZ2UoZGF0YSk7XG4gICAgICAgIH0sXG4gICAgICAgIHJlY2VpdmU6IGZ1bmN0aW9uKGNhbGxiYWNrKXtcbiAgICAgICAgICAgIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uKG1lc3NhZ2Upe1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrKG1lc3NhZ2UuZGF0YSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG5mdW5jdGlvbiB1cGRhdGVVc2Vycygpe1xuICAgIGFwcC52aXNpYmxlVXNlcnMgPSBhcHAudXNlcnMgJiYgYXBwLnVzZXJzLmZpbHRlcihmdW5jdGlvbih1c2VyKXtcbiAgICAgICAgcmV0dXJuIH51c2VyLm5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKChhcHAuc2VhcmNoIHx8ICcnKS50b0xvd2VyQ2FzZSgpKTtcbiAgICB9KTtcbn07XG5cbmFwcC5zZXRTZWFyY2ggPSBmdW5jdGlvbih2YWx1ZSl7XG4gICAgYXBwLnNlYXJjaCA9IHZhbHVlO1xuICAgIHVwZGF0ZVVzZXJzKCk7XG59O1xuXG5hcHAuc2V0U2VsZWN0ZWRVc2VyID0gZnVuY3Rpb24odXNlcil7XG4gICAgYXBwLnNlbGVjdGVkVXNlciA9IHVzZXI7XG59O1xuXG5jcGpheCh7XG4gICAgdXJsOiAndXNlcnMuanNvbicsXG4gICAgZGF0YVR5cGU6ICdqc29uJ1xufSwgZnVuY3Rpb24oZXJyb3IsIGRhdGEpe1xuICAgIGlmKGVycm9yKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGFwcC51c2VycyA9IGRhdGEubWFwKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgICB1c2VyLnNldE5hbWUgPSBmdW5jdGlvbihuZXdOYW1lKXtcbiAgICAgICAgICAgIHVzZXIubmFtZSA9IG5ld05hbWU7XG4gICAgICAgICAgICB1cGRhdGVVc2VycygpO1xuICAgICAgICB9O1xuICAgICAgICB1c2VyLmRvYiA9IG5ldyBEYXRlKDE5MzAgKyAoTWF0aC5yYW5kb20oKSAqIDkwKSwgMSwgMSk7XG4gICAgICAgIHJldHVybiB1c2VyO1xuICAgIH0pO1xuXG4gICAgdXBkYXRlVXNlcnMoKTtcbn0pOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICB2aXNjb3VzID0gcmVxdWlyZSgndmlzY291cycpLFxuICAgIGlzSW5zdGFuY2UgPSByZXF1aXJlKCdpcy1pbnN0YW5jZScpLFxuICAgIHNodXYgPSByZXF1aXJlKCdzaHV2Jyk7XG5cbnZhciBJTlZPS0UgPSAnaSc7XG52YXIgQ0hBTkdFUyA9ICdjJztcbnZhciBDT05ORUNUID0gJ28nO1xudmFyIFNUQVRFID0gJ3MnO1xudmFyIFJFU1VMVCA9ICdyJztcbnZhciBMRU5aRV9GVU5DVElPTiA9IFN0cmluZy5mcm9tQ2hhckNvZGUoMHgxOTIpO1xuXG5mdW5jdGlvbiBjcmVhdGVDaGFuZ2VzKHNjb3BlLCBjaGFuZ2VzKXtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoY2hhbmdlcyk7XG59XG5cbmZ1bmN0aW9uIGluZmxhdGVDaGFuZ2VzKHNjb3BlLCBkYXRhKXtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShkYXRhKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VNZXNzYWdlKGRhdGEpe1xuICAgIHZhciBtZXNzYWdlID0gZGF0YS5tYXRjaCgvXihcXHcrPylcXDooLiopLyk7XG5cbiAgICBpZihtZXNzYWdlKXtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IG1lc3NhZ2VbMV0sXG4gICAgICAgICAgICBkYXRhOiBtZXNzYWdlWzJdXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlY2VpdmUoc2NvcGUsIGRhdGEpe1xuICAgIHZhciBtZXNzYWdlID0gcGFyc2VNZXNzYWdlKGRhdGEpO1xuXG4gICAgaWYoIW1lc3NhZ2Upe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYobWVzc2FnZS50eXBlID09PSBJTlZPS0Upe1xuICAgICAgICBzY29wZS5oYW5kbGVGdW5jdGlvbi5hcHBseShudWxsLCBKU09OLnBhcnNlKG1lc3NhZ2UuZGF0YSkpO1xuICAgIH1cblxuICAgIGlmKG1lc3NhZ2UudHlwZSA9PT0gQ09OTkVDVCl7XG4gICAgICAgIHNjb3BlLnNlbmQoQ09OTkVDVCwgc2NvcGUudmlzY291cy5zdGF0ZSgpKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZSgpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgdmFyIG5vdyA9IERhdGUubm93KCk7XG5cbiAgICBpZihcbiAgICAgICAgbm93IC0gc2NvcGUubGFzdFVwZGF0ZSA8IHNjb3BlLm1heEludGVydmFsICYmXG4gICAgICAgIG5vdyAtIHNjb3BlLmxhc3RDaGFuZ2UgPiBzY29wZS5kb3plVGltZVxuICAgICl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzY29wZS5sYXN0VXBkYXRlID0gbm93O1xuXG4gICAgdmFyIGNoYW5nZXMgPSBzY29wZS52aXNjb3VzLmNoYW5nZXMoKTtcblxuICAgIGlmKGNoYW5nZXMubGVuZ3RoID4gMSB8fCBjaGFuZ2VzWzBdLmxlbmd0aCA+IDEpe1xuICAgICAgICBzY29wZS5sYXN0Q2hhbmdlID0gbm93O1xuXG4gICAgICAgIHNjb3BlLmxlbnplLmVtaXQoJ2NoYW5nZScsIGNoYW5nZXMpO1xuXG4gICAgICAgIGlmKHNjb3BlLnNlbmQpe1xuICAgICAgICAgICAgc2NvcGUuc2VuZChDSEFOR0VTLCBjaGFuZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlRnVuY3Rpb24oc2NvcGUsIGlkLCB0aW1lU3RhbXAsIGFyZ3Mpe1xuICAgIHNjb3BlLmxhc3RDaGFuZ2UgPSBEYXRlLm5vdygpO1xuICAgIHZhciB0YXJnZXRGdW5jdGlvbiA9IHNjb3BlLnZpc2NvdXMuZ2V0SW5zdGFuY2UoaWQpO1xuXG4gICAgaWYodHlwZW9mIHRhcmdldEZ1bmN0aW9uICE9PSAnZnVuY3Rpb24nKXtcbiAgICAgICByZXR1cm4gc2NvcGUucmVzdWx0KGlkLCB0aW1lU3RhbXAsIHt0eXBlOiAnZXJyb3InLCBtZXNzYWdlOiAnVGFyZ2V0IHdhcyBub3QgYSBmdW5jdGlvbid9KTtcbiAgICB9XG5cbiAgICBzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKGlkKS5hcHBseSh0aGlzLCBzY29wZS52aXNjb3VzLmluZmxhdGUoYXJncykpO1xuICAgIHNjb3BlLmxlbnplLnVwZGF0ZSgpO1xuICAgIHNjb3BlLnJlc3VsdChpZCwgdGltZVN0YW1wLCBudWxsKTtcbn1cblxuZnVuY3Rpb24gc2VuZChzY29wZSwgc2VuZCwgdHlwZSwgZGF0YSl7XG4gICAgaWYodHlwZSA9PT0gQ0hBTkdFUyB8fCB0eXBlID09PSBDT05ORUNUKXtcbiAgICAgICAgc2VuZCh0eXBlICsgJzonICsgY3JlYXRlQ2hhbmdlcyhzY29wZSwgZGF0YSkpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc2VuZEludm9rZShzY29wZSwgc2VuZCwgaWQsIHRpbWVTdGFtcCwgYXJncyl7XG4gICAgc2VuZChJTlZPS0UgKyAnOicgKyBKU09OLnN0cmluZ2lmeShbaWQsIHRpbWVTdGFtcCwgYXJnc10pKTtcbn1cblxuZnVuY3Rpb24gc2VuZFJlc3VsdChzY29wZSwgc2VuZCwgaWQsIHRpbWVTdGFtcCwgcmVzdWx0KXtcbiAgICBzZW5kKFJFU1VMVCArICc6JyArIEpTT04uc3RyaW5naWZ5KFtpZCwgdGltZVN0YW1wLCByZXN1bHRdKSk7XG59XG5cbmZ1bmN0aW9uIGdldENoYW5nZUluZm8oc2NvcGUsIGNoYW5nZSl7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdGFyZ2V0OiBzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKGNoYW5nZVswXSksXG4gICAgICAgIGtleTogY2hhbmdlWzFdLFxuICAgICAgICB0eXBlOiBjaGFuZ2VbMl0sXG4gICAgICAgIHZhbHVlOiBBcnJheS5pc0FycmF5KGNoYW5nZVszXSkgPyBzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKGNoYW5nZVszXSkgOiBjaGFuZ2VbM11cbiAgICB9O1xufVxuXG5mdW5jdGlvbiBoYW5kbGVSZXN1bHQoc2NvcGUsIGRhdGEpe1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIHZhciBmbklkID0gZGF0YVswXSxcbiAgICAgICAgdGltZVN0YW1wID0gZGF0YVsxXSxcbiAgICAgICAgZXJyb3IgPSBkYXRhWzJdLFxuICAgICAgICBzdGFjayA9IHNjb3BlLmludm9rZXNbZGF0YVswXV1bZGF0YVsxXV07XG5cbiAgICBkZWxldGUgc2NvcGUuaW52b2tlc1tkYXRhWzBdXVtkYXRhWzFdXTtcblxuICAgIGlmKCFlcnJvcil7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBlcnJvciA9IG5ldyBFcnJvcihlcnJvci5tZXNzYWdlKTtcbiAgICBlcnJvci5zdGFjayA9IHN0YWNrO1xuICAgIHRocm93IGVycm9yO1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpc2UodmFsdWUpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBpZih0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpe1xuICAgICAgICB2YXIgcmVzdWx0ID0ge1xuICAgICAgICAgICAgbmFtZTogdmFsdWUubmFtZVxuICAgICAgICB9O1xuXG4gICAgICAgIGZvcih2YXIga2V5IGluIHZhbHVlKXtcbiAgICAgICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWVba2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBbcmVzdWx0LCBMRU5aRV9GVU5DVElPTl07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVDYWxsZXIoc2NvcGUsIGNvbmZpZyl7XG4gICAgdmFyIHJlc3VsdCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKGFyZ3VtZW50cywgZnVuY3Rpb24oYXJnKXtcbiAgICAgICAgICAgIGlmKGlzSW5zdGFuY2UoYXJnKSl7XG4gICAgICAgICAgICAgICAgaWYoYXJnIGluc3RhbmNlb2YgRXZlbnQpe1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJMZW56ZSBkb2VzIG5vdCBzdXBwb3J0IHRoZSB0cmFuc21pc3Npb24gb2YgYnJvd3NlciBFdmVudHNcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gYXJnO1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgc3RhY2sgPSBuZXcgRXJyb3IoKS5zdGFjayxcbiAgICAgICAgICAgIGZuSWQgPSBzY29wZS52aXNjb3VzLmdldElkKHJlc3VsdCksXG4gICAgICAgICAgICB0aW1lU3RhbXAgPSBEYXRlLm5vdygpO1xuXG4gICAgICAgIHNjb3BlLmludm9rZXNbZm5JZF0gPSBzY29wZS5pbnZva2VzW2ZuSWRdIHx8IHt9O1xuICAgICAgICBzY29wZS5pbnZva2VzW2ZuSWRdW3RpbWVTdGFtcF0gPSBzdGFjaztcbiAgICAgICAgc2NvcGUuaW52b2tlLmNhbGwobnVsbCwgc2NvcGUudmlzY291cy5nZXRJZChyZXN1bHQpLCB0aW1lU3RhbXAsIHNjb3BlLnZpc2NvdXMuZGVzY3JpYmUoYXJncykpO1xuICAgIH07XG4gICAgcmVzdWx0Lm5hbWUgPSBjb25maWcubmFtZTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGRlc2VyaWFsaXNlKGRlZmluaXRpb24pe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBpZihkZWZpbml0aW9uWzFdID09PSBMRU5aRV9GVU5DVElPTil7XG4gICAgICAgIHZhciB2YWx1ZSA9IGRlZmluaXRpb25bMF0sXG4gICAgICAgICAgICByZXN1bHQgPSBjcmVhdGVDYWxsZXIoc2NvcGUsIHZhbHVlKTtcblxuICAgICAgICBmb3IodmFyIGtleSBpbiB2YWx1ZSl7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlW2tleV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaW5pdFNjb3BlKHN0YXRlKXtcbiAgICB2YXIgc3RhdGUgPSBzdGF0ZSB8fCB7fTtcblxuICAgIHZhciBzY29wZSA9IHt9O1xuXG4gICAgc2NvcGUubGVuemUgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG4gICAgc2NvcGUudmlzY291cyA9IHZpc2NvdXMoc3RhdGUsIHtcbiAgICAgICAgc2VyaWFsaXNlcjogc2VyaWFsaXNlLmJpbmQoc2NvcGUpLFxuICAgICAgICBkZXNlcmlhbGlzZXI6IGRlc2VyaWFsaXNlLmJpbmQoc2NvcGUpXG4gICAgfSk7XG5cbiAgICBzY29wZS5sZW56ZS51cGRhdGUgPSB1cGRhdGUuYmluZChzY29wZSk7XG4gICAgc2NvcGUubGVuemUuZ2V0Q2hhbmdlSW5mbyA9IHNodXYoZ2V0Q2hhbmdlSW5mbywgc2NvcGUpO1xuICAgIHNjb3BlLmxlbnplLnN0YXRlID0gc3RhdGU7XG5cbiAgICByZXR1cm4gc2NvcGU7XG59XG5cbmZ1bmN0aW9uIGluaXQoc3RhdGUsIHNldHRpbmdzKXtcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoIDwgMil7XG4gICAgICAgIHNldHRpbmdzID0gc3RhdGU7XG4gICAgICAgIHN0YXRlID0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgc2NvcGUgPSBpbml0U2NvcGUoc3RhdGUpO1xuXG4gICAgc2NvcGUuaGFuZGxlRnVuY3Rpb24gPSBzaHV2KGhhbmRsZUZ1bmN0aW9uLCBzY29wZSk7XG4gICAgc2NvcGUuc2VuZCA9IHNodXYoc2VuZCwgc2NvcGUsIHNldHRpbmdzLnNlbmQpO1xuICAgIHNjb3BlLnJlc3VsdCA9IHNodXYoc2VuZFJlc3VsdCwgc2NvcGUsIHNldHRpbmdzLnNlbmQpO1xuICAgIHNldHRpbmdzLnJlY2VpdmUoc2h1dihyZWNlaXZlLCBzY29wZSkpO1xuXG4gICAgc2NvcGUubWluSW50ZXJ2YWwgPSBzZXR0aW5ncy5taW5JbnRlcnZhbCB8fCAzMDsgLy8gQWJvdXQgdHdvIGZyYW1lc1xuICAgIHNjb3BlLm1heEludGVydmFsID0gc2V0dGluZ3MubWF4SW50ZXJ2YWwgfHwgMzAwOyAvLyBBYm91dCB3aGF0IGh1bWFucyBmaW5kIFwicXVpY2tcIlxuICAgIHNjb3BlLmRvemVUaW1lID0gc2V0dGluZ3MuZG96ZVRpbWUgfHwgMTAwMDsgLy8gQWJvdXQgaG93IGxvbmcgYmV0d2VlbiBsaW5rZWQgaHVtYW4gYWN0aW9uc1xuXG4gICAgc2V0SW50ZXJ2YWwoc2NvcGUubGVuemUudXBkYXRlLCBzY29wZS5taW5JbnRlcnZhbCk7XG5cbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICAgIC8vIExldCBhbGwgcmVwbGljYW50cyBrbm93IGluaXRpYWwgc3RhdGUuXG4gICAgICAgIHNjb3BlLnNlbmQoQ09OTkVDVCwgc2NvcGUudmlzY291cy5zdGF0ZSgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzY29wZS5sZW56ZTtcbn1cblxuZnVuY3Rpb24gcmVwbGljYW50KHN0YXRlLCBzZXR0aW5ncyl7XG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA8IDIpe1xuICAgICAgICBzZXR0aW5ncyA9IHN0YXRlO1xuICAgICAgICBzdGF0ZSA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHNjb3BlID0gaW5pdFNjb3BlKHN0YXRlKTtcblxuICAgIHNjb3BlLmludm9rZXMgPSB7fTtcbiAgICBzY29wZS5pbnN0YW5jZUhhc2ggPSB7fTtcblxuICAgIHNldHRpbmdzLnJlY2VpdmUoZnVuY3Rpb24oZGF0YSl7XG5cbiAgICAgICAgdmFyIG1lc3NhZ2UgPSBwYXJzZU1lc3NhZ2UoZGF0YSk7XG5cbiAgICAgICAgaWYoIW1lc3NhZ2Upe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoIXNjb3BlLnJlYWR5ICYmIG1lc3NhZ2UudHlwZSAhPT0gQ09OTkVDVCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdHlwZSA9IG1lc3NhZ2UudHlwZTtcblxuICAgICAgICBpZihcbiAgICAgICAgICAgIHR5cGUgPT09IENIQU5HRVMgfHxcbiAgICAgICAgICAgIHR5cGUgPT09IFNUQVRFIHx8XG4gICAgICAgICAgICB0eXBlID09PSBDT05ORUNUXG4gICAgICAgICl7XG4gICAgICAgICAgICBzY29wZS52aXNjb3VzLmFwcGx5KGluZmxhdGVDaGFuZ2VzKHNjb3BlLCBtZXNzYWdlLmRhdGEpKTtcbiAgICAgICAgICAgIHNjb3BlLmxlbnplLnVwZGF0ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodHlwZSA9PT0gUkVTVUxUKXtcbiAgICAgICAgICAgIGhhbmRsZVJlc3VsdChzY29wZSwgbWVzc2FnZS5kYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCFzY29wZS5yZWFkeSl7XG4gICAgICAgICAgICBzY29wZS5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBzY29wZS5sZW56ZS5lbWl0KCdyZWFkeScpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBzY29wZS5pbnZva2UgPSBzaHV2KHNlbmRJbnZva2UsIHNjb3BlLCBzZXR0aW5ncy5zZW5kKTtcblxuICAgIHNldHRpbmdzLnNlbmQoQ09OTkVDVCArICc6Jyk7XG5cbiAgICByZXR1cm4gc2NvcGUubGVuemVcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xubW9kdWxlLmV4cG9ydHMucmVwbGljYW50ID0gcmVwbGljYW50O1xuIiwidmFyIEFqYXggPSByZXF1aXJlKCdzaW1wbGUtYWpheCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHNldHRpbmdzLCBjYWxsYmFjayl7XG4gICAgaWYodHlwZW9mIHNldHRpbmdzID09PSAnc3RyaW5nJyl7XG4gICAgICAgIHNldHRpbmdzID0ge1xuICAgICAgICAgICAgdXJsOiBzZXR0aW5nc1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGlmKHR5cGVvZiBzZXR0aW5ncyAhPT0gJ29iamVjdCcpe1xuICAgICAgICB0aHJvdyAnc2V0dGluZ3MgbXVzdCBiZSBhIHN0cmluZyBvciBvYmplY3QnO1xuICAgIH1cblxuICAgIGlmKHR5cGVvZiBjYWxsYmFjayAhPT0gJ2Z1bmN0aW9uJyl7XG4gICAgICAgIHRocm93ICdjcGpheCBtdXN0IGJlIHBhc3NlZCBhIGNhbGxiYWNrIGFzIHRoZSBzZWNvbmQgcGFyYW1ldGVyJztcbiAgICB9XG5cbiAgICB2YXIgYWpheCA9IG5ldyBBamF4KHNldHRpbmdzKTtcblxuICAgIGFqYXgub24oJ3N1Y2Nlc3MnLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgICAgICBjYWxsYmFjayhudWxsLCBkYXRhLCBldmVudCk7XG4gICAgfSk7XG4gICAgYWpheC5vbignZXJyb3InLCBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBjYWxsYmFjayhuZXcgRXJyb3IoZXZlbnQudGFyZ2V0LnJlc3BvbnNlVGV4dCksIG51bGwsIGV2ZW50KTtcbiAgICB9KTtcblxuICAgIGFqYXguc2VuZCgpO1xuXG4gICAgcmV0dXJuIGFqYXg7XG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24odmFsdWUpe1xuICAgIHJldHVybiB2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJztcbn07IiwiLyohXG5cdHF1ZXJ5LXN0cmluZ1xuXHRQYXJzZSBhbmQgc3RyaW5naWZ5IFVSTCBxdWVyeSBzdHJpbmdzXG5cdGh0dHBzOi8vZ2l0aHViLmNvbS9zaW5kcmVzb3JodXMvcXVlcnktc3RyaW5nXG5cdGJ5IFNpbmRyZSBTb3JodXNcblx0TUlUIExpY2Vuc2VcbiovXG4oZnVuY3Rpb24gKCkge1xuXHQndXNlIHN0cmljdCc7XG5cdHZhciBxdWVyeVN0cmluZyA9IHt9O1xuXG5cdHF1ZXJ5U3RyaW5nLnBhcnNlID0gZnVuY3Rpb24gKHN0cikge1xuXHRcdGlmICh0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHt9O1xuXHRcdH1cblxuXHRcdHN0ciA9IHN0ci50cmltKCkucmVwbGFjZSgvXihcXD98IykvLCAnJyk7XG5cblx0XHRpZiAoIXN0cikge1xuXHRcdFx0cmV0dXJuIHt9O1xuXHRcdH1cblxuXHRcdHJldHVybiBzdHIudHJpbSgpLnNwbGl0KCcmJykucmVkdWNlKGZ1bmN0aW9uIChyZXQsIHBhcmFtKSB7XG5cdFx0XHR2YXIgcGFydHMgPSBwYXJhbS5yZXBsYWNlKC9cXCsvZywgJyAnKS5zcGxpdCgnPScpO1xuXHRcdFx0dmFyIGtleSA9IHBhcnRzWzBdO1xuXHRcdFx0dmFyIHZhbCA9IHBhcnRzWzFdO1xuXG5cdFx0XHRrZXkgPSBkZWNvZGVVUklDb21wb25lbnQoa2V5KTtcblx0XHRcdC8vIG1pc3NpbmcgYD1gIHNob3VsZCBiZSBgbnVsbGA6XG5cdFx0XHQvLyBodHRwOi8vdzMub3JnL1RSLzIwMTIvV0QtdXJsLTIwMTIwNTI0LyNjb2xsZWN0LXVybC1wYXJhbWV0ZXJzXG5cdFx0XHR2YWwgPSB2YWwgPT09IHVuZGVmaW5lZCA/IG51bGwgOiBkZWNvZGVVUklDb21wb25lbnQodmFsKTtcblxuXHRcdFx0aWYgKCFyZXQuaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdFx0XHRyZXRba2V5XSA9IHZhbDtcblx0XHRcdH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShyZXRba2V5XSkpIHtcblx0XHRcdFx0cmV0W2tleV0ucHVzaCh2YWwpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0W2tleV0gPSBbcmV0W2tleV0sIHZhbF07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZXQ7XG5cdFx0fSwge30pO1xuXHR9O1xuXG5cdHF1ZXJ5U3RyaW5nLnN0cmluZ2lmeSA9IGZ1bmN0aW9uIChvYmopIHtcblx0XHRyZXR1cm4gb2JqID8gT2JqZWN0LmtleXMob2JqKS5tYXAoZnVuY3Rpb24gKGtleSkge1xuXHRcdFx0dmFyIHZhbCA9IG9ialtrZXldO1xuXG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWwpKSB7XG5cdFx0XHRcdHJldHVybiB2YWwubWFwKGZ1bmN0aW9uICh2YWwyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChrZXkpICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KHZhbDIpO1xuXHRcdFx0XHR9KS5qb2luKCcmJyk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBlbmNvZGVVUklDb21wb25lbnQoa2V5KSArICc9JyArIGVuY29kZVVSSUNvbXBvbmVudCh2YWwpO1xuXHRcdH0pLmpvaW4oJyYnKSA6ICcnO1xuXHR9O1xuXG5cdGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcblx0XHRkZWZpbmUoZnVuY3Rpb24oKSB7IHJldHVybiBxdWVyeVN0cmluZzsgfSk7XG5cdH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcblx0XHRtb2R1bGUuZXhwb3J0cyA9IHF1ZXJ5U3RyaW5nO1xuXHR9IGVsc2Uge1xuXHRcdHNlbGYucXVlcnlTdHJpbmcgPSBxdWVyeVN0cmluZztcblx0fVxufSkoKTtcbiIsInZhciBwbGFjZWhvbGRlciA9IHt9LFxuICAgIGVuZE9mQXJncyA9IHt9LFxuICAgIHNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwuYmluZChBcnJheS5wcm90b3R5cGUuc2xpY2UpO1xuXG5mdW5jdGlvbiBzaHV2KGZuKXtcbiAgICB2YXIgb3V0ZXJBcmdzID0gc2xpY2UoYXJndW1lbnRzLCAxKTtcblxuICAgIGlmKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJyl7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gb3Igbm9uLWZ1bmN0aW9uIHBhc3NlZCB0byBzaHV2Jyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBjb250ZXh0ID0gdGhpcyxcbiAgICAgICAgICAgIGlubmVyQXJncyA9IHNsaWNlKGFyZ3VtZW50cyksXG4gICAgICAgICAgICBmaW5hbEFyZ3MgPSBbXSxcbiAgICAgICAgICAgIGFwcGVuZCA9IHRydWU7XG5cbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IG91dGVyQXJncy5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICB2YXIgb3V0ZXJBcmcgPSBvdXRlckFyZ3NbaV07XG5cbiAgICAgICAgICAgIGlmKG91dGVyQXJnID09PSBlbmRPZkFyZ3Mpe1xuICAgICAgICAgICAgICAgIGFwcGVuZCA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihvdXRlckFyZyA9PT0gcGxhY2Vob2xkZXIpe1xuICAgICAgICAgICAgICAgIGZpbmFsQXJncy5wdXNoKGlubmVyQXJncy5zaGlmdCgpKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZmluYWxBcmdzLnB1c2gob3V0ZXJBcmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoYXBwZW5kKXtcbiAgICAgICAgICAgIGZpbmFsQXJncyA9IGZpbmFsQXJncy5jb25jYXQoaW5uZXJBcmdzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmbi5hcHBseShjb250ZXh0LCBmaW5hbEFyZ3MpO1xuICAgIH07XG59XG5cbnNodXYuXyA9IHBsYWNlaG9sZGVyO1xuc2h1di4kID0gZW5kT2ZBcmdzO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHNodXY7IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcixcbiAgICBxdWVyeVN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5LXN0cmluZycpO1xuXG5mdW5jdGlvbiB0cnlQYXJzZUpzb24oZGF0YSl7XG4gICAgdHJ5e1xuICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShkYXRhKTtcbiAgICB9Y2F0Y2goZXJyb3Ipe1xuICAgICAgICByZXR1cm4gZXJyb3I7XG4gICAgfVxufVxuXG5mdW5jdGlvbiB0aW1lb3V0KCl7XG4gICB0aGlzLnJlcXVlc3QuYWJvcnQoKTtcbiAgIHRoaXMuZW1pdCgndGltZW91dCcpO1xufVxuXG5mdW5jdGlvbiBBamF4KHNldHRpbmdzKXtcbiAgICB2YXIgcXVlcnlTdHJpbmdEYXRhLFxuICAgICAgICBhamF4ID0gdGhpcztcblxuICAgIGlmKHR5cGVvZiBzZXR0aW5ncyA9PT0gJ3N0cmluZycpe1xuICAgICAgICBzZXR0aW5ncyA9IHtcbiAgICAgICAgICAgIHVybDogc2V0dGluZ3NcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBpZih0eXBlb2Ygc2V0dGluZ3MgIT09ICdvYmplY3QnKXtcbiAgICAgICAgc2V0dGluZ3MgPSB7fTtcbiAgICB9XG5cbiAgICBhamF4LnNldHRpbmdzID0gc2V0dGluZ3M7XG4gICAgYWpheC5yZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgYWpheC5zZXR0aW5ncy5tZXRob2QgPSBhamF4LnNldHRpbmdzLm1ldGhvZCB8fCAnZ2V0JztcblxuICAgIGlmKGFqYXguc2V0dGluZ3MuY29ycyl7XG4gICAgICAgIGlmICgnd2l0aENyZWRlbnRpYWxzJyBpbiBhamF4LnJlcXVlc3QpIHtcbiAgICAgICAgICAgIGFqYXgucmVxdWVzdC53aXRoQ3JlZGVudGlhbHMgPSAhIXNldHRpbmdzLndpdGhDcmVkZW50aWFscztcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgWERvbWFpblJlcXVlc3QgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAvLyBYRG9tYWluUmVxdWVzdCBvbmx5IGV4aXN0cyBpbiBJRSwgYW5kIGlzIElFJ3Mgd2F5IG9mIG1ha2luZyBDT1JTIHJlcXVlc3RzLlxuICAgICAgICAgICAgYWpheC5yZXF1ZXN0ID0gbmV3IFhEb21haW5SZXF1ZXN0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBPdGhlcndpc2UsIENPUlMgaXMgbm90IHN1cHBvcnRlZCBieSB0aGUgYnJvd3Nlci5cbiAgICAgICAgICAgIGFqYXguZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ0NvcnMgaXMgbm90IHN1cHBvcnRlZCBieSB0aGlzIGJyb3dzZXInKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZihhamF4LnNldHRpbmdzLmNhY2hlID09PSBmYWxzZSl7XG4gICAgICAgIGFqYXguc2V0dGluZ3MuZGF0YSA9IGFqYXguc2V0dGluZ3MuZGF0YSB8fCB7fTtcbiAgICAgICAgYWpheC5zZXR0aW5ncy5kYXRhLl8gPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICB9XG5cbiAgICBpZihhamF4LnNldHRpbmdzLm1ldGhvZC50b0xvd2VyQ2FzZSgpID09PSAnZ2V0JyAmJiB0eXBlb2YgYWpheC5zZXR0aW5ncy5kYXRhID09PSAnb2JqZWN0Jyl7XG4gICAgICAgIHZhciB1cmxQYXJ0cyA9IGFqYXguc2V0dGluZ3MudXJsLnNwbGl0KCc/Jyk7XG5cbiAgICAgICAgcXVlcnlTdHJpbmdEYXRhID0gcXVlcnlTdHJpbmcucGFyc2UodXJsUGFydHNbMV0pO1xuXG4gICAgICAgIGZvcih2YXIga2V5IGluIGFqYXguc2V0dGluZ3MuZGF0YSl7XG4gICAgICAgICAgICBxdWVyeVN0cmluZ0RhdGFba2V5XSA9IGFqYXguc2V0dGluZ3MuZGF0YVtrZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgYWpheC5zZXR0aW5ncy51cmwgPSB1cmxQYXJ0c1swXSArICc/JyArIHF1ZXJ5U3RyaW5nLnN0cmluZ2lmeShxdWVyeVN0cmluZ0RhdGEpO1xuICAgICAgICBhamF4LnNldHRpbmdzLmRhdGEgPSBudWxsO1xuICAgIH1cblxuICAgIGFqYXgucmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdwcm9ncmVzcycsIGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgICAgYWpheC5lbWl0KCdwcm9ncmVzcycsIGV2ZW50KTtcbiAgICB9LCBmYWxzZSk7XG5cbiAgICBhamF4LnJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgICAgdmFyIGRhdGEgPSBldmVudC50YXJnZXQucmVzcG9uc2VUZXh0O1xuXG4gICAgICAgIGlmKGFqYXguc2V0dGluZ3MuZGF0YVR5cGUgJiYgYWpheC5zZXR0aW5ncy5kYXRhVHlwZS50b0xvd2VyQ2FzZSgpID09PSAnanNvbicpe1xuICAgICAgICAgICAgaWYoZGF0YSA9PT0gJycpe1xuICAgICAgICAgICAgICAgIGRhdGEgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICBkYXRhID0gdHJ5UGFyc2VKc29uKGRhdGEpO1xuICAgICAgICAgICAgICAgIGlmKGRhdGEgaW5zdGFuY2VvZiBFcnJvcil7XG4gICAgICAgICAgICAgICAgICAgIGFqYXguZW1pdCgnZXJyb3InLCBldmVudCwgZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZihldmVudC50YXJnZXQuc3RhdHVzID49IDQwMCl7XG4gICAgICAgICAgICBhamF4LmVtaXQoJ2Vycm9yJywgZXZlbnQsIGRhdGEpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYWpheC5lbWl0KCdzdWNjZXNzJywgZXZlbnQsIGRhdGEpO1xuICAgICAgICB9XG5cbiAgICB9LCBmYWxzZSk7XG5cbiAgICBhamF4LnJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCBmdW5jdGlvbihldmVudCl7XG4gICAgICAgIGFqYXguZW1pdCgnZXJyb3InLCBldmVudCk7XG4gICAgfSwgZmFsc2UpO1xuXG4gICAgYWpheC5yZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2Fib3J0JywgZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgICBhamF4LmVtaXQoJ2Vycm9yJywgZXZlbnQsIG5ldyBFcnJvcignQ29ubmVjdGlvbiBBYm9ydGVkJykpO1xuICAgICAgICBhamF4LmVtaXQoJ2Fib3J0JywgZXZlbnQpO1xuICAgIH0sIGZhbHNlKTtcblxuICAgIGFqYXgucmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdsb2FkZW5kJywgZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgICBjbGVhclRpbWVvdXQodGhpcy5fcmVxdWVzdFRpbWVvdXQpO1xuICAgICAgICBhamF4LmVtaXQoJ2NvbXBsZXRlJywgZXZlbnQpO1xuICAgIH0sIGZhbHNlKTtcblxuICAgIGFqYXgucmVxdWVzdC5vcGVuKGFqYXguc2V0dGluZ3MubWV0aG9kIHx8ICdnZXQnLCBhamF4LnNldHRpbmdzLnVybCwgdHJ1ZSk7XG5cbiAgICAvLyBTZXQgZGVmYXVsdCBoZWFkZXJzXG4gICAgaWYoYWpheC5zZXR0aW5ncy5jb250ZW50VHlwZSAhPT0gZmFsc2Upe1xuICAgICAgICBhamF4LnJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgYWpheC5zZXR0aW5ncy5jb250ZW50VHlwZSB8fCAnYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOCcpO1xuICAgIH1cbiAgICBpZihhamF4LnNldHRpbmdzLnJlcXVlc3RlZFdpdGggIT09IGZhbHNlKSB7XG4gICAgICAgIGFqYXgucmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKCdYLVJlcXVlc3RlZC1XaXRoJywgYWpheC5zZXR0aW5ncy5yZXF1ZXN0ZWRXaXRoIHx8ICdYTUxIdHRwUmVxdWVzdCcpO1xuICAgIH1cbiAgICBpZihhamF4LnNldHRpbmdzLmF1dGgpe1xuICAgICAgICBhamF4LnJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcignQXV0aG9yaXphdGlvbicsIGFqYXguc2V0dGluZ3MuYXV0aCk7XG4gICAgfVxuXG4gICAgLy8gU2V0IGN1c3RvbSBoZWFkZXJzXG4gICAgZm9yKHZhciBoZWFkZXJLZXkgaW4gYWpheC5zZXR0aW5ncy5oZWFkZXJzKXtcbiAgICAgICAgYWpheC5yZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoaGVhZGVyS2V5LCBhamF4LnNldHRpbmdzLmhlYWRlcnNbaGVhZGVyS2V5XSk7XG4gICAgfVxuXG4gICAgaWYoYWpheC5zZXR0aW5ncy5wcm9jZXNzRGF0YSAhPT0gZmFsc2UgJiYgYWpheC5zZXR0aW5ncy5kYXRhVHlwZSA9PT0gJ2pzb24nKXtcbiAgICAgICAgYWpheC5zZXR0aW5ncy5kYXRhID0gSlNPTi5zdHJpbmdpZnkoYWpheC5zZXR0aW5ncy5kYXRhKTtcbiAgICB9XG59XG5cbkFqYXgucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShFdmVudEVtaXR0ZXIucHJvdG90eXBlKTtcblxuQWpheC5wcm90b3R5cGUuc2VuZCA9IGZ1bmN0aW9uKCl7XG4gICAgdGhpcy5fcmVxdWVzdFRpbWVvdXQgPSBzZXRUaW1lb3V0KFxuICAgICAgICB0aW1lb3V0LmJpbmQodGhpcyksXG4gICAgICAgIHRoaXMuc2V0dGluZ3MudGltZW91dCB8fCAxMjAwMDBcbiAgICApO1xuICAgIHRoaXMucmVxdWVzdC5zZW5kKHRoaXMuc2V0dGluZ3MuZGF0YSAmJiB0aGlzLnNldHRpbmdzLmRhdGEpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBamF4O1xuIiwidmFyIHNhbWVWYWx1ZSA9IHJlcXVpcmUoJ3NhbWUtdmFsdWUnKSxcbiAgICBpc0luc3RhbmNlID0gcmVxdWlyZSgnaXMtaW5zdGFuY2UnKTtcblxudmFyIFJFTU9WRUQgPSAncic7XG52YXIgQURERUQgPSAnYSc7XG52YXIgRURJVEVEID0gJ2UnO1xuXG52YXIgQVJSQVkgPSAnYSc7XG52YXIgRlVOQ1RJT04gPSAnZic7XG52YXIgREFURSA9ICdkJztcblxuZnVuY3Rpb24gc2FtZShhLCBiKXtcbiAgICBpZihpc0luc3RhbmNlKGEpICYmIGEgaW5zdGFuY2VvZiBEYXRlICYmIGEgIT09IGIpe1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNhbWVWYWx1ZShhLCBiKTtcbn1cblxuZnVuY3Rpb24gZ2V0SWQoaW50KXtcbiAgICBpZihpbnQgPT09IDApe1xuICAgICAgICByZXR1cm4gJ3Jvb3QnO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy52aXNjb3VzSWQgKyAnOicgKyBpbnQudG9TdHJpbmcoMzYpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJZCgpe1xuICAgIHJldHVybiB0aGlzLmdldElkKHRoaXMuY3VycmVudElkKyspO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJbnN0YW5jZUluZm8oc2NvcGUsIGlkLCB2YWx1ZSl7XG4gICAgdmFyIGluc3RhbmNlSW5mbyA9IHtcbiAgICAgICAgICAgIGlkOiBpZCxcbiAgICAgICAgICAgIGluc3RhbmNlOiB2YWx1ZSxcbiAgICAgICAgICAgIGxhc3RTdGF0ZToge30sXG4gICAgICAgICAgICBuZXc6IHRydWVcbiAgICAgICAgfTtcblxuICAgIHNjb3BlLnNldEluc3RhbmNlKGlkLCB2YWx1ZSk7XG4gICAgc2NvcGUudHJhY2tlZE1hcC5zZXQodmFsdWUsIGluc3RhbmNlSW5mbyk7XG5cbiAgICByZXR1cm4gaW5zdGFuY2VJbmZvO1xufVxuXG5mdW5jdGlvbiBnZXRJbnN0YW5jZUluZm8oc2NvcGUsIHZhbHVlKXtcbiAgICBpZighaXNJbnN0YW5jZSh2YWx1ZSkpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGluc3RhbmNlSW5mbyA9IHNjb3BlLnRyYWNrZWRNYXAuZ2V0KHZhbHVlKTtcblxuICAgIGlmKCFpbnN0YW5jZUluZm8pe1xuICAgICAgICBpbnN0YW5jZUluZm8gPSBjcmVhdGVJbnN0YW5jZUluZm8oc2NvcGUsIHNjb3BlLmNyZWF0ZUlkKCksIHZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaW5zdGFuY2VJbmZvO1xufVxuXG5mdW5jdGlvbiBnZXRJbnN0YW5jZUlkKHZhbHVlKXtcbiAgICB2YXIgaW5mbyA9IGdldEluc3RhbmNlSW5mbyh0aGlzLCB2YWx1ZSk7XG5cbiAgICByZXR1cm4gaW5mbyAmJiBpbmZvLmlkO1xufVxuXG5mdW5jdGlvbiBnZXRSZW1vdmVkQ2hhbmdlKGluc3RhbmNlSW5mbywgb2JqZWN0LCBvbGRLZXkpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBpZighKG9sZEtleSBpbiBvYmplY3QpKXtcbiAgICAgICAgdmFyIG9sZFZhbHVlID0gaW5zdGFuY2VJbmZvLmxhc3RTdGF0ZVtvbGRLZXldO1xuICAgICAgICB0aGlzLm5leHRDaGFuZ2UucHVzaChbaW5zdGFuY2VJbmZvLmlkLCBvbGRLZXksIFJFTU9WRURdKTtcblxuICAgICAgICBkZWxldGUgaW5zdGFuY2VJbmZvLmxhc3RTdGF0ZVtvbGRLZXldO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0UmVtb3ZlZENoYW5nZXMoaW5zdGFuY2VJbmZvLCBvYmplY3Qpe1xuICAgIGZ1bmN0aW9uIGdldENoYW5nZShvbGRLZXkpe1xuICAgICAgICB0aGlzLmdldFJlbW92ZWRDaGFuZ2UoaW5zdGFuY2VJbmZvLCBvYmplY3QsIG9sZEtleSk7XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMoaW5zdGFuY2VJbmZvLmxhc3RTdGF0ZSkuZm9yRWFjaChnZXRDaGFuZ2UsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiBnZXRDdXJyZW50Q2hhbmdlKGluc3RhbmNlSW5mbywgaW5zdGFuY2UsIGN1cnJlbnRLZXkpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICB2YXIgdHlwZSA9IGluc3RhbmNlSW5mby5sYXN0U3RhdGUuaGFzT3duUHJvcGVydHkoY3VycmVudEtleSkgPyBFRElURUQgOiBBRERFRCxcbiAgICAgICAgb2xkVmFsdWUgPSBpbnN0YW5jZUluZm8ubGFzdFN0YXRlW2N1cnJlbnRLZXldLFxuICAgICAgICBjdXJyZW50VmFsdWUgPSBpbnN0YW5jZVtjdXJyZW50S2V5XSxcbiAgICAgICAgY2hhbmdlID0gW2luc3RhbmNlSW5mby5pZCwgY3VycmVudEtleSwgdHlwZV0sXG4gICAgICAgIGNoYW5nZWQgPSAhc2FtZShvbGRWYWx1ZSwgY3VycmVudFZhbHVlKTtcblxuICAgIGlmKGNoYW5nZWQgfHwgdHlwZSA9PT0gQURERUQpe1xuICAgICAgICBpbnN0YW5jZUluZm8ubGFzdFN0YXRlW2N1cnJlbnRLZXldID0gY3VycmVudFZhbHVlO1xuICAgICAgICB0aGlzLm5leHRDaGFuZ2UucHVzaChjaGFuZ2UpO1xuICAgIH1cblxuICAgIGlmKCFpc0luc3RhbmNlKGN1cnJlbnRWYWx1ZSkpe1xuICAgICAgICBjaGFuZ2UucHVzaChjdXJyZW50VmFsdWUpO1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGluc3RhbmNlSWQgPSBzY29wZS5nZXRJbnN0YW5jZUlkKGluc3RhbmNlW2N1cnJlbnRLZXldKTtcblxuICAgIHNjb3BlLmN1cnJlbnRJbnN0YW5jZXMuYWRkKGluc3RhbmNlSWQpO1xuXG4gICAgc2NvcGUuZ2V0T2JqZWN0Q2hhbmdlcyhjdXJyZW50VmFsdWUpO1xuXG4gICAgaWYoY2hhbmdlZCl7XG4gICAgICAgIGNoYW5nZS5wdXNoKFtpbnN0YW5jZUlkXSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDdXJyZW50Q2hhbmdlcyhpbnN0YW5jZUluZm8sIGluc3RhbmNlKXtcbiAgICBmdW5jdGlvbiBnZXRDaGFuZ2UoY3VycmVudEtleSl7XG4gICAgICAgIHRoaXMuZ2V0Q3VycmVudENoYW5nZShpbnN0YW5jZUluZm8sIGluc3RhbmNlLCBjdXJyZW50S2V5KTtcbiAgICB9XG5cbiAgICBPYmplY3Qua2V5cyhpbnN0YW5jZSkuZm9yRWFjaChnZXRDaGFuZ2UsIHRoaXMpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJbnN0YW5jZURlZmluaXRpb24oc2NvcGUsIGluc3RhbmNlKXtcbiAgICB2YXIgcmVzdWx0ID0gc2NvcGUuc2V0dGluZ3Muc2VyaWFsaXNlcihpbnN0YW5jZSk7XG5cbiAgICBpZighcmVzdWx0KXtcbiAgICAgICAgcmVzdWx0ID0gW107XG4gICAgICAgIHZhciB2YWx1ZSA9IGluc3RhbmNlO1xuXG4gICAgICAgIGlmKHZhbHVlIGluc3RhbmNlb2YgRGF0ZSl7XG4gICAgICAgICAgICByZXR1cm4gW3ZhbHVlLnRvSVNPU3RyaW5nKCksIERBVEVdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKGZ1bmN0aW9uKCl7cmV0dXJuIGluc3RhbmNlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyl9LCBGVU5DVElPTik7XG4gICAgICAgIH1lbHNlIGlmKEFycmF5LmlzQXJyYXkodmFsdWUpKXtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHt9LCBBUlJBWSk7XG4gICAgICAgIH1lbHNlIGlmKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpe1xuICAgICAgICAgICAgcmVzdWx0LnB1c2goe30pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMoaW5zdGFuY2UpLmZvckVhY2goZnVuY3Rpb24oa2V5KXtcbiAgICAgICAgdmFyIGlkID0gc2NvcGUuZ2V0SW5zdGFuY2VJZChpbnN0YW5jZVtrZXldKTtcbiAgICAgICAgcmVzdWx0WzBdW2tleV0gPSBpZCA/IFtpZF0gOiBpbnN0YW5jZVtrZXldO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gZ2V0T2JqZWN0Q2hhbmdlcyhvYmplY3Qpe1xuICAgIGlmKHRoaXMuc2Nhbm5lZC5oYXMob2JqZWN0KSl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5zY2FubmVkLmFkZChvYmplY3QpO1xuXG4gICAgdmFyIHNjb3BlID0gdGhpcztcblxuICAgIHZhciBpbnN0YW5jZUluZm8gPSBnZXRJbnN0YW5jZUluZm8oc2NvcGUsIG9iamVjdCksXG4gICAgICAgIGlzTmV3ID0gaW5zdGFuY2VJbmZvLm5ldyAmJiBvYmplY3QgIT09IHNjb3BlLnN0YXRlO1xuXG4gICAgc2NvcGUuZ2V0UmVtb3ZlZENoYW5nZXMoaW5zdGFuY2VJbmZvLCBvYmplY3QpO1xuICAgIHNjb3BlLmdldEN1cnJlbnRDaGFuZ2VzKGluc3RhbmNlSW5mbywgb2JqZWN0KTtcblxuICAgIGlmKCFpc05ldyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpbnN0YW5jZUluZm8ubmV3ID0gZmFsc2U7XG4gICAgdGhpcy5uZXh0Q2hhbmdlWzBdLnB1c2goW2luc3RhbmNlSW5mby5pZCwgY3JlYXRlSW5zdGFuY2VEZWZpbml0aW9uKHNjb3BlLCBvYmplY3QpXSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUdhcmJhZ2VDaGFuZ2UoaWQpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgaWYoIXNjb3BlLmN1cnJlbnRJbnN0YW5jZXMuaGFzKGlkKSl7XG4gICAgICAgIHNjb3BlLnRyYWNrZWRNYXAuZGVsZXRlKHNjb3BlLmdldEluc3RhbmNlKGlkKSk7XG4gICAgICAgIHNjb3BlLnJlbW92ZUluc3RhbmNlKGlkKTtcbiAgICAgICAgc2NvcGUubmV4dENoYW5nZVswXS51bnNoaWZ0KFtpZCwgUkVNT1ZFRF0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gY2hhbmdlcygpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICAvLyBUaGlzIGlzIGhvdyBub3QgdG8gd3JpdGUgY29kZSAxMDEsXG4gICAgLy8gQnV0IGFueXRoaW5nIGluIHRoZSBuYW1lIG9mIHBlcmZvcm1hbmNlIDpQXG5cbiAgICBzY29wZS5uZXh0Q2hhbmdlWzBdID0gW107XG4gICAgc2NvcGUuc2Nhbm5lZCA9IG5ldyBXZWFrU2V0KCk7XG4gICAgc2NvcGUuY3VycmVudEluc3RhbmNlcy5jbGVhcigpO1xuICAgIHNjb3BlLmN1cnJlbnRJbnN0YW5jZXMuYWRkKHRoaXMuZ2V0SWQoMCkpO1xuXG4gICAgc2NvcGUuZ2V0T2JqZWN0Q2hhbmdlcyhzY29wZS5zdGF0ZSk7XG5cbiAgICBPYmplY3Qua2V5cyh0aGlzLmluc3RhbmNlcykuZm9yRWFjaChjcmVhdGVHYXJiYWdlQ2hhbmdlLCB0aGlzKTtcblxuICAgIHJldHVybiBzY29wZS5uZXh0Q2hhbmdlLnNwbGljZSgwLCBzY29wZS5uZXh0Q2hhbmdlLmxlbmd0aCk7XG59XG5cbmZ1bmN0aW9uIGdldFN0YXRlKCl7XG4gICAgdmFyIHNjb3BlID0gdGhpcztcblxuICAgIHNjb3BlLmNoYW5nZXMoKTtcblxuICAgIHJldHVybiBbT2JqZWN0LmtleXMoc2NvcGUuaW5zdGFuY2VzKS5yZXZlcnNlKCkubWFwKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIHJldHVybiBba2V5LCBjcmVhdGVJbnN0YW5jZURlZmluaXRpb24oc2NvcGUsIHNjb3BlLmluc3RhbmNlc1trZXldKV07XG4gICAgfSldO1xufVxuXG5mdW5jdGlvbiBhcHBseU9iamVjdENoYW5nZSh0YXJnZXQsIG5ld1N0YXRlLCB0b0luZmxhdGUpe1xuICAgIGlmKEFycmF5LmlzQXJyYXkobmV3U3RhdGUpKXtcbiAgICAgICAgbmV3U3RhdGUgPSBuZXdTdGF0ZVswXTtcbiAgICAgICAgdG9JbmZsYXRlLnB1c2goW3RhcmdldCwgbmV3U3RhdGVdKTtcbiAgICB9XG5cbiAgICBPYmplY3Qua2V5cyh0YXJnZXQpLmZvckVhY2goZnVuY3Rpb24oa2V5KXtcbiAgICAgICAgaWYoIWtleSBpbiBuZXdTdGF0ZSl7XG4gICAgICAgICAgICBkZWxldGUgdGFyZ2V0W2tleV07XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIE9iamVjdC5rZXlzKG5ld1N0YXRlKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIHRhcmdldFtrZXldID0gbmV3U3RhdGVba2V5XTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gYXBwbHlSb290Q2hhbmdlKHNjb3BlLCBuZXdTdGF0ZSwgdG9JbmZsYXRlKXtcbiAgICBhcHBseU9iamVjdENoYW5nZShzY29wZS5zdGF0ZSwgbmV3U3RhdGUsIHRvSW5mbGF0ZSk7XG59XG5cbmZ1bmN0aW9uIGluZmxhdGVEZWZpbml0aW9uKHNjb3BlLCByZXN1bHQsIHByb3BlcnRpZXMpe1xuICAgIE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLmZvckVhY2goZnVuY3Rpb24oa2V5KXtcbiAgICAgICAgaWYoQXJyYXkuaXNBcnJheShwcm9wZXJ0aWVzW2tleV0pKXtcbiAgICAgICAgICAgIHJlc3VsdFtrZXldID0gc2NvcGUuZ2V0SW5zdGFuY2UocHJvcGVydGllc1trZXldWzBdKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IHByb3BlcnRpZXNba2V5XTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVJbnN0YW5jZShzY29wZSwgZGVmaW5pdGlvbiwgdG9JbmZsYXRlKXtcbiAgICBpZihBcnJheS5pc0FycmF5KGRlZmluaXRpb24pKXtcbiAgICAgICAgdmFyIHR5cGUgPSBkZWZpbml0aW9uWzFdLFxuICAgICAgICAgICAgcHJvcGVydGllcyA9IGRlZmluaXRpb25bMF07XG5cbiAgICAgICAgdmFyIHJlc3VsdCA9IHNjb3BlLnNldHRpbmdzLmRlc2VyaWFsaXNlcihkZWZpbml0aW9uKTtcblxuICAgICAgICBpZihyZXN1bHQpe1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCF0eXBlKXtcbiAgICAgICAgICAgIHJlc3VsdCA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGlmKHR5cGUgPT09IEFSUkFZKXtcbiAgICAgICAgICAgIHJlc3VsdCA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGlmKHR5cGUgPT09IEZVTkNUSU9OKXtcbiAgICAgICAgICAgIHJlc3VsdCA9IHByb3BlcnRpZXM7XG4gICAgICAgIH1cbiAgICAgICAgaWYodHlwZSA9PT0gREFURSl7XG4gICAgICAgICAgICByZXN1bHQgPSBuZXcgRGF0ZShwcm9wZXJ0aWVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGlzSW5zdGFuY2UocmVzdWx0KSl7XG4gICAgICAgICAgICB0b0luZmxhdGUucHVzaChbcmVzdWx0LCBwcm9wZXJ0aWVzXSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuZnVuY3Rpb24gYXBwbHkoY2hhbmdlcyl7XG4gICAgdmFyIHNjb3BlID0gdGhpcyxcbiAgICAgICAgaW5zdGFuY2VDaGFuZ2VzID0gY2hhbmdlc1swXSxcbiAgICAgICAgdG9JbmZsYXRlID0gW107XG5cbiAgICBpbnN0YW5jZUNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbihpbnN0YW5jZUNoYW5nZSl7XG4gICAgICAgIGlmKGluc3RhbmNlQ2hhbmdlWzFdID09PSBSRU1PVkVEKXtcbiAgICAgICAgICAgIHZhciBpbnN0YW5jZSA9IHNjb3BlLmdldEluc3RhbmNlKGluc3RhbmNlQ2hhbmdlWzBdKTtcbiAgICAgICAgICAgIHNjb3BlLnRyYWNrZWRNYXAuZGVsZXRlKGluc3RhbmNlKTtcbiAgICAgICAgICAgIHNjb3BlLnJlbW92ZUluc3RhbmNlKGluc3RhbmNlQ2hhbmdlWzBdKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICBpZihzY29wZS5nZXRJbnN0YW5jZShpbnN0YW5jZUNoYW5nZVswXSkgPT09IHNjb3BlLnN0YXRlKXtcbiAgICAgICAgICAgICAgICBhcHBseVJvb3RDaGFuZ2Uoc2NvcGUsIGluc3RhbmNlQ2hhbmdlWzFdLCB0b0luZmxhdGUpO1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgdmFyIGV4aXN0aW5nSW5zdGFuY2UgPSBzY29wZS5nZXRJbnN0YW5jZShpbnN0YW5jZUNoYW5nZVswXSk7XG5cbiAgICAgICAgICAgICAgICBpZihleGlzdGluZ0luc3RhbmNlKXtcbiAgICAgICAgICAgICAgICAgICAgdG9JbmZsYXRlLnB1c2goW2V4aXN0aW5nSW5zdGFuY2UsIGluc3RhbmNlQ2hhbmdlWzFdWzBdXSk7XG4gICAgICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgICAgY3JlYXRlSW5zdGFuY2VJbmZvKHNjb3BlLCBpbnN0YW5jZUNoYW5nZVswXSwgY3JlYXRlSW5zdGFuY2Uoc2NvcGUsIGluc3RhbmNlQ2hhbmdlWzFdLCB0b0luZmxhdGUpKTtcbiAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgdG9JbmZsYXRlLmZvckVhY2goZnVuY3Rpb24oY2hhbmdlKXtcbiAgICAgICAgaW5mbGF0ZURlZmluaXRpb24oc2NvcGUsIGNoYW5nZVswXSwgY2hhbmdlWzFdKTtcbiAgICB9KTtcblxuICAgIGZvcih2YXIgaSA9IDE7IGkgPCBjaGFuZ2VzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgdmFyIGNoYW5nZSA9IGNoYW5nZXNbaV07XG5cbiAgICAgICAgaWYoY2hhbmdlWzJdID09PSBSRU1PVkVEKXtcbiAgICAgICAgICAgIGRlbGV0ZSBzY29wZS5nZXRJbnN0YW5jZShjaGFuZ2VbMF0pW2NoYW5nZVsxXV07XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdmFyIHZhbHVlID0gY2hhbmdlWzNdO1xuXG4gICAgICAgICAgICBpZihBcnJheS5pc0FycmF5KGNoYW5nZVszXSkpe1xuICAgICAgICAgICAgICAgIHZhbHVlID0gc2NvcGUuZ2V0SW5zdGFuY2UoY2hhbmdlWzNdKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2NvcGUuZ2V0SW5zdGFuY2UoY2hhbmdlWzBdKVtjaGFuZ2VbMV1dID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldEluc3RhbmNlQnlJZChpZCl7XG4gICAgcmV0dXJuIHRoaXMuaW5zdGFuY2VzW2lkXTtcbn1cblxuZnVuY3Rpb24gc2V0SW5zdGFuY2VCeUlkKGlkLCB2YWx1ZSl7XG4gICAgdGhpcy5pbnN0YW5jZXNbaWRdID0gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUluc3RhbmNlQnlJZChpZCl7XG4gICAgZGVsZXRlIHRoaXMuaW5zdGFuY2VzW2lkXTtcbn1cblxuZnVuY3Rpb24gYnVpbGRJZE1hcChzY29wZSwgZGF0YSwgaWRzKXtcbiAgICBpZighaXNJbnN0YW5jZShkYXRhKSl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZihzY29wZS50cmFja2VkTWFwLmhhcyhkYXRhKSl7XG4gICAgICAgIGlkc1tzY29wZS5nZXRJbnN0YW5jZUlkKGRhdGEpXSA9IGRhdGE7XG4gICAgICAgIHJldHVybiBpZHM7XG4gICAgfVxuXG4gICAgaWRzW3Njb3BlLmdldEluc3RhbmNlSWQoZGF0YSldID0gZGF0YTtcblxuICAgIGZvcih2YXIga2V5IGluIGRhdGEpe1xuICAgICAgICBidWlsZElkTWFwKHNjb3BlLCBkYXRhW2tleV0sIGlkcyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGlkcztcbn1cblxuZnVuY3Rpb24gZGVzY3JpYmUoZGF0YSl7XG4gICAgdmFyIHNjb3BlID0gdGhpcztcblxuICAgIGlmKGlzSW5zdGFuY2UoZGF0YSkpe1xuICAgICAgICBpZihzY29wZS50cmFja2VkTWFwLmhhcyhkYXRhKSl7XG4gICAgICAgICAgICByZXR1cm4gW3Njb3BlLmdldEluc3RhbmNlSWQoZGF0YSldO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGlkcyA9IGJ1aWxkSWRNYXAoc2NvcGUsIGRhdGEsIHt9KTtcblxuICAgICAgICByZXR1cm4gT2JqZWN0LmtleXMoaWRzKS5tYXAoZnVuY3Rpb24oa2V5KXtcbiAgICAgICAgICAgIHJldHVybiBba2V5LCBjcmVhdGVJbnN0YW5jZURlZmluaXRpb24oc2NvcGUsIHNjb3BlLmluc3RhbmNlc1trZXldKV07XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBkYXRhO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlKGRlc2NyaXB0aW9uKXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuXG4gICAgaWYoQXJyYXkuaXNBcnJheShkZXNjcmlwdGlvbikgJiYgdHlwZW9mIGRlc2NyaXB0aW9uWzBdID09PSAnc3RyaW5nJyl7XG4gICAgICAgIHJldHVybiBzY29wZS5nZXRJbnN0YW5jZShkZXNjcmlwdGlvblswXSk7XG4gICAgfVxuXG4gICAgaWYoaXNJbnN0YW5jZShkZXNjcmlwdGlvbikpe1xuICAgICAgICB2YXIgdG9JbmZsYXRlID0gW107XG5cbiAgICAgICAgc2NvcGUudmlzY291cy5hcHBseShbZGVzY3JpcHRpb25dKTtcblxuICAgICAgICByZXR1cm4gc2NvcGUuZ2V0SW5zdGFuY2UoZGVzY3JpcHRpb25bMF1bMF0pO1xuICAgIH1cblxuICAgIHJldHVybiBkZXNjcmlwdGlvbjtcbn1cblxuZnVuY3Rpb24gdmlzY291cyhzdGF0ZSwgc2V0dGluZ3Mpe1xuICAgIGlmKCFzZXR0aW5ncyl7XG4gICAgICAgIHNldHRpbmdzID0ge1xuICAgICAgICAgICAgc2VyaWFsaXNlcjogZnVuY3Rpb24oKXt9LFxuICAgICAgICAgICAgZGVzZXJpYWxpc2VyOiBmdW5jdGlvbigpe31cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgdmlzY291cyA9IHt9O1xuXG4gICAgdmFyIHNjb3BlID0ge1xuICAgICAgICBuZXh0Q2hhbmdlOiBbXSxcbiAgICAgICAgY3VycmVudEluc3RhbmNlczogbmV3IFNldCgpLFxuICAgICAgICBzZXR0aW5nczogc2V0dGluZ3MsXG4gICAgICAgIHZpc2NvdXM6IHZpc2NvdXMsXG4gICAgICAgIHZpc2NvdXNJZDogc2V0dGluZ3MudmlzY291c0lkIHx8IHBhcnNlSW50KE1hdGgucmFuZG9tKCkgKiBNYXRoLnBvdygzNiwyKSkudG9TdHJpbmcoMzYpLFxuICAgICAgICBjdXJyZW50SWQ6IDAsXG4gICAgICAgIHN0YXRlOiBzdGF0ZSB8fCB7fSxcbiAgICAgICAgdHJhY2tlZE1hcDogbmV3IFdlYWtNYXAoKSxcbiAgICAgICAgaW5zdGFuY2VzOiB7fVxuICAgIH07XG5cbiAgICAvLyBTY29wZSBib3VuZCBmb3IgcGVyZi5cbiAgICBzY29wZS5nZXRDdXJyZW50Q2hhbmdlcyA9IGdldEN1cnJlbnRDaGFuZ2VzLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmdldEN1cnJlbnRDaGFuZ2UgPSBnZXRDdXJyZW50Q2hhbmdlLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmdldFJlbW92ZWRDaGFuZ2VzID0gZ2V0UmVtb3ZlZENoYW5nZXMuYmluZChzY29wZSk7XG4gICAgc2NvcGUuZ2V0UmVtb3ZlZENoYW5nZSA9IGdldFJlbW92ZWRDaGFuZ2UuYmluZChzY29wZSk7XG4gICAgc2NvcGUuZ2V0T2JqZWN0Q2hhbmdlcyA9IGdldE9iamVjdENoYW5nZXMuYmluZChzY29wZSk7XG4gICAgc2NvcGUuZ2V0SW5zdGFuY2UgPSBnZXRJbnN0YW5jZUJ5SWQuYmluZChzY29wZSk7XG4gICAgc2NvcGUuc2V0SW5zdGFuY2UgPSBzZXRJbnN0YW5jZUJ5SWQuYmluZChzY29wZSk7XG4gICAgc2NvcGUucmVtb3ZlSW5zdGFuY2UgPSByZW1vdmVJbnN0YW5jZUJ5SWQuYmluZChzY29wZSk7XG4gICAgc2NvcGUuZ2V0SW5zdGFuY2VJZCA9IGdldEluc3RhbmNlSWQuYmluZChzY29wZSk7XG4gICAgc2NvcGUuY2hhbmdlcyA9IGNoYW5nZXMuYmluZChzY29wZSk7XG5cbiAgICBzY29wZS5nZXRJZCA9IGdldElkLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmNyZWF0ZUlkID0gY3JlYXRlSWQuYmluZChzY29wZSk7XG5cbiAgICB2aXNjb3VzLmNoYW5nZXMgPSBzY29wZS5jaGFuZ2VzO1xuICAgIHZpc2NvdXMuYXBwbHkgPSBhcHBseS5iaW5kKHNjb3BlKTtcbiAgICB2aXNjb3VzLnN0YXRlID0gZ2V0U3RhdGUuYmluZChzY29wZSk7XG4gICAgdmlzY291cy5nZXRJZCA9IHNjb3BlLmdldEluc3RhbmNlSWQ7XG4gICAgdmlzY291cy5nZXRJbnN0YW5jZSA9IHNjb3BlLmdldEluc3RhbmNlO1xuICAgIHZpc2NvdXMuZGVzY3JpYmUgPSBkZXNjcmliZS5iaW5kKHNjb3BlKTtcbiAgICB2aXNjb3VzLmluZmxhdGUgPSBpbmZsYXRlLmJpbmQoc2NvcGUpO1xuXG4gICAgdmlzY291cy5jaGFuZ2VzKCk7XG5cbiAgICByZXR1cm4gdmlzY291cztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB2aXNjb3VzO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc1NhbWUoYSwgYil7XG4gICAgaWYoYSA9PT0gYil7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmKFxuICAgICAgICB0eXBlb2YgYSAhPT0gdHlwZW9mIGIgfHxcbiAgICAgICAgdHlwZW9mIGEgPT09ICdvYmplY3QnICYmXG4gICAgICAgICEoYSBpbnN0YW5jZW9mIERhdGUgJiYgYiBpbnN0YW5jZW9mIERhdGUpXG4gICAgKXtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBTdHJpbmcoYSkgPT09IFN0cmluZyhiKTtcbn07Il19
