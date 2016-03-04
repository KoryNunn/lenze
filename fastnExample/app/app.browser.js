(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"simple-ajax":14}],2:[function(require,module,exports){
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

},{}],3:[function(require,module,exports){
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
},{}],4:[function(require,module,exports){
var cpjax = require('cpjax'),
    lenze = require('../../')({
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

function updateUsers(){
    state.visibleUsers = state.users && state.users.filter(function(user){
        return user.name.indexOf(state.search);
    });
};

state.setSearch = function(value){
    state.search = value;
    updateUsers();
};

cpjax({
    url: 'users.json',
    dataType: 'json'
}, function(error, data){
    if(error){
        return;
    }

    state.users = data;
    updateUsers();
});
},{"../../":5,"cpjax":1}],5:[function(require,module,exports){
var EventEmitter = require('events'),
    diff = require('deep-diff'),
    shuv = require('shuv'),
    statham = require('statham'),
    createKey = require('./createKey'),
    keyKey = createKey(-2),
    merge = require('merge');

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
            }else{
                merge(scope.instanceHash[id].value, value);
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

},{"./createKey":3,"deep-diff":6,"events":2,"merge":7,"shuv":8,"statham":12}],6:[function(require,module,exports){
(function (global){
/*!
 * deep-diff.
 * Licensed under the MIT License.
 */
;(function(root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.DeepDiff = factory();
  }
}(this, function(undefined) {
  'use strict';

  var $scope, conflict, conflictResolution = [];
  if (typeof global === 'object' && global) {
    $scope = global;
  } else if (typeof window !== 'undefined') {
    $scope = window;
  } else {
    $scope = {};
  }
  conflict = $scope.DeepDiff;
  if (conflict) {
    conflictResolution.push(
      function() {
        if ('undefined' !== typeof conflict && $scope.DeepDiff === accumulateDiff) {
          $scope.DeepDiff = conflict;
          conflict = undefined;
        }
      });
  }

  // nodejs compatible on server side and in the browser.
  function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  }

  function Diff(kind, path) {
    Object.defineProperty(this, 'kind', {
      value: kind,
      enumerable: true
    });
    if (path && path.length) {
      Object.defineProperty(this, 'path', {
        value: path,
        enumerable: true
      });
    }
  }

  function DiffEdit(path, origin, value) {
    DiffEdit.super_.call(this, 'E', path);
    Object.defineProperty(this, 'lhs', {
      value: origin,
      enumerable: true
    });
    Object.defineProperty(this, 'rhs', {
      value: value,
      enumerable: true
    });
  }
  inherits(DiffEdit, Diff);

  function DiffNew(path, value) {
    DiffNew.super_.call(this, 'N', path);
    Object.defineProperty(this, 'rhs', {
      value: value,
      enumerable: true
    });
  }
  inherits(DiffNew, Diff);

  function DiffDeleted(path, value) {
    DiffDeleted.super_.call(this, 'D', path);
    Object.defineProperty(this, 'lhs', {
      value: value,
      enumerable: true
    });
  }
  inherits(DiffDeleted, Diff);

  function DiffArray(path, index, item) {
    DiffArray.super_.call(this, 'A', path);
    Object.defineProperty(this, 'index', {
      value: index,
      enumerable: true
    });
    Object.defineProperty(this, 'item', {
      value: item,
      enumerable: true
    });
  }
  inherits(DiffArray, Diff);

  function arrayRemove(arr, from, to) {
    var rest = arr.slice((to || from) + 1 || arr.length);
    arr.length = from < 0 ? arr.length + from : from;
    arr.push.apply(arr, rest);
    return arr;
  }

  function realTypeOf(subject) {
    var type = typeof subject;
    if (type !== 'object') {
      return type;
    }

    if (subject === Math) {
      return 'math';
    } else if (subject === null) {
      return 'null';
    } else if (Array.isArray(subject)) {
      return 'array';
    } else if (subject instanceof Date) {
      return 'date';
    } else if (/^\/.*\//.test(subject.toString())) {
      return 'regexp';
    }
    return 'object';
  }

  function deepDiff(lhs, rhs, changes, prefilter, path, key, stack) {
    path = path || [];
    var currentPath = path.slice(0);
    if (typeof key !== 'undefined') {
      if (prefilter && prefilter(currentPath, key, { lhs: lhs, rhs: rhs })) {
        return;
      }
      currentPath.push(key);
    }
    var ltype = typeof lhs;
    var rtype = typeof rhs;
    if (ltype === 'undefined') {
      if (rtype !== 'undefined') {
        changes(new DiffNew(currentPath, rhs));
      }
    } else if (rtype === 'undefined') {
      changes(new DiffDeleted(currentPath, lhs));
    } else if (realTypeOf(lhs) !== realTypeOf(rhs)) {
      changes(new DiffEdit(currentPath, lhs, rhs));
    } else if (lhs instanceof Date && rhs instanceof Date && ((lhs - rhs) !== 0)) {
      changes(new DiffEdit(currentPath, lhs, rhs));
    } else if (ltype === 'object' && lhs !== null && rhs !== null) {
      stack = stack || [];
      if (stack.indexOf(lhs) < 0) {
        stack.push(lhs);
        if (Array.isArray(lhs)) {
          var i, len = lhs.length;
          for (i = 0; i < lhs.length; i++) {
            if (i >= rhs.length) {
              changes(new DiffArray(currentPath, i, new DiffDeleted(undefined, lhs[i])));
            } else {
              deepDiff(lhs[i], rhs[i], changes, prefilter, currentPath, i, stack);
            }
          }
          while (i < rhs.length) {
            changes(new DiffArray(currentPath, i, new DiffNew(undefined, rhs[i++])));
          }
        } else {
          var akeys = Object.keys(lhs);
          var pkeys = Object.keys(rhs);
          akeys.forEach(function(k, i) {
            var other = pkeys.indexOf(k);
            if (other >= 0) {
              deepDiff(lhs[k], rhs[k], changes, prefilter, currentPath, k, stack);
              pkeys = arrayRemove(pkeys, other);
            } else {
              deepDiff(lhs[k], undefined, changes, prefilter, currentPath, k, stack);
            }
          });
          pkeys.forEach(function(k) {
            deepDiff(undefined, rhs[k], changes, prefilter, currentPath, k, stack);
          });
        }
        stack.length = stack.length - 1;
      }
    } else if (lhs !== rhs) {
      if (!(ltype === 'number' && isNaN(lhs) && isNaN(rhs))) {
        changes(new DiffEdit(currentPath, lhs, rhs));
      }
    }
  }

  function accumulateDiff(lhs, rhs, prefilter, accum) {
    accum = accum || [];
    deepDiff(lhs, rhs,
      function(diff) {
        if (diff) {
          accum.push(diff);
        }
      },
      prefilter);
    return (accum.length) ? accum : undefined;
  }

  function applyArrayChange(arr, index, change) {
    if (change.path && change.path.length) {
      var it = arr[index],
        i, u = change.path.length - 1;
      for (i = 0; i < u; i++) {
        it = it[change.path[i]];
      }
      switch (change.kind) {
        case 'A':
          applyArrayChange(it[change.path[i]], change.index, change.item);
          break;
        case 'D':
          delete it[change.path[i]];
          break;
        case 'E':
        case 'N':
          it[change.path[i]] = change.rhs;
          break;
      }
    } else {
      switch (change.kind) {
        case 'A':
          applyArrayChange(arr[index], change.index, change.item);
          break;
        case 'D':
          arr = arrayRemove(arr, index);
          break;
        case 'E':
        case 'N':
          arr[index] = change.rhs;
          break;
      }
    }
    return arr;
  }

  function applyChange(target, source, change) {
    if (target && source && change && change.kind) {
      var it = target,
        i = -1,
        last = change.path ? change.path.length - 1 : 0;
      while (++i < last) {
        if (typeof it[change.path[i]] === 'undefined') {
          it[change.path[i]] = (typeof change.path[i] === 'number') ? [] : {};
        }
        it = it[change.path[i]];
      }
      switch (change.kind) {
        case 'A':
          applyArrayChange(change.path ? it[change.path[i]] : it, change.index, change.item);
          break;
        case 'D':
          delete it[change.path[i]];
          break;
        case 'E':
        case 'N':
          it[change.path[i]] = change.rhs;
          break;
      }
    }
  }

  function revertArrayChange(arr, index, change) {
    if (change.path && change.path.length) {
      // the structure of the object at the index has changed...
      var it = arr[index],
        i, u = change.path.length - 1;
      for (i = 0; i < u; i++) {
        it = it[change.path[i]];
      }
      switch (change.kind) {
        case 'A':
          revertArrayChange(it[change.path[i]], change.index, change.item);
          break;
        case 'D':
          it[change.path[i]] = change.lhs;
          break;
        case 'E':
          it[change.path[i]] = change.lhs;
          break;
        case 'N':
          delete it[change.path[i]];
          break;
      }
    } else {
      // the array item is different...
      switch (change.kind) {
        case 'A':
          revertArrayChange(arr[index], change.index, change.item);
          break;
        case 'D':
          arr[index] = change.lhs;
          break;
        case 'E':
          arr[index] = change.lhs;
          break;
        case 'N':
          arr = arrayRemove(arr, index);
          break;
      }
    }
    return arr;
  }

  function revertChange(target, source, change) {
    if (target && source && change && change.kind) {
      var it = target,
        i, u;
      u = change.path.length - 1;
      for (i = 0; i < u; i++) {
        if (typeof it[change.path[i]] === 'undefined') {
          it[change.path[i]] = {};
        }
        it = it[change.path[i]];
      }
      switch (change.kind) {
        case 'A':
          // Array was modified...
          // it will be an array...
          revertArrayChange(it[change.path[i]], change.index, change.item);
          break;
        case 'D':
          // Item was deleted...
          it[change.path[i]] = change.lhs;
          break;
        case 'E':
          // Item was edited...
          it[change.path[i]] = change.lhs;
          break;
        case 'N':
          // Item is new...
          delete it[change.path[i]];
          break;
      }
    }
  }

  function applyDiff(target, source, filter) {
    if (target && source) {
      var onChange = function(change) {
        if (!filter || filter(target, source, change)) {
          applyChange(target, source, change);
        }
      };
      deepDiff(target, source, onChange);
    }
  }

  Object.defineProperties(accumulateDiff, {

    diff: {
      value: accumulateDiff,
      enumerable: true
    },
    observableDiff: {
      value: deepDiff,
      enumerable: true
    },
    applyDiff: {
      value: applyDiff,
      enumerable: true
    },
    applyChange: {
      value: applyChange,
      enumerable: true
    },
    revertChange: {
      value: revertChange,
      enumerable: true
    },
    isConflict: {
      value: function() {
        return 'undefined' !== typeof conflict;
      },
      enumerable: true
    },
    noConflict: {
      value: function() {
        if (conflictResolution) {
          conflictResolution.forEach(function(it) {
            it();
          });
          conflictResolution = null;
        }
        return accumulateDiff;
      },
      enumerable: true
    }
  });

  return accumulateDiff;
}));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],7:[function(require,module,exports){
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
},{}],8:[function(require,module,exports){
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
},{}],9:[function(require,module,exports){
arguments[4][3][0].apply(exports,arguments)
},{"dup":3}],10:[function(require,module,exports){
var revive = require('./revive');

function parse(json, reviver){
    return revive(JSON.parse(json, reviver));
}

module.exports = parse;
},{"./revive":11}],11:[function(require,module,exports){
var createKey = require('./createKey'),
    keyKey = createKey(-1);

function revive(input){
    var objects = {},
        scannedObjects = [];

    function scan(input){
        var output = input;

        if(typeof output !== 'object'){
            return output;
        }

        output = input instanceof Array ? [] : {};

        if(input[keyKey]){
            objects[input[keyKey]] = output;
        }

        for(var key in input){
            var value = input[key];

            if(key === keyKey){
                continue;
            }

            if(value != null && typeof value === 'object'){
                if(scannedObjects.indexOf(value)<0){
                    scannedObjects.push(value);
                    output[key] = scan(value);
                }
            }else if(typeof value === 'string' && value.length === 1 && value.charCodeAt(0) > keyKey.charCodeAt(0)){
                output[key] = objects[value] || input[key];
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
},{"./createKey":9}],12:[function(require,module,exports){
module.exports = {
    stringify: require('./stringify'),
    parse: require('./parse'),
    revive: require('./revive')
};
},{"./parse":10,"./revive":11,"./stringify":13}],13:[function(require,module,exports){
var createKey = require('./createKey'),
    keyKey = createKey(-1);

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

        if(input === null || typeof input !== 'object'){
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
},{"./createKey":9}],14:[function(require,module,exports){
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

},{"events":2,"query-string":15}],15:[function(require,module,exports){
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

},{}]},{},[4])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92NS4zLjAvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y1LjMuMC9saWIvbm9kZV9tb2R1bGVzL2NwamF4L2luZGV4LmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y1LjMuMC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiY3JlYXRlS2V5LmpzIiwiZmFzdG5FeGFtcGxlL2FwcC9hcHAuanMiLCJpbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kZWVwLWRpZmYvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbWVyZ2UvbWVyZ2UuanMiLCJub2RlX21vZHVsZXMvc2h1di9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zdGF0aGFtL3BhcnNlLmpzIiwibm9kZV9tb2R1bGVzL3N0YXRoYW0vcmV2aXZlLmpzIiwibm9kZV9tb2R1bGVzL3N0YXRoYW0vc3RhdGhhbS5qcyIsIm5vZGVfbW9kdWxlcy9zdGF0aGFtL3N0cmluZ2lmeS5qcyIsIi4uL3NpbXBsZS1hamF4L2luZGV4LmpzIiwiLi4vc2ltcGxlLWFqYXgvbm9kZV9tb2R1bGVzL3F1ZXJ5LXN0cmluZy9xdWVyeS1zdHJpbmcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzNRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDblpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBBamF4ID0gcmVxdWlyZSgnc2ltcGxlLWFqYXgnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihzZXR0aW5ncywgY2FsbGJhY2spe1xuICAgIGlmKHR5cGVvZiBzZXR0aW5ncyA9PT0gJ3N0cmluZycpe1xuICAgICAgICBzZXR0aW5ncyA9IHtcbiAgICAgICAgICAgIHVybDogc2V0dGluZ3NcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBpZih0eXBlb2Ygc2V0dGluZ3MgIT09ICdvYmplY3QnKXtcbiAgICAgICAgdGhyb3cgJ3NldHRpbmdzIG11c3QgYmUgYSBzdHJpbmcgb3Igb2JqZWN0JztcbiAgICB9XG5cbiAgICBpZih0eXBlb2YgY2FsbGJhY2sgIT09ICdmdW5jdGlvbicpe1xuICAgICAgICB0aHJvdyAnY3BqYXggbXVzdCBiZSBwYXNzZWQgYSBjYWxsYmFjayBhcyB0aGUgc2Vjb25kIHBhcmFtZXRlcic7XG4gICAgfVxuXG4gICAgdmFyIGFqYXggPSBuZXcgQWpheChzZXR0aW5ncyk7XG5cbiAgICBhamF4Lm9uKCdzdWNjZXNzJywgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgZGF0YSwgZXZlbnQpO1xuICAgIH0pO1xuICAgIGFqYXgub24oJ2Vycm9yJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgY2FsbGJhY2sobmV3IEVycm9yKGV2ZW50LnRhcmdldC5yZXNwb25zZVRleHQpLCBudWxsLCBldmVudCk7XG4gICAgfSk7XG5cbiAgICBhamF4LnNlbmQoKTtcblxuICAgIHJldHVybiBhamF4O1xufTsiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJmdW5jdGlvbiBlc2NhcGVIZXgoaGV4KXtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShoZXgpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVLZXkobnVtYmVyKXtcbiAgICBpZihudW1iZXIgKyAweEUwMDEgPiAweEZGRkYpe1xuICAgICAgICB0aHJvdyBcIlRvbyBtYW55IHJlZmVyZW5jZXMuIExvZyBhbiBpc3N1ZSBvbiBnaWh1YiBhbiBpJ2xsIGFkZCBhbiBvcmRlciBvZiBtYWduYXR1ZGUgdG8gdGhlIGtleXMuXCI7XG4gICAgfVxuICAgIHJldHVybiBlc2NhcGVIZXgobnVtYmVyICsgMHhFMDAxKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVLZXk7IiwidmFyIGNwamF4ID0gcmVxdWlyZSgnY3BqYXgnKSxcbiAgICBsZW56ZSA9IHJlcXVpcmUoJy4uLy4uLycpKHtcbiAgICBjaGFuZ2VJbnRlcnZhbDogMTYsXG4gICAgc2VuZDogZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIHNlbGYucG9zdE1lc3NhZ2UoZGF0YSk7XG4gICAgfSxcbiAgICByZWNlaXZlOiBmdW5jdGlvbihjYWxsYmFjayl7XG4gICAgICAgIHNlbGYuYWRkRXZlbnRMaXN0ZW5lcignbWVzc2FnZScsIGZ1bmN0aW9uKG1lc3NhZ2Upe1xuICAgICAgICAgICAgY2FsbGJhY2sobWVzc2FnZS5kYXRhKTtcbiAgICAgICAgfSk7XG4gICAgfVxufSk7XG5cbnZhciBzdGF0ZSA9IGxlbnplLnN0YXRlO1xuXG5mdW5jdGlvbiB1cGRhdGVVc2Vycygpe1xuICAgIHN0YXRlLnZpc2libGVVc2VycyA9IHN0YXRlLnVzZXJzICYmIHN0YXRlLnVzZXJzLmZpbHRlcihmdW5jdGlvbih1c2VyKXtcbiAgICAgICAgcmV0dXJuIHVzZXIubmFtZS5pbmRleE9mKHN0YXRlLnNlYXJjaCk7XG4gICAgfSk7XG59O1xuXG5zdGF0ZS5zZXRTZWFyY2ggPSBmdW5jdGlvbih2YWx1ZSl7XG4gICAgc3RhdGUuc2VhcmNoID0gdmFsdWU7XG4gICAgdXBkYXRlVXNlcnMoKTtcbn07XG5cbmNwamF4KHtcbiAgICB1cmw6ICd1c2Vycy5qc29uJyxcbiAgICBkYXRhVHlwZTogJ2pzb24nXG59LCBmdW5jdGlvbihlcnJvciwgZGF0YSl7XG4gICAgaWYoZXJyb3Ipe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc3RhdGUudXNlcnMgPSBkYXRhO1xuICAgIHVwZGF0ZVVzZXJzKCk7XG59KTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJyksXG4gICAgZGlmZiA9IHJlcXVpcmUoJ2RlZXAtZGlmZicpLFxuICAgIHNodXYgPSByZXF1aXJlKCdzaHV2JyksXG4gICAgc3RhdGhhbSA9IHJlcXVpcmUoJ3N0YXRoYW0nKSxcbiAgICBjcmVhdGVLZXkgPSByZXF1aXJlKCcuL2NyZWF0ZUtleScpLFxuICAgIGtleUtleSA9IGNyZWF0ZUtleSgtMiksXG4gICAgbWVyZ2UgPSByZXF1aXJlKCdtZXJnZScpO1xuXG52YXIgSU5WT0tFID0gJ2ludm9rZSc7XG52YXIgQ0hBTkdFUyA9ICdjaGFuZ2VzJztcbnZhciBDT05ORUNUID0gJ2Nvbm5lY3QnO1xudmFyIFNUQVRFID0gJ3N0YXRlJztcblxuZnVuY3Rpb24gYXBwbHlDaGFuZ2VzKHRhcmdldCwgY2hhbmdlcyl7XG4gICAgY2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGNoYW5nZSl7XG4gICAgICAgIGRpZmYuYXBwbHlDaGFuZ2UodGFyZ2V0LCB0cnVlICwgY2hhbmdlKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gdHJhbnNmb3JtRnVuY3Rpb25zKHNjb3BlLCBrZXksIHZhbHVlKXtcbiAgICBpZih0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicgJiYgdmFsdWVba2V5S2V5XSl7XG4gICAgICAgIHJldHVybiB7J0xFTlpFX0ZVTkNUSU9OJzogdmFsdWVba2V5S2V5XX07XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlO1xufVxuXG5mdW5jdGlvbiBuZXh0SW5zdGFuY2VJZChzY29wZSl7XG4gICAgcmV0dXJuIHNjb3BlLmluc3RhbmNlSWRzKys7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNoYW5nZXMoc2NvcGUsIGNoYW5nZXMpe1xuICAgIGNoYW5nZXMgPSBjaGFuZ2VzLm1hcChmdW5jdGlvbihjaGFuZ2Upe1xuICAgICAgICB2YXIgdmFsdWUgPSBjaGFuZ2UucmhzO1xuXG4gICAgICAgIGlmKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpe1xuICAgICAgICAgICAgaWYoIXZhbHVlW2tleUtleV0pe1xuICAgICAgICAgICAgICAgIHZhbHVlW2tleUtleV0gPSBjcmVhdGVLZXkobmV4dEluc3RhbmNlSWQoc2NvcGUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyl7XG4gICAgICAgICAgICB2YXIgaWQgPSB2YWx1ZVtrZXlLZXldO1xuXG4gICAgICAgICAgICBpZihpZCA9PSBudWxsKXtcbiAgICAgICAgICAgICAgICBpZCA9IHZhbHVlW2tleUtleV0gPSBjcmVhdGVLZXkobmV4dEluc3RhbmNlSWQoc2NvcGUpKTtcbiAgICAgICAgICAgICAgICBzY29wZS5mdW5jdGlvbnNbaWRdID0ge1xuICAgICAgICAgICAgICAgICAgICBmbjogdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2NvcGUuZnVuY3Rpb25zW2lkXS5jb3VudCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNoYW5nZTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzdGF0aGFtLnN0cmluZ2lmeShjaGFuZ2VzLCBzaHV2KHRyYW5zZm9ybUZ1bmN0aW9ucywgc2NvcGUpKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VNZXNzYWdlKGRhdGEpe1xuICAgIHZhciBtZXNzYWdlID0gZGF0YS5tYXRjaCgvXihcXHcrPylcXDooLiopLyk7XG5cbiAgICBpZihtZXNzYWdlKXtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IG1lc3NhZ2VbMV0sXG4gICAgICAgICAgICBkYXRhOiBtZXNzYWdlWzJdXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlY2VpdmUoc2NvcGUsIGRhdGEpe1xuICAgIHZhciBtZXNzYWdlID0gcGFyc2VNZXNzYWdlKGRhdGEpO1xuXG4gICAgaWYoIW1lc3NhZ2Upe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYobWVzc2FnZS50eXBlID09PSBJTlZPS0Upe1xuICAgICAgICBzY29wZS5oYW5kbGVGdW5jdGlvbi5hcHBseShudWxsLCBzdGF0aGFtLnBhcnNlKG1lc3NhZ2UuZGF0YSkpO1xuICAgIH1cblxuICAgIGlmKG1lc3NhZ2UudHlwZSA9PT0gQ09OTkVDVCl7XG4gICAgICAgIHNjb3BlLnNlbmQoQ09OTkVDVCwgc2NvcGUubGVuemUuc3RhdGUpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaW5mbGF0ZURhdGEoc2NvcGUsIHZhbHVlKXtcbiAgICBpZih2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKXtcbiAgICAgICAgaWYodmFsdWVba2V5S2V5XSl7XG4gICAgICAgICAgICB2YXIgaWQgPSB2YWx1ZVtrZXlLZXldO1xuICAgICAgICAgICAgaWYoIXNjb3BlLmluc3RhbmNlSGFzaFtpZF0pe1xuICAgICAgICAgICAgICAgIHNjb3BlLmluc3RhbmNlSGFzaFtpZF0gPSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgY291bnQ6IDBcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgbWVyZ2Uoc2NvcGUuaW5zdGFuY2VIYXNoW2lkXS52YWx1ZSwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gc2NvcGUuaW5zdGFuY2VIYXNoW2lkXS52YWx1ZTtcbiAgICAgICAgfWVsc2UgaWYoJ0xFTlpFX0ZVTkNUSU9OJyBpbiB2YWx1ZSl7XG4gICAgICAgICAgICB2YXIgZnVuY3Rpb25JZCA9IHZhbHVlWydMRU5aRV9GVU5DVElPTiddLFxuICAgICAgICAgICAgICAgIGZuID0gc2NvcGUuaW52b2tlLmJpbmQodGhpcywgdmFsdWVbJ0xFTlpFX0ZVTkNUSU9OJ10pO1xuXG4gICAgICAgICAgICBmblsnTEVOWkVfRlVOQ1RJT04nXSA9IGZ1bmN0aW9uSWQ7XG4gICAgICAgICAgICBpZighc2NvcGUuZnVuY3Rpb25zW2Z1bmN0aW9uSWRdKXtcbiAgICAgICAgICAgICAgICBzY29wZS5mdW5jdGlvbnNbZnVuY3Rpb25JZF0gPSB7XG4gICAgICAgICAgICAgICAgICAgIGZuOiBmbixcbiAgICAgICAgICAgICAgICAgICAgY291bnQ6IDBcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZuO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlT2JqZWN0KHNjb3BlLCBjaGFuZ2Upe1xuICAgIHZhciBpZCA9IGNoYW5nZS5yaHMgJiYgY2hhbmdlLnJoc1trZXlLZXldO1xuXG4gICAgY2hhbmdlLnJocyA9IGluZmxhdGVEYXRhKHNjb3BlLCBjaGFuZ2UucmhzKTtcbiAgICBjaGFuZ2UubGhzID0gaW5mbGF0ZURhdGEoc2NvcGUsIGNoYW5nZS5saHMpO1xuXG4gICAgaWYoIWlkKXtcbiAgICAgICAgcmV0dXJuIGNoYW5nZTtcbiAgICB9XG5cbiAgICBpZighY2hhbmdlLnJocyB8fCB0eXBlb2YgY2hhbmdlLnJocyAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgc2NvcGUuaW5zdGFuY2VIYXNoW2lkXS5jb3VudCArPSBjaGFuZ2Uua2luZCA9PT0gJ04nID8gMSA6IC0xO1xuXG4gICAgaWYodHlwZW9mIGNoYW5nZS5yaHMgPT09ICdmdW5jdGlvbicpe1xuICAgICAgICBjaGFuZ2UucmhzW2tleUtleV0gPSBpZDtcbiAgICB9XG5cbiAgICBkZWxldGUgY2hhbmdlLnJoc1trZXlLZXldO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlQ2hhbmdlcyhzY29wZSwgZGF0YSl7XG4gICAgcmV0dXJuIHN0YXRoYW0ucGFyc2UoZGF0YSkubWFwKGZ1bmN0aW9uKGNoYW5nZSl7XG4gICAgICAgIHZhciB2YWx1ZSA9IGNoYW5nZS5yaHM7XG5cbiAgICAgICAgaW5mbGF0ZU9iamVjdChzY29wZSwgY2hhbmdlKTtcblxuICAgICAgICB2YXIgcHJldmlvdXMgPSBjaGFuZ2UubGhzO1xuXG4gICAgICAgIGlmKHR5cGVvZiBwcmV2aW91cyA9PT0gJ2Z1bmN0aW9uJyl7XG5cbiAgICAgICAgICAgIHZhciBpZCA9IHByZXZpb3VzICYmIHByZXZpb3VzWydMRU5aRV9GVU5DVElPTiddO1xuICAgICAgICAgICAgaWYoaWQpe1xuICAgICAgICAgICAgICAgIHNjb3BlLmZ1bmN0aW9uc1tpZF0uY291bnQtLTtcbiAgICAgICAgICAgICAgICBpZighc2NvcGUuZnVuY3Rpb25zW2lkXS5jb3VudCl7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBzY29wZS5mdW5jdGlvbnNbaWRdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHR5cGVvZiBjaGFuZ2UucmhzID09PSAnZnVuY3Rpb24nICYmICdMRU5aRV9GVU5DVElPTicgaW4gY2hhbmdlLnJocyl7XG4gICAgICAgICAgICBzY29wZS5mdW5jdGlvbnNbY2hhbmdlLnJoc1snTEVOWkVfRlVOQ1RJT04nXV0uY291bnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjaGFuZ2U7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZShzY29wZSl7XG4gICAgdmFyIGNoYW5nZXMgPSBkaWZmKHNjb3BlLm9yaWdpbmFsLCBzY29wZS5sZW56ZS5zdGF0ZSk7XG5cbiAgICBpZihjaGFuZ2VzKXtcbiAgICAgICAgc2NvcGUubGVuemUuZW1pdCgnY2hhbmdlJywgY2hhbmdlcyk7XG4gICAgICAgIGFwcGx5Q2hhbmdlcyhzY29wZS5vcmlnaW5hbCwgY2hhbmdlcyk7XG4gICAgICAgIGlmKHNjb3BlLnNlbmQpe1xuICAgICAgICAgICAgc2NvcGUuc2VuZChDSEFOR0VTLCBjaGFuZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlRnVuY3Rpb24oc2NvcGUsIGlkKXtcbiAgICBzY29wZS5mdW5jdGlvbnNbaWRdLmZuLmFwcGx5KHRoaXMsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMikpO1xufVxuXG5mdW5jdGlvbiBzZW5kKHNjb3BlLCBzZW5kLCB0eXBlLCBkYXRhKXtcbiAgICBpZih0eXBlID09PSBDSEFOR0VTKXtcbiAgICAgICAgc2VuZChDSEFOR0VTICsgJzonICsgY3JlYXRlQ2hhbmdlcyhzY29wZSwgZGF0YSkpO1xuICAgIH1cbiAgICBpZih0eXBlID09PSBDT05ORUNUKXtcbiAgICAgICAgc2VuZChTVEFURSArICc6JyArIHN0YXRoYW0uc3RyaW5naWZ5KGRhdGEsIHNodXYodHJhbnNmb3JtRnVuY3Rpb25zLCBzY29wZSkpKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNlbmRJbnZva2Uoc2NvcGUsIHNlbmRJbnZva2Upe1xuICAgIHNlbmRJbnZva2UoSU5WT0tFICsgJzonICsgc3RhdGhhbS5zdHJpbmdpZnkoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSkpO1xufVxuXG5mdW5jdGlvbiBpbml0U2NvcGUoc2V0dGluZ3Mpe1xuICAgIGlmKCFzZXR0aW5ncyl7XG4gICAgICAgIHNldHRpbmdzID0ge307XG4gICAgfVxuXG4gICAgdmFyIGxlbnplID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICAgIHZhciBzY29wZSA9IHtcbiAgICAgICAgZnVuY3Rpb25zOiB7fSxcbiAgICAgICAgaW5zdGFuY2VJZHM6IDAsXG4gICAgICAgIGxlbnplOiBsZW56ZSxcbiAgICAgICAgb3JpZ2luYWw6IHt9XG4gICAgfTtcblxuICAgIGxlbnplLnVwZGF0ZSA9IHNodXYodXBkYXRlLCBzY29wZSk7XG4gICAgbGVuemUuc3RhdGUgPSB7fTtcblxuICAgIHJldHVybiBzY29wZTtcbn1cblxuZnVuY3Rpb24gaW5pdChzZXR0aW5ncyl7XG4gICAgdmFyIHNjb3BlID0gaW5pdFNjb3BlKHNldHRpbmdzKTtcblxuICAgIHNjb3BlLmhhbmRsZUZ1bmN0aW9uID0gc2h1dihoYW5kbGVGdW5jdGlvbiwgc2NvcGUpO1xuICAgIHNjb3BlLnNlbmQgPSBzaHV2KHNlbmQsIHNjb3BlLCBzZXR0aW5ncy5zZW5kKTtcbiAgICBzZXR0aW5ncy5yZWNlaXZlKHNodXYocmVjZWl2ZSwgc2NvcGUpKTtcblxuICAgIHNldEludGVydmFsKHNjb3BlLmxlbnplLnVwZGF0ZSwgc2V0dGluZ3MuY2hhbmdlSW50ZXJ2YWwgfHwgMTAwKTtcblxuICAgIHJldHVybiBzY29wZS5sZW56ZTtcbn1cblxuZnVuY3Rpb24gcmVwbGljYW50KHNldHRpbmdzKXtcbiAgICB2YXIgc2NvcGUgPSBpbml0U2NvcGUoKTtcblxuICAgIHNjb3BlLmluc3RhbmNlSGFzaCA9IHt9O1xuXG4gICAgc2V0dGluZ3MucmVjZWl2ZShmdW5jdGlvbihkYXRhKXtcbiAgICAgICAgaWYoIXNjb3BlLnJlYWR5KXtcbiAgICAgICAgICAgIHNjb3BlLnJlYWR5ID0gdHJ1ZTtcbiAgICAgICAgICAgIHNjb3BlLmxlbnplLmVtaXQoJ3JlYWR5Jyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbWVzc2FnZSA9IHBhcnNlTWVzc2FnZShkYXRhKTtcblxuICAgICAgICBpZighbWVzc2FnZSl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZihtZXNzYWdlLnR5cGUgPT09IFNUQVRFKXtcbiAgICAgICAgICAgIHNjb3BlLmxlbnplLnN0YXRlID0gaW5mbGF0ZURhdGEoc2NvcGUsIHN0YXRoYW0ucGFyc2UobWVzc2FnZS5kYXRhKSk7XG4gICAgICAgICAgICB1cGRhdGUoc2NvcGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYobWVzc2FnZS50eXBlID09PSBDSEFOR0VTKXtcbiAgICAgICAgICAgIGFwcGx5Q2hhbmdlcyhzY29wZS5sZW56ZS5zdGF0ZSwgaW5mbGF0ZUNoYW5nZXMoc2NvcGUsIG1lc3NhZ2UuZGF0YSkpO1xuICAgICAgICAgICAgdXBkYXRlKHNjb3BlKTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgc2NvcGUuaW52b2tlID0gc2h1dihzZW5kSW52b2tlLCBzY29wZSwgc2V0dGluZ3Muc2VuZCk7XG5cbiAgICBzZXR0aW5ncy5zZW5kKENPTk5FQ1QgKyAnOicpO1xuXG4gICAgcmV0dXJuIHNjb3BlLmxlbnplXG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW5pdDtcbm1vZHVsZS5leHBvcnRzLnJlcGxpY2FudCA9IHJlcGxpY2FudDtcbiIsIi8qIVxuICogZGVlcC1kaWZmLlxuICogTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLlxuICovXG47KGZ1bmN0aW9uKHJvb3QsIGZhY3RvcnkpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgLy8gQU1ELiBSZWdpc3RlciBhcyBhbiBhbm9ueW1vdXMgbW9kdWxlLlxuICAgIGRlZmluZShbXSwgZmFjdG9yeSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgLy8gTm9kZS4gRG9lcyBub3Qgd29yayB3aXRoIHN0cmljdCBDb21tb25KUywgYnV0XG4gICAgLy8gb25seSBDb21tb25KUy1saWtlIGVudmlyb25tZW50cyB0aGF0IHN1cHBvcnQgbW9kdWxlLmV4cG9ydHMsXG4gICAgLy8gbGlrZSBOb2RlLlxuICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpO1xuICB9IGVsc2Uge1xuICAgIC8vIEJyb3dzZXIgZ2xvYmFscyAocm9vdCBpcyB3aW5kb3cpXG4gICAgcm9vdC5EZWVwRGlmZiA9IGZhY3RvcnkoKTtcbiAgfVxufSh0aGlzLCBmdW5jdGlvbih1bmRlZmluZWQpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciAkc2NvcGUsIGNvbmZsaWN0LCBjb25mbGljdFJlc29sdXRpb24gPSBbXTtcbiAgaWYgKHR5cGVvZiBnbG9iYWwgPT09ICdvYmplY3QnICYmIGdsb2JhbCkge1xuICAgICRzY29wZSA9IGdsb2JhbDtcbiAgfSBlbHNlIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJykge1xuICAgICRzY29wZSA9IHdpbmRvdztcbiAgfSBlbHNlIHtcbiAgICAkc2NvcGUgPSB7fTtcbiAgfVxuICBjb25mbGljdCA9ICRzY29wZS5EZWVwRGlmZjtcbiAgaWYgKGNvbmZsaWN0KSB7XG4gICAgY29uZmxpY3RSZXNvbHV0aW9uLnB1c2goXG4gICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCd1bmRlZmluZWQnICE9PSB0eXBlb2YgY29uZmxpY3QgJiYgJHNjb3BlLkRlZXBEaWZmID09PSBhY2N1bXVsYXRlRGlmZikge1xuICAgICAgICAgICRzY29wZS5EZWVwRGlmZiA9IGNvbmZsaWN0O1xuICAgICAgICAgIGNvbmZsaWN0ID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIC8vIG5vZGVqcyBjb21wYXRpYmxlIG9uIHNlcnZlciBzaWRlIGFuZCBpbiB0aGUgYnJvd3Nlci5cbiAgZnVuY3Rpb24gaW5oZXJpdHMoY3Rvciwgc3VwZXJDdG9yKSB7XG4gICAgY3Rvci5zdXBlcl8gPSBzdXBlckN0b3I7XG4gICAgY3Rvci5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ3Rvci5wcm90b3R5cGUsIHtcbiAgICAgIGNvbnN0cnVjdG9yOiB7XG4gICAgICAgIHZhbHVlOiBjdG9yLFxuICAgICAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gRGlmZihraW5kLCBwYXRoKSB7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdraW5kJywge1xuICAgICAgdmFsdWU6IGtpbmQsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgaWYgKHBhdGggJiYgcGF0aC5sZW5ndGgpIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAncGF0aCcsIHtcbiAgICAgICAgdmFsdWU6IHBhdGgsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIERpZmZFZGl0KHBhdGgsIG9yaWdpbiwgdmFsdWUpIHtcbiAgICBEaWZmRWRpdC5zdXBlcl8uY2FsbCh0aGlzLCAnRScsIHBhdGgpO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbGhzJywge1xuICAgICAgdmFsdWU6IG9yaWdpbixcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3JocycsIHtcbiAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgfVxuICBpbmhlcml0cyhEaWZmRWRpdCwgRGlmZik7XG5cbiAgZnVuY3Rpb24gRGlmZk5ldyhwYXRoLCB2YWx1ZSkge1xuICAgIERpZmZOZXcuc3VwZXJfLmNhbGwodGhpcywgJ04nLCBwYXRoKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3JocycsIHtcbiAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgfVxuICBpbmhlcml0cyhEaWZmTmV3LCBEaWZmKTtcblxuICBmdW5jdGlvbiBEaWZmRGVsZXRlZChwYXRoLCB2YWx1ZSkge1xuICAgIERpZmZEZWxldGVkLnN1cGVyXy5jYWxsKHRoaXMsICdEJywgcGF0aCk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdsaHMnLCB7XG4gICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH1cbiAgaW5oZXJpdHMoRGlmZkRlbGV0ZWQsIERpZmYpO1xuXG4gIGZ1bmN0aW9uIERpZmZBcnJheShwYXRoLCBpbmRleCwgaXRlbSkge1xuICAgIERpZmZBcnJheS5zdXBlcl8uY2FsbCh0aGlzLCAnQScsIHBhdGgpO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaW5kZXgnLCB7XG4gICAgICB2YWx1ZTogaW5kZXgsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpdGVtJywge1xuICAgICAgdmFsdWU6IGl0ZW0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH1cbiAgaW5oZXJpdHMoRGlmZkFycmF5LCBEaWZmKTtcblxuICBmdW5jdGlvbiBhcnJheVJlbW92ZShhcnIsIGZyb20sIHRvKSB7XG4gICAgdmFyIHJlc3QgPSBhcnIuc2xpY2UoKHRvIHx8IGZyb20pICsgMSB8fCBhcnIubGVuZ3RoKTtcbiAgICBhcnIubGVuZ3RoID0gZnJvbSA8IDAgPyBhcnIubGVuZ3RoICsgZnJvbSA6IGZyb207XG4gICAgYXJyLnB1c2guYXBwbHkoYXJyLCByZXN0KTtcbiAgICByZXR1cm4gYXJyO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhbFR5cGVPZihzdWJqZWN0KSB7XG4gICAgdmFyIHR5cGUgPSB0eXBlb2Ygc3ViamVjdDtcbiAgICBpZiAodHlwZSAhPT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiB0eXBlO1xuICAgIH1cblxuICAgIGlmIChzdWJqZWN0ID09PSBNYXRoKSB7XG4gICAgICByZXR1cm4gJ21hdGgnO1xuICAgIH0gZWxzZSBpZiAoc3ViamVjdCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuICdudWxsJztcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoc3ViamVjdCkpIHtcbiAgICAgIHJldHVybiAnYXJyYXknO1xuICAgIH0gZWxzZSBpZiAoc3ViamVjdCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgIHJldHVybiAnZGF0ZSc7XG4gICAgfSBlbHNlIGlmICgvXlxcLy4qXFwvLy50ZXN0KHN1YmplY3QudG9TdHJpbmcoKSkpIHtcbiAgICAgIHJldHVybiAncmVnZXhwJztcbiAgICB9XG4gICAgcmV0dXJuICdvYmplY3QnO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVlcERpZmYobGhzLCByaHMsIGNoYW5nZXMsIHByZWZpbHRlciwgcGF0aCwga2V5LCBzdGFjaykge1xuICAgIHBhdGggPSBwYXRoIHx8IFtdO1xuICAgIHZhciBjdXJyZW50UGF0aCA9IHBhdGguc2xpY2UoMCk7XG4gICAgaWYgKHR5cGVvZiBrZXkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBpZiAocHJlZmlsdGVyICYmIHByZWZpbHRlcihjdXJyZW50UGF0aCwga2V5LCB7IGxoczogbGhzLCByaHM6IHJocyB9KSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjdXJyZW50UGF0aC5wdXNoKGtleSk7XG4gICAgfVxuICAgIHZhciBsdHlwZSA9IHR5cGVvZiBsaHM7XG4gICAgdmFyIHJ0eXBlID0gdHlwZW9mIHJocztcbiAgICBpZiAobHR5cGUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBpZiAocnR5cGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGNoYW5nZXMobmV3IERpZmZOZXcoY3VycmVudFBhdGgsIHJocykpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocnR5cGUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICBjaGFuZ2VzKG5ldyBEaWZmRGVsZXRlZChjdXJyZW50UGF0aCwgbGhzKSk7XG4gICAgfSBlbHNlIGlmIChyZWFsVHlwZU9mKGxocykgIT09IHJlYWxUeXBlT2YocmhzKSkge1xuICAgICAgY2hhbmdlcyhuZXcgRGlmZkVkaXQoY3VycmVudFBhdGgsIGxocywgcmhzKSk7XG4gICAgfSBlbHNlIGlmIChsaHMgaW5zdGFuY2VvZiBEYXRlICYmIHJocyBpbnN0YW5jZW9mIERhdGUgJiYgKChsaHMgLSByaHMpICE9PSAwKSkge1xuICAgICAgY2hhbmdlcyhuZXcgRGlmZkVkaXQoY3VycmVudFBhdGgsIGxocywgcmhzKSk7XG4gICAgfSBlbHNlIGlmIChsdHlwZSA9PT0gJ29iamVjdCcgJiYgbGhzICE9PSBudWxsICYmIHJocyAhPT0gbnVsbCkge1xuICAgICAgc3RhY2sgPSBzdGFjayB8fCBbXTtcbiAgICAgIGlmIChzdGFjay5pbmRleE9mKGxocykgPCAwKSB7XG4gICAgICAgIHN0YWNrLnB1c2gobGhzKTtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkobGhzKSkge1xuICAgICAgICAgIHZhciBpLCBsZW4gPSBsaHMubGVuZ3RoO1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBsaHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChpID49IHJocy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgY2hhbmdlcyhuZXcgRGlmZkFycmF5KGN1cnJlbnRQYXRoLCBpLCBuZXcgRGlmZkRlbGV0ZWQodW5kZWZpbmVkLCBsaHNbaV0pKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBkZWVwRGlmZihsaHNbaV0sIHJoc1tpXSwgY2hhbmdlcywgcHJlZmlsdGVyLCBjdXJyZW50UGF0aCwgaSwgc3RhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICB3aGlsZSAoaSA8IHJocy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNoYW5nZXMobmV3IERpZmZBcnJheShjdXJyZW50UGF0aCwgaSwgbmV3IERpZmZOZXcodW5kZWZpbmVkLCByaHNbaSsrXSkpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGFrZXlzID0gT2JqZWN0LmtleXMobGhzKTtcbiAgICAgICAgICB2YXIgcGtleXMgPSBPYmplY3Qua2V5cyhyaHMpO1xuICAgICAgICAgIGFrZXlzLmZvckVhY2goZnVuY3Rpb24oaywgaSkge1xuICAgICAgICAgICAgdmFyIG90aGVyID0gcGtleXMuaW5kZXhPZihrKTtcbiAgICAgICAgICAgIGlmIChvdGhlciA+PSAwKSB7XG4gICAgICAgICAgICAgIGRlZXBEaWZmKGxoc1trXSwgcmhzW2tdLCBjaGFuZ2VzLCBwcmVmaWx0ZXIsIGN1cnJlbnRQYXRoLCBrLCBzdGFjayk7XG4gICAgICAgICAgICAgIHBrZXlzID0gYXJyYXlSZW1vdmUocGtleXMsIG90aGVyKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGRlZXBEaWZmKGxoc1trXSwgdW5kZWZpbmVkLCBjaGFuZ2VzLCBwcmVmaWx0ZXIsIGN1cnJlbnRQYXRoLCBrLCBzdGFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcGtleXMuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICAgICAgICBkZWVwRGlmZih1bmRlZmluZWQsIHJoc1trXSwgY2hhbmdlcywgcHJlZmlsdGVyLCBjdXJyZW50UGF0aCwgaywgc3RhY2spO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHN0YWNrLmxlbmd0aCA9IHN0YWNrLmxlbmd0aCAtIDE7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChsaHMgIT09IHJocykge1xuICAgICAgaWYgKCEobHR5cGUgPT09ICdudW1iZXInICYmIGlzTmFOKGxocykgJiYgaXNOYU4ocmhzKSkpIHtcbiAgICAgICAgY2hhbmdlcyhuZXcgRGlmZkVkaXQoY3VycmVudFBhdGgsIGxocywgcmhzKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYWNjdW11bGF0ZURpZmYobGhzLCByaHMsIHByZWZpbHRlciwgYWNjdW0pIHtcbiAgICBhY2N1bSA9IGFjY3VtIHx8IFtdO1xuICAgIGRlZXBEaWZmKGxocywgcmhzLFxuICAgICAgZnVuY3Rpb24oZGlmZikge1xuICAgICAgICBpZiAoZGlmZikge1xuICAgICAgICAgIGFjY3VtLnB1c2goZGlmZik7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBwcmVmaWx0ZXIpO1xuICAgIHJldHVybiAoYWNjdW0ubGVuZ3RoKSA/IGFjY3VtIDogdW5kZWZpbmVkO1xuICB9XG5cbiAgZnVuY3Rpb24gYXBwbHlBcnJheUNoYW5nZShhcnIsIGluZGV4LCBjaGFuZ2UpIHtcbiAgICBpZiAoY2hhbmdlLnBhdGggJiYgY2hhbmdlLnBhdGgubGVuZ3RoKSB7XG4gICAgICB2YXIgaXQgPSBhcnJbaW5kZXhdLFxuICAgICAgICBpLCB1ID0gY2hhbmdlLnBhdGgubGVuZ3RoIC0gMTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCB1OyBpKyspIHtcbiAgICAgICAgaXQgPSBpdFtjaGFuZ2UucGF0aFtpXV07XG4gICAgICB9XG4gICAgICBzd2l0Y2ggKGNoYW5nZS5raW5kKSB7XG4gICAgICAgIGNhc2UgJ0EnOlxuICAgICAgICAgIGFwcGx5QXJyYXlDaGFuZ2UoaXRbY2hhbmdlLnBhdGhbaV1dLCBjaGFuZ2UuaW5kZXgsIGNoYW5nZS5pdGVtKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRCc6XG4gICAgICAgICAgZGVsZXRlIGl0W2NoYW5nZS5wYXRoW2ldXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRSc6XG4gICAgICAgIGNhc2UgJ04nOlxuICAgICAgICAgIGl0W2NoYW5nZS5wYXRoW2ldXSA9IGNoYW5nZS5yaHM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN3aXRjaCAoY2hhbmdlLmtpbmQpIHtcbiAgICAgICAgY2FzZSAnQSc6XG4gICAgICAgICAgYXBwbHlBcnJheUNoYW5nZShhcnJbaW5kZXhdLCBjaGFuZ2UuaW5kZXgsIGNoYW5nZS5pdGVtKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRCc6XG4gICAgICAgICAgYXJyID0gYXJyYXlSZW1vdmUoYXJyLCBpbmRleCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0UnOlxuICAgICAgICBjYXNlICdOJzpcbiAgICAgICAgICBhcnJbaW5kZXhdID0gY2hhbmdlLnJocztcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFycjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFwcGx5Q2hhbmdlKHRhcmdldCwgc291cmNlLCBjaGFuZ2UpIHtcbiAgICBpZiAodGFyZ2V0ICYmIHNvdXJjZSAmJiBjaGFuZ2UgJiYgY2hhbmdlLmtpbmQpIHtcbiAgICAgIHZhciBpdCA9IHRhcmdldCxcbiAgICAgICAgaSA9IC0xLFxuICAgICAgICBsYXN0ID0gY2hhbmdlLnBhdGggPyBjaGFuZ2UucGF0aC5sZW5ndGggLSAxIDogMDtcbiAgICAgIHdoaWxlICgrK2kgPCBsYXN0KSB7XG4gICAgICAgIGlmICh0eXBlb2YgaXRbY2hhbmdlLnBhdGhbaV1dID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGl0W2NoYW5nZS5wYXRoW2ldXSA9ICh0eXBlb2YgY2hhbmdlLnBhdGhbaV0gPT09ICdudW1iZXInKSA/IFtdIDoge307XG4gICAgICAgIH1cbiAgICAgICAgaXQgPSBpdFtjaGFuZ2UucGF0aFtpXV07XG4gICAgICB9XG4gICAgICBzd2l0Y2ggKGNoYW5nZS5raW5kKSB7XG4gICAgICAgIGNhc2UgJ0EnOlxuICAgICAgICAgIGFwcGx5QXJyYXlDaGFuZ2UoY2hhbmdlLnBhdGggPyBpdFtjaGFuZ2UucGF0aFtpXV0gOiBpdCwgY2hhbmdlLmluZGV4LCBjaGFuZ2UuaXRlbSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0QnOlxuICAgICAgICAgIGRlbGV0ZSBpdFtjaGFuZ2UucGF0aFtpXV07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0UnOlxuICAgICAgICBjYXNlICdOJzpcbiAgICAgICAgICBpdFtjaGFuZ2UucGF0aFtpXV0gPSBjaGFuZ2UucmhzO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJldmVydEFycmF5Q2hhbmdlKGFyciwgaW5kZXgsIGNoYW5nZSkge1xuICAgIGlmIChjaGFuZ2UucGF0aCAmJiBjaGFuZ2UucGF0aC5sZW5ndGgpIHtcbiAgICAgIC8vIHRoZSBzdHJ1Y3R1cmUgb2YgdGhlIG9iamVjdCBhdCB0aGUgaW5kZXggaGFzIGNoYW5nZWQuLi5cbiAgICAgIHZhciBpdCA9IGFycltpbmRleF0sXG4gICAgICAgIGksIHUgPSBjaGFuZ2UucGF0aC5sZW5ndGggLSAxO1xuICAgICAgZm9yIChpID0gMDsgaSA8IHU7IGkrKykge1xuICAgICAgICBpdCA9IGl0W2NoYW5nZS5wYXRoW2ldXTtcbiAgICAgIH1cbiAgICAgIHN3aXRjaCAoY2hhbmdlLmtpbmQpIHtcbiAgICAgICAgY2FzZSAnQSc6XG4gICAgICAgICAgcmV2ZXJ0QXJyYXlDaGFuZ2UoaXRbY2hhbmdlLnBhdGhbaV1dLCBjaGFuZ2UuaW5kZXgsIGNoYW5nZS5pdGVtKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRCc6XG4gICAgICAgICAgaXRbY2hhbmdlLnBhdGhbaV1dID0gY2hhbmdlLmxocztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRSc6XG4gICAgICAgICAgaXRbY2hhbmdlLnBhdGhbaV1dID0gY2hhbmdlLmxocztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnTic6XG4gICAgICAgICAgZGVsZXRlIGl0W2NoYW5nZS5wYXRoW2ldXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gdGhlIGFycmF5IGl0ZW0gaXMgZGlmZmVyZW50Li4uXG4gICAgICBzd2l0Y2ggKGNoYW5nZS5raW5kKSB7XG4gICAgICAgIGNhc2UgJ0EnOlxuICAgICAgICAgIHJldmVydEFycmF5Q2hhbmdlKGFycltpbmRleF0sIGNoYW5nZS5pbmRleCwgY2hhbmdlLml0ZW0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdEJzpcbiAgICAgICAgICBhcnJbaW5kZXhdID0gY2hhbmdlLmxocztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRSc6XG4gICAgICAgICAgYXJyW2luZGV4XSA9IGNoYW5nZS5saHM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ04nOlxuICAgICAgICAgIGFyciA9IGFycmF5UmVtb3ZlKGFyciwgaW5kZXgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXJyO1xuICB9XG5cbiAgZnVuY3Rpb24gcmV2ZXJ0Q2hhbmdlKHRhcmdldCwgc291cmNlLCBjaGFuZ2UpIHtcbiAgICBpZiAodGFyZ2V0ICYmIHNvdXJjZSAmJiBjaGFuZ2UgJiYgY2hhbmdlLmtpbmQpIHtcbiAgICAgIHZhciBpdCA9IHRhcmdldCxcbiAgICAgICAgaSwgdTtcbiAgICAgIHUgPSBjaGFuZ2UucGF0aC5sZW5ndGggLSAxO1xuICAgICAgZm9yIChpID0gMDsgaSA8IHU7IGkrKykge1xuICAgICAgICBpZiAodHlwZW9mIGl0W2NoYW5nZS5wYXRoW2ldXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBpdFtjaGFuZ2UucGF0aFtpXV0gPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpdCA9IGl0W2NoYW5nZS5wYXRoW2ldXTtcbiAgICAgIH1cbiAgICAgIHN3aXRjaCAoY2hhbmdlLmtpbmQpIHtcbiAgICAgICAgY2FzZSAnQSc6XG4gICAgICAgICAgLy8gQXJyYXkgd2FzIG1vZGlmaWVkLi4uXG4gICAgICAgICAgLy8gaXQgd2lsbCBiZSBhbiBhcnJheS4uLlxuICAgICAgICAgIHJldmVydEFycmF5Q2hhbmdlKGl0W2NoYW5nZS5wYXRoW2ldXSwgY2hhbmdlLmluZGV4LCBjaGFuZ2UuaXRlbSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0QnOlxuICAgICAgICAgIC8vIEl0ZW0gd2FzIGRlbGV0ZWQuLi5cbiAgICAgICAgICBpdFtjaGFuZ2UucGF0aFtpXV0gPSBjaGFuZ2UubGhzO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFJzpcbiAgICAgICAgICAvLyBJdGVtIHdhcyBlZGl0ZWQuLi5cbiAgICAgICAgICBpdFtjaGFuZ2UucGF0aFtpXV0gPSBjaGFuZ2UubGhzO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdOJzpcbiAgICAgICAgICAvLyBJdGVtIGlzIG5ldy4uLlxuICAgICAgICAgIGRlbGV0ZSBpdFtjaGFuZ2UucGF0aFtpXV07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYXBwbHlEaWZmKHRhcmdldCwgc291cmNlLCBmaWx0ZXIpIHtcbiAgICBpZiAodGFyZ2V0ICYmIHNvdXJjZSkge1xuICAgICAgdmFyIG9uQ2hhbmdlID0gZnVuY3Rpb24oY2hhbmdlKSB7XG4gICAgICAgIGlmICghZmlsdGVyIHx8IGZpbHRlcih0YXJnZXQsIHNvdXJjZSwgY2hhbmdlKSkge1xuICAgICAgICAgIGFwcGx5Q2hhbmdlKHRhcmdldCwgc291cmNlLCBjaGFuZ2UpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgZGVlcERpZmYodGFyZ2V0LCBzb3VyY2UsIG9uQ2hhbmdlKTtcbiAgICB9XG4gIH1cblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyhhY2N1bXVsYXRlRGlmZiwge1xuXG4gICAgZGlmZjoge1xuICAgICAgdmFsdWU6IGFjY3VtdWxhdGVEaWZmLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgb2JzZXJ2YWJsZURpZmY6IHtcbiAgICAgIHZhbHVlOiBkZWVwRGlmZixcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIGFwcGx5RGlmZjoge1xuICAgICAgdmFsdWU6IGFwcGx5RGlmZixcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIGFwcGx5Q2hhbmdlOiB7XG4gICAgICB2YWx1ZTogYXBwbHlDaGFuZ2UsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICByZXZlcnRDaGFuZ2U6IHtcbiAgICAgIHZhbHVlOiByZXZlcnRDaGFuZ2UsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBpc0NvbmZsaWN0OiB7XG4gICAgICB2YWx1ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIGNvbmZsaWN0O1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIG5vQ29uZmxpY3Q6IHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKGNvbmZsaWN0UmVzb2x1dGlvbikge1xuICAgICAgICAgIGNvbmZsaWN0UmVzb2x1dGlvbi5mb3JFYWNoKGZ1bmN0aW9uKGl0KSB7XG4gICAgICAgICAgICBpdCgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGNvbmZsaWN0UmVzb2x1dGlvbiA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGFjY3VtdWxhdGVEaWZmO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBhY2N1bXVsYXRlRGlmZjtcbn0pKTtcbiIsIi8qIVxyXG4gKiBAbmFtZSBKYXZhU2NyaXB0L05vZGVKUyBNZXJnZSB2MS4yLjBcclxuICogQGF1dGhvciB5ZWlrb3NcclxuICogQHJlcG9zaXRvcnkgaHR0cHM6Ly9naXRodWIuY29tL3llaWtvcy9qcy5tZXJnZVxyXG5cclxuICogQ29weXJpZ2h0IDIwMTQgeWVpa29zIC0gTUlUIGxpY2Vuc2VcclxuICogaHR0cHM6Ly9yYXcuZ2l0aHViLmNvbS95ZWlrb3MvanMubWVyZ2UvbWFzdGVyL0xJQ0VOU0VcclxuICovXHJcblxyXG47KGZ1bmN0aW9uKGlzTm9kZSkge1xyXG5cclxuXHQvKipcclxuXHQgKiBNZXJnZSBvbmUgb3IgbW9yZSBvYmplY3RzIFxyXG5cdCAqIEBwYXJhbSBib29sPyBjbG9uZVxyXG5cdCAqIEBwYXJhbSBtaXhlZCwuLi4gYXJndW1lbnRzXHJcblx0ICogQHJldHVybiBvYmplY3RcclxuXHQgKi9cclxuXHJcblx0dmFyIFB1YmxpYyA9IGZ1bmN0aW9uKGNsb25lKSB7XHJcblxyXG5cdFx0cmV0dXJuIG1lcmdlKGNsb25lID09PSB0cnVlLCBmYWxzZSwgYXJndW1lbnRzKTtcclxuXHJcblx0fSwgcHVibGljTmFtZSA9ICdtZXJnZSc7XHJcblxyXG5cdC8qKlxyXG5cdCAqIE1lcmdlIHR3byBvciBtb3JlIG9iamVjdHMgcmVjdXJzaXZlbHkgXHJcblx0ICogQHBhcmFtIGJvb2w/IGNsb25lXHJcblx0ICogQHBhcmFtIG1peGVkLC4uLiBhcmd1bWVudHNcclxuXHQgKiBAcmV0dXJuIG9iamVjdFxyXG5cdCAqL1xyXG5cclxuXHRQdWJsaWMucmVjdXJzaXZlID0gZnVuY3Rpb24oY2xvbmUpIHtcclxuXHJcblx0XHRyZXR1cm4gbWVyZ2UoY2xvbmUgPT09IHRydWUsIHRydWUsIGFyZ3VtZW50cyk7XHJcblxyXG5cdH07XHJcblxyXG5cdC8qKlxyXG5cdCAqIENsb25lIHRoZSBpbnB1dCByZW1vdmluZyBhbnkgcmVmZXJlbmNlXHJcblx0ICogQHBhcmFtIG1peGVkIGlucHV0XHJcblx0ICogQHJldHVybiBtaXhlZFxyXG5cdCAqL1xyXG5cclxuXHRQdWJsaWMuY2xvbmUgPSBmdW5jdGlvbihpbnB1dCkge1xyXG5cclxuXHRcdHZhciBvdXRwdXQgPSBpbnB1dCxcclxuXHRcdFx0dHlwZSA9IHR5cGVPZihpbnB1dCksXHJcblx0XHRcdGluZGV4LCBzaXplO1xyXG5cclxuXHRcdGlmICh0eXBlID09PSAnYXJyYXknKSB7XHJcblxyXG5cdFx0XHRvdXRwdXQgPSBbXTtcclxuXHRcdFx0c2l6ZSA9IGlucHV0Lmxlbmd0aDtcclxuXHJcblx0XHRcdGZvciAoaW5kZXg9MDtpbmRleDxzaXplOysraW5kZXgpXHJcblxyXG5cdFx0XHRcdG91dHB1dFtpbmRleF0gPSBQdWJsaWMuY2xvbmUoaW5wdXRbaW5kZXhdKTtcclxuXHJcblx0XHR9IGVsc2UgaWYgKHR5cGUgPT09ICdvYmplY3QnKSB7XHJcblxyXG5cdFx0XHRvdXRwdXQgPSB7fTtcclxuXHJcblx0XHRcdGZvciAoaW5kZXggaW4gaW5wdXQpXHJcblxyXG5cdFx0XHRcdG91dHB1dFtpbmRleF0gPSBQdWJsaWMuY2xvbmUoaW5wdXRbaW5kZXhdKTtcclxuXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIG91dHB1dDtcclxuXHJcblx0fTtcclxuXHJcblx0LyoqXHJcblx0ICogTWVyZ2UgdHdvIG9iamVjdHMgcmVjdXJzaXZlbHlcclxuXHQgKiBAcGFyYW0gbWl4ZWQgaW5wdXRcclxuXHQgKiBAcGFyYW0gbWl4ZWQgZXh0ZW5kXHJcblx0ICogQHJldHVybiBtaXhlZFxyXG5cdCAqL1xyXG5cclxuXHRmdW5jdGlvbiBtZXJnZV9yZWN1cnNpdmUoYmFzZSwgZXh0ZW5kKSB7XHJcblxyXG5cdFx0aWYgKHR5cGVPZihiYXNlKSAhPT0gJ29iamVjdCcpXHJcblxyXG5cdFx0XHRyZXR1cm4gZXh0ZW5kO1xyXG5cclxuXHRcdGZvciAodmFyIGtleSBpbiBleHRlbmQpIHtcclxuXHJcblx0XHRcdGlmICh0eXBlT2YoYmFzZVtrZXldKSA9PT0gJ29iamVjdCcgJiYgdHlwZU9mKGV4dGVuZFtrZXldKSA9PT0gJ29iamVjdCcpIHtcclxuXHJcblx0XHRcdFx0YmFzZVtrZXldID0gbWVyZ2VfcmVjdXJzaXZlKGJhc2Vba2V5XSwgZXh0ZW5kW2tleV0pO1xyXG5cclxuXHRcdFx0fSBlbHNlIHtcclxuXHJcblx0XHRcdFx0YmFzZVtrZXldID0gZXh0ZW5kW2tleV07XHJcblxyXG5cdFx0XHR9XHJcblxyXG5cdFx0fVxyXG5cclxuXHRcdHJldHVybiBiYXNlO1xyXG5cclxuXHR9XHJcblxyXG5cdC8qKlxyXG5cdCAqIE1lcmdlIHR3byBvciBtb3JlIG9iamVjdHNcclxuXHQgKiBAcGFyYW0gYm9vbCBjbG9uZVxyXG5cdCAqIEBwYXJhbSBib29sIHJlY3Vyc2l2ZVxyXG5cdCAqIEBwYXJhbSBhcnJheSBhcmd2XHJcblx0ICogQHJldHVybiBvYmplY3RcclxuXHQgKi9cclxuXHJcblx0ZnVuY3Rpb24gbWVyZ2UoY2xvbmUsIHJlY3Vyc2l2ZSwgYXJndikge1xyXG5cclxuXHRcdHZhciByZXN1bHQgPSBhcmd2WzBdLFxyXG5cdFx0XHRzaXplID0gYXJndi5sZW5ndGg7XHJcblxyXG5cdFx0aWYgKGNsb25lIHx8IHR5cGVPZihyZXN1bHQpICE9PSAnb2JqZWN0JylcclxuXHJcblx0XHRcdHJlc3VsdCA9IHt9O1xyXG5cclxuXHRcdGZvciAodmFyIGluZGV4PTA7aW5kZXg8c2l6ZTsrK2luZGV4KSB7XHJcblxyXG5cdFx0XHR2YXIgaXRlbSA9IGFyZ3ZbaW5kZXhdLFxyXG5cclxuXHRcdFx0XHR0eXBlID0gdHlwZU9mKGl0ZW0pO1xyXG5cclxuXHRcdFx0aWYgKHR5cGUgIT09ICdvYmplY3QnKSBjb250aW51ZTtcclxuXHJcblx0XHRcdGZvciAodmFyIGtleSBpbiBpdGVtKSB7XHJcblxyXG5cdFx0XHRcdHZhciBzaXRlbSA9IGNsb25lID8gUHVibGljLmNsb25lKGl0ZW1ba2V5XSkgOiBpdGVtW2tleV07XHJcblxyXG5cdFx0XHRcdGlmIChyZWN1cnNpdmUpIHtcclxuXHJcblx0XHRcdFx0XHRyZXN1bHRba2V5XSA9IG1lcmdlX3JlY3Vyc2l2ZShyZXN1bHRba2V5XSwgc2l0ZW0pO1xyXG5cclxuXHRcdFx0XHR9IGVsc2Uge1xyXG5cclxuXHRcdFx0XHRcdHJlc3VsdFtrZXldID0gc2l0ZW07XHJcblxyXG5cdFx0XHRcdH1cclxuXHJcblx0XHRcdH1cclxuXHJcblx0XHR9XHJcblxyXG5cdFx0cmV0dXJuIHJlc3VsdDtcclxuXHJcblx0fVxyXG5cclxuXHQvKipcclxuXHQgKiBHZXQgdHlwZSBvZiB2YXJpYWJsZVxyXG5cdCAqIEBwYXJhbSBtaXhlZCBpbnB1dFxyXG5cdCAqIEByZXR1cm4gc3RyaW5nXHJcblx0ICpcclxuXHQgKiBAc2VlIGh0dHA6Ly9qc3BlcmYuY29tL3R5cGVvZnZhclxyXG5cdCAqL1xyXG5cclxuXHRmdW5jdGlvbiB0eXBlT2YoaW5wdXQpIHtcclxuXHJcblx0XHRyZXR1cm4gKHt9KS50b1N0cmluZy5jYWxsKGlucHV0KS5zbGljZSg4LCAtMSkudG9Mb3dlckNhc2UoKTtcclxuXHJcblx0fVxyXG5cclxuXHRpZiAoaXNOb2RlKSB7XHJcblxyXG5cdFx0bW9kdWxlLmV4cG9ydHMgPSBQdWJsaWM7XHJcblxyXG5cdH0gZWxzZSB7XHJcblxyXG5cdFx0d2luZG93W3B1YmxpY05hbWVdID0gUHVibGljO1xyXG5cclxuXHR9XHJcblxyXG59KSh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUgJiYgdHlwZW9mIG1vZHVsZS5leHBvcnRzID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cyk7IiwidmFyIHBsYWNlaG9sZGVyID0ge30sXG4gICAgZW5kT2ZBcmdzID0ge30sXG4gICAgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbC5iaW5kKEFycmF5LnByb3RvdHlwZS5zbGljZSk7XG5cbmZ1bmN0aW9uIHNodXYoZm4pe1xuICAgIHZhciBvdXRlckFyZ3MgPSBzbGljZShhcmd1bWVudHMsIDEpO1xuXG4gICAgaWYodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBvciBub24tZnVuY3Rpb24gcGFzc2VkIHRvIHNodXYnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIGNvbnRleHQgPSB0aGlzLFxuICAgICAgICAgICAgaW5uZXJBcmdzID0gc2xpY2UoYXJndW1lbnRzKSxcbiAgICAgICAgICAgIGZpbmFsQXJncyA9IFtdLFxuICAgICAgICAgICAgYXBwZW5kID0gdHJ1ZTtcblxuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgb3V0ZXJBcmdzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIHZhciBvdXRlckFyZyA9IG91dGVyQXJnc1tpXTtcblxuICAgICAgICAgICAgaWYob3V0ZXJBcmcgPT09IGVuZE9mQXJncyl7XG4gICAgICAgICAgICAgICAgYXBwZW5kID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKG91dGVyQXJnID09PSBwbGFjZWhvbGRlcil7XG4gICAgICAgICAgICAgICAgZmluYWxBcmdzLnB1c2goaW5uZXJBcmdzLnNoaWZ0KCkpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmaW5hbEFyZ3MucHVzaChvdXRlckFyZyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihhcHBlbmQpe1xuICAgICAgICAgICAgZmluYWxBcmdzID0gZmluYWxBcmdzLmNvbmNhdChpbm5lckFyZ3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZuLmFwcGx5KGNvbnRleHQsIGZpbmFsQXJncyk7XG4gICAgfTtcbn1cblxuc2h1di5fID0gcGxhY2Vob2xkZXI7XG5zaHV2LiQgPSBlbmRPZkFyZ3M7XG5cbm1vZHVsZS5leHBvcnRzID0gc2h1djsiLCJ2YXIgcmV2aXZlID0gcmVxdWlyZSgnLi9yZXZpdmUnKTtcblxuZnVuY3Rpb24gcGFyc2UoanNvbiwgcmV2aXZlcil7XG4gICAgcmV0dXJuIHJldml2ZShKU09OLnBhcnNlKGpzb24sIHJldml2ZXIpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBwYXJzZTsiLCJ2YXIgY3JlYXRlS2V5ID0gcmVxdWlyZSgnLi9jcmVhdGVLZXknKSxcbiAgICBrZXlLZXkgPSBjcmVhdGVLZXkoLTEpO1xuXG5mdW5jdGlvbiByZXZpdmUoaW5wdXQpe1xuICAgIHZhciBvYmplY3RzID0ge30sXG4gICAgICAgIHNjYW5uZWRPYmplY3RzID0gW107XG5cbiAgICBmdW5jdGlvbiBzY2FuKGlucHV0KXtcbiAgICAgICAgdmFyIG91dHB1dCA9IGlucHV0O1xuXG4gICAgICAgIGlmKHR5cGVvZiBvdXRwdXQgIT09ICdvYmplY3QnKXtcbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgIH1cblxuICAgICAgICBvdXRwdXQgPSBpbnB1dCBpbnN0YW5jZW9mIEFycmF5ID8gW10gOiB7fTtcblxuICAgICAgICBpZihpbnB1dFtrZXlLZXldKXtcbiAgICAgICAgICAgIG9iamVjdHNbaW5wdXRba2V5S2V5XV0gPSBvdXRwdXQ7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IodmFyIGtleSBpbiBpbnB1dCl7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBpbnB1dFtrZXldO1xuXG4gICAgICAgICAgICBpZihrZXkgPT09IGtleUtleSl7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHZhbHVlICE9IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jyl7XG4gICAgICAgICAgICAgICAgaWYoc2Nhbm5lZE9iamVjdHMuaW5kZXhPZih2YWx1ZSk8MCl7XG4gICAgICAgICAgICAgICAgICAgIHNjYW5uZWRPYmplY3RzLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXRba2V5XSA9IHNjYW4odmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1lbHNlIGlmKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUubGVuZ3RoID09PSAxICYmIHZhbHVlLmNoYXJDb2RlQXQoMCkgPiBrZXlLZXkuY2hhckNvZGVBdCgwKSl7XG4gICAgICAgICAgICAgICAgb3V0cHV0W2tleV0gPSBvYmplY3RzW3ZhbHVlXSB8fCBpbnB1dFtrZXldO1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgb3V0cHV0W2tleV0gPSBpbnB1dFtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuXG4gICAgaWYoIWlucHV0IHx8IHR5cGVvZiBpbnB1dCAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm4gaW5wdXQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNjYW4oaW5wdXQpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJldml2ZTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBzdHJpbmdpZnk6IHJlcXVpcmUoJy4vc3RyaW5naWZ5JyksXG4gICAgcGFyc2U6IHJlcXVpcmUoJy4vcGFyc2UnKSxcbiAgICByZXZpdmU6IHJlcXVpcmUoJy4vcmV2aXZlJylcbn07IiwidmFyIGNyZWF0ZUtleSA9IHJlcXVpcmUoJy4vY3JlYXRlS2V5JyksXG4gICAga2V5S2V5ID0gY3JlYXRlS2V5KC0xKTtcblxuZnVuY3Rpb24gdG9Kc29uVmFsdWUodmFsdWUpe1xuICAgIGlmKHZhbHVlICE9IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jyl7XG4gICAgICAgIHZhciByZXN1bHQgPSB2YWx1ZSBpbnN0YW5jZW9mIEFycmF5ID8gW10gOiB7fSxcbiAgICAgICAgICAgIG91dHB1dCA9IHZhbHVlO1xuICAgICAgICBpZigndG9KU09OJyBpbiB2YWx1ZSl7XG4gICAgICAgICAgICBvdXRwdXQgPSB2YWx1ZS50b0pTT04oKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IodmFyIGtleSBpbiBvdXRwdXQpe1xuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBvdXRwdXRba2V5XTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5KGlucHV0LCByZXBsYWNlciwgc3BhY2VyKXtcbiAgICB2YXIgb2JqZWN0cyA9IFtdLFxuICAgICAgICBvdXRwdXRPYmplY3RzID0gW10sXG4gICAgICAgIHJlZnMgPSBbXTtcblxuICAgIGZ1bmN0aW9uIHNjYW4oaW5wdXQpe1xuXG4gICAgICAgIGlmKGlucHV0ID09PSBudWxsIHx8IHR5cGVvZiBpbnB1dCAhPT0gJ29iamVjdCcpe1xuICAgICAgICAgICAgcmV0dXJuIGlucHV0O1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG91dHB1dCxcbiAgICAgICAgICAgIGluZGV4ID0gb2JqZWN0cy5pbmRleE9mKGlucHV0KTtcblxuICAgICAgICBpZihpbmRleCA+PSAwKXtcbiAgICAgICAgICAgIG91dHB1dE9iamVjdHNbaW5kZXhdW2tleUtleV0gPSByZWZzW2luZGV4XVxuICAgICAgICAgICAgcmV0dXJuIHJlZnNbaW5kZXhdO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5kZXggPSBvYmplY3RzLmxlbmd0aDtcbiAgICAgICAgb2JqZWN0c1tpbmRleF0gPSBpbnB1dDtcbiAgICAgICAgb3V0cHV0ID0gdG9Kc29uVmFsdWUoaW5wdXQpO1xuICAgICAgICBvdXRwdXRPYmplY3RzW2luZGV4XSA9IG91dHB1dDtcbiAgICAgICAgcmVmc1tpbmRleF0gPSBjcmVhdGVLZXkoaW5kZXgpO1xuXG4gICAgICAgIGZvcih2YXIga2V5IGluIG91dHB1dCl7XG4gICAgICAgICAgICBvdXRwdXRba2V5XSA9IHNjYW4ob3V0cHV0W2tleV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoc2NhbihpbnB1dCksIHJlcGxhY2VyLCBzcGFjZXIpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHN0cmluZ2lmeTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgIHF1ZXJ5U3RyaW5nID0gcmVxdWlyZSgncXVlcnktc3RyaW5nJyk7XG5cbmZ1bmN0aW9uIHRyeVBhcnNlSnNvbihkYXRhKXtcbiAgICB0cnl7XG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKGRhdGEpO1xuICAgIH1jYXRjaChlcnJvcil7XG4gICAgICAgIHJldHVybiBlcnJvcjtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRpbWVvdXQoKXtcbiAgIHRoaXMucmVxdWVzdC5hYm9ydCgpO1xuICAgdGhpcy5lbWl0KCd0aW1lb3V0Jyk7XG59XG5cbmZ1bmN0aW9uIEFqYXgoc2V0dGluZ3Mpe1xuICAgIHZhciBxdWVyeVN0cmluZ0RhdGEsXG4gICAgICAgIGFqYXggPSB0aGlzO1xuXG4gICAgaWYodHlwZW9mIHNldHRpbmdzID09PSAnc3RyaW5nJyl7XG4gICAgICAgIHNldHRpbmdzID0ge1xuICAgICAgICAgICAgdXJsOiBzZXR0aW5nc1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIGlmKHR5cGVvZiBzZXR0aW5ncyAhPT0gJ29iamVjdCcpe1xuICAgICAgICBzZXR0aW5ncyA9IHt9O1xuICAgIH1cblxuICAgIGFqYXguc2V0dGluZ3MgPSBzZXR0aW5ncztcbiAgICBhamF4LnJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICBhamF4LnNldHRpbmdzLm1ldGhvZCA9IGFqYXguc2V0dGluZ3MubWV0aG9kIHx8ICdnZXQnO1xuXG4gICAgaWYoYWpheC5zZXR0aW5ncy5jb3JzKXtcbiAgICAgICAgaWYgKCd3aXRoQ3JlZGVudGlhbHMnIGluIGFqYXgucmVxdWVzdCkge1xuICAgICAgICAgICAgYWpheC5yZXF1ZXN0LndpdGhDcmVkZW50aWFscyA9ICEhc2V0dGluZ3Mud2l0aENyZWRlbnRpYWxzO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBYRG9tYWluUmVxdWVzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIC8vIFhEb21haW5SZXF1ZXN0IG9ubHkgZXhpc3RzIGluIElFLCBhbmQgaXMgSUUncyB3YXkgb2YgbWFraW5nIENPUlMgcmVxdWVzdHMuXG4gICAgICAgICAgICBhamF4LnJlcXVlc3QgPSBuZXcgWERvbWFpblJlcXVlc3QoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSwgQ09SUyBpcyBub3Qgc3VwcG9ydGVkIGJ5IHRoZSBicm93c2VyLlxuICAgICAgICAgICAgYWpheC5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignQ29ycyBpcyBub3Qgc3VwcG9ydGVkIGJ5IHRoaXMgYnJvd3NlcicpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmKGFqYXguc2V0dGluZ3MuY2FjaGUgPT09IGZhbHNlKXtcbiAgICAgICAgYWpheC5zZXR0aW5ncy5kYXRhID0gYWpheC5zZXR0aW5ncy5kYXRhIHx8IHt9O1xuICAgICAgICBhamF4LnNldHRpbmdzLmRhdGEuXyA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgIH1cblxuICAgIGlmKGFqYXguc2V0dGluZ3MubWV0aG9kLnRvTG93ZXJDYXNlKCkgPT09ICdnZXQnICYmIHR5cGVvZiBhamF4LnNldHRpbmdzLmRhdGEgPT09ICdvYmplY3QnKXtcbiAgICAgICAgdmFyIHVybFBhcnRzID0gYWpheC5zZXR0aW5ncy51cmwuc3BsaXQoJz8nKTtcblxuICAgICAgICBxdWVyeVN0cmluZ0RhdGEgPSBxdWVyeVN0cmluZy5wYXJzZSh1cmxQYXJ0c1sxXSk7XG5cbiAgICAgICAgZm9yKHZhciBrZXkgaW4gYWpheC5zZXR0aW5ncy5kYXRhKXtcbiAgICAgICAgICAgIHF1ZXJ5U3RyaW5nRGF0YVtrZXldID0gYWpheC5zZXR0aW5ncy5kYXRhW2tleV07XG4gICAgICAgIH1cblxuICAgICAgICBhamF4LnNldHRpbmdzLnVybCA9IHVybFBhcnRzWzBdICsgJz8nICsgcXVlcnlTdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5U3RyaW5nRGF0YSk7XG4gICAgICAgIGFqYXguc2V0dGluZ3MuZGF0YSA9IG51bGw7XG4gICAgfVxuXG4gICAgYWpheC5yZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ3Byb2dyZXNzJywgZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgICBhamF4LmVtaXQoJ3Byb2dyZXNzJywgZXZlbnQpO1xuICAgIH0sIGZhbHNlKTtcblxuICAgIGFqYXgucmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgICB2YXIgZGF0YSA9IGV2ZW50LnRhcmdldC5yZXNwb25zZVRleHQ7XG5cbiAgICAgICAgaWYoYWpheC5zZXR0aW5ncy5kYXRhVHlwZSAmJiBhamF4LnNldHRpbmdzLmRhdGFUeXBlLnRvTG93ZXJDYXNlKCkgPT09ICdqc29uJyl7XG4gICAgICAgICAgICBpZihkYXRhID09PSAnJyl7XG4gICAgICAgICAgICAgICAgZGF0YSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIGRhdGEgPSB0cnlQYXJzZUpzb24oZGF0YSk7XG4gICAgICAgICAgICAgICAgaWYoZGF0YSBpbnN0YW5jZW9mIEVycm9yKXtcbiAgICAgICAgICAgICAgICAgICAgYWpheC5lbWl0KCdlcnJvcicsIGV2ZW50LCBkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGV2ZW50LnRhcmdldC5zdGF0dXMgPj0gNDAwKXtcbiAgICAgICAgICAgIGFqYXguZW1pdCgnZXJyb3InLCBldmVudCwgZGF0YSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhamF4LmVtaXQoJ3N1Y2Nlc3MnLCBldmVudCwgZGF0YSk7XG4gICAgICAgIH1cblxuICAgIH0sIGZhbHNlKTtcblxuICAgIGFqYXgucmVxdWVzdC5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIGZ1bmN0aW9uKGV2ZW50KXtcbiAgICAgICAgYWpheC5lbWl0KCdlcnJvcicsIGV2ZW50KTtcbiAgICB9LCBmYWxzZSk7XG5cbiAgICBhamF4LnJlcXVlc3QuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCBmdW5jdGlvbihldmVudCl7XG4gICAgICAgIGFqYXguZW1pdCgnZXJyb3InLCBldmVudCwgbmV3IEVycm9yKCdDb25uZWN0aW9uIEFib3J0ZWQnKSk7XG4gICAgICAgIGFqYXguZW1pdCgnYWJvcnQnLCBldmVudCk7XG4gICAgfSwgZmFsc2UpO1xuXG4gICAgYWpheC5yZXF1ZXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlbmQnLCBmdW5jdGlvbihldmVudCl7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9yZXF1ZXN0VGltZW91dCk7XG4gICAgICAgIGFqYXguZW1pdCgnY29tcGxldGUnLCBldmVudCk7XG4gICAgfSwgZmFsc2UpO1xuXG4gICAgYWpheC5yZXF1ZXN0Lm9wZW4oYWpheC5zZXR0aW5ncy5tZXRob2QgfHwgJ2dldCcsIGFqYXguc2V0dGluZ3MudXJsLCB0cnVlKTtcblxuICAgIC8vIFNldCBkZWZhdWx0IGhlYWRlcnNcbiAgICBpZihhamF4LnNldHRpbmdzLmNvbnRlbnRUeXBlICE9PSBmYWxzZSl7XG4gICAgICAgIGFqYXgucmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LVR5cGUnLCBhamF4LnNldHRpbmdzLmNvbnRlbnRUeXBlIHx8ICdhcHBsaWNhdGlvbi9qc29uOyBjaGFyc2V0PXV0Zi04Jyk7XG4gICAgfVxuICAgIGlmKGFqYXguc2V0dGluZ3MucmVxdWVzdGVkV2l0aCAhPT0gZmFsc2UpIHtcbiAgICAgICAgYWpheC5yZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoJ1gtUmVxdWVzdGVkLVdpdGgnLCBhamF4LnNldHRpbmdzLnJlcXVlc3RlZFdpdGggfHwgJ1hNTEh0dHBSZXF1ZXN0Jyk7XG4gICAgfVxuICAgIGlmKGFqYXguc2V0dGluZ3MuYXV0aCl7XG4gICAgICAgIGFqYXgucmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKCdBdXRob3JpemF0aW9uJywgYWpheC5zZXR0aW5ncy5hdXRoKTtcbiAgICB9XG5cbiAgICAvLyBTZXQgY3VzdG9tIGhlYWRlcnNcbiAgICBmb3IodmFyIGhlYWRlcktleSBpbiBhamF4LnNldHRpbmdzLmhlYWRlcnMpe1xuICAgICAgICBhamF4LnJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcihoZWFkZXJLZXksIGFqYXguc2V0dGluZ3MuaGVhZGVyc1toZWFkZXJLZXldKTtcbiAgICB9XG5cbiAgICBpZihhamF4LnNldHRpbmdzLnByb2Nlc3NEYXRhICE9PSBmYWxzZSAmJiBhamF4LnNldHRpbmdzLmRhdGFUeXBlID09PSAnanNvbicpe1xuICAgICAgICBhamF4LnNldHRpbmdzLmRhdGEgPSBKU09OLnN0cmluZ2lmeShhamF4LnNldHRpbmdzLmRhdGEpO1xuICAgIH1cbn1cblxuQWpheC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuXG5BamF4LnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24oKXtcbiAgICB0aGlzLl9yZXF1ZXN0VGltZW91dCA9IHNldFRpbWVvdXQoXG4gICAgICAgIHRpbWVvdXQuYmluZCh0aGlzKSxcbiAgICAgICAgdGhpcy5zZXR0aW5ncy50aW1lb3V0IHx8IDEyMDAwMFxuICAgICk7XG4gICAgdGhpcy5yZXF1ZXN0LnNlbmQodGhpcy5zZXR0aW5ncy5kYXRhICYmIHRoaXMuc2V0dGluZ3MuZGF0YSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFqYXg7XG4iLCIvKiFcblx0cXVlcnktc3RyaW5nXG5cdFBhcnNlIGFuZCBzdHJpbmdpZnkgVVJMIHF1ZXJ5IHN0cmluZ3Ncblx0aHR0cHM6Ly9naXRodWIuY29tL3NpbmRyZXNvcmh1cy9xdWVyeS1zdHJpbmdcblx0YnkgU2luZHJlIFNvcmh1c1xuXHRNSVQgTGljZW5zZVxuKi9cbihmdW5jdGlvbiAoKSB7XG5cdCd1c2Ugc3RyaWN0Jztcblx0dmFyIHF1ZXJ5U3RyaW5nID0ge307XG5cblx0cXVlcnlTdHJpbmcucGFyc2UgPSBmdW5jdGlvbiAoc3RyKSB7XG5cdFx0aWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4ge307XG5cdFx0fVxuXG5cdFx0c3RyID0gc3RyLnRyaW0oKS5yZXBsYWNlKC9eKFxcP3wjKS8sICcnKTtcblxuXHRcdGlmICghc3RyKSB7XG5cdFx0XHRyZXR1cm4ge307XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN0ci50cmltKCkuc3BsaXQoJyYnKS5yZWR1Y2UoZnVuY3Rpb24gKHJldCwgcGFyYW0pIHtcblx0XHRcdHZhciBwYXJ0cyA9IHBhcmFtLnJlcGxhY2UoL1xcKy9nLCAnICcpLnNwbGl0KCc9Jyk7XG5cdFx0XHR2YXIga2V5ID0gcGFydHNbMF07XG5cdFx0XHR2YXIgdmFsID0gcGFydHNbMV07XG5cblx0XHRcdGtleSA9IGRlY29kZVVSSUNvbXBvbmVudChrZXkpO1xuXHRcdFx0Ly8gbWlzc2luZyBgPWAgc2hvdWxkIGJlIGBudWxsYDpcblx0XHRcdC8vIGh0dHA6Ly93My5vcmcvVFIvMjAxMi9XRC11cmwtMjAxMjA1MjQvI2NvbGxlY3QtdXJsLXBhcmFtZXRlcnNcblx0XHRcdHZhbCA9IHZhbCA9PT0gdW5kZWZpbmVkID8gbnVsbCA6IGRlY29kZVVSSUNvbXBvbmVudCh2YWwpO1xuXG5cdFx0XHRpZiAoIXJldC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG5cdFx0XHRcdHJldFtrZXldID0gdmFsO1xuXHRcdFx0fSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHJldFtrZXldKSkge1xuXHRcdFx0XHRyZXRba2V5XS5wdXNoKHZhbCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXRba2V5XSA9IFtyZXRba2V5XSwgdmFsXTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJldDtcblx0XHR9LCB7fSk7XG5cdH07XG5cblx0cXVlcnlTdHJpbmcuc3RyaW5naWZ5ID0gZnVuY3Rpb24gKG9iaikge1xuXHRcdHJldHVybiBvYmogPyBPYmplY3Qua2V5cyhvYmopLm1hcChmdW5jdGlvbiAoa2V5KSB7XG5cdFx0XHR2YXIgdmFsID0gb2JqW2tleV07XG5cblx0XHRcdGlmIChBcnJheS5pc0FycmF5KHZhbCkpIHtcblx0XHRcdFx0cmV0dXJuIHZhbC5tYXAoZnVuY3Rpb24gKHZhbDIpIHtcblx0XHRcdFx0XHRyZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KGtleSkgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQodmFsMik7XG5cdFx0XHRcdH0pLmpvaW4oJyYnKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudChrZXkpICsgJz0nICsgZW5jb2RlVVJJQ29tcG9uZW50KHZhbCk7XG5cdFx0fSkuam9pbignJicpIDogJyc7XG5cdH07XG5cblx0aWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuXHRcdGRlZmluZShmdW5jdGlvbigpIHsgcmV0dXJuIHF1ZXJ5U3RyaW5nOyB9KTtcblx0fSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuXHRcdG1vZHVsZS5leHBvcnRzID0gcXVlcnlTdHJpbmc7XG5cdH0gZWxzZSB7XG5cdFx0c2VsZi5xdWVyeVN0cmluZyA9IHF1ZXJ5U3RyaW5nO1xuXHR9XG59KSgpO1xuIl19
