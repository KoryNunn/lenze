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

},{"./createKey":2,"deep-diff":5,"events":1,"shuv":6,"statham":10}],5:[function(require,module,exports){
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
var revive = require('./revive');

function parse(json, reviver){
    return revive(JSON.parse(json, reviver));
}

module.exports = parse;
},{"./revive":9}],9:[function(require,module,exports){
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
},{"./createKey":7}],10:[function(require,module,exports){
module.exports = {
    stringify: require('./stringify'),
    parse: require('./parse'),
    revive: require('./revive')
};
},{"./parse":8,"./revive":9,"./stringify":11}],11:[function(require,module,exports){
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
},{"./createKey":7}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92NS4zLjAvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y1LjMuMC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiY3JlYXRlS2V5LmpzIiwiZXhhbXBsZS9hcHAvYXBwLmpzIiwiaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVlcC1kaWZmL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NodXYvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc3RhdGhhbS9wYXJzZS5qcyIsIm5vZGVfbW9kdWxlcy9zdGF0aGFtL3Jldml2ZS5qcyIsIm5vZGVfbW9kdWxlcy9zdGF0aGFtL3N0YXRoYW0uanMiLCJub2RlX21vZHVsZXMvc3RhdGhhbS9zdHJpbmdpZnkuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3hRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDblpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfVxuICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2UgaWYgKGxpc3RlbmVycykge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgaWYgKHRoaXMuX2V2ZW50cykge1xuICAgIHZhciBldmxpc3RlbmVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gICAgaWYgKGlzRnVuY3Rpb24oZXZsaXN0ZW5lcikpXG4gICAgICByZXR1cm4gMTtcbiAgICBlbHNlIGlmIChldmxpc3RlbmVyKVxuICAgICAgcmV0dXJuIGV2bGlzdGVuZXIubGVuZ3RoO1xuICB9XG4gIHJldHVybiAwO1xufTtcblxuRXZlbnRFbWl0dGVyLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbihlbWl0dGVyLCB0eXBlKSB7XG4gIHJldHVybiBlbWl0dGVyLmxpc3RlbmVyQ291bnQodHlwZSk7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCJmdW5jdGlvbiBlc2NhcGVIZXgoaGV4KXtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShoZXgpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVLZXkobnVtYmVyKXtcbiAgICBpZihudW1iZXIgKyAweEUwMDEgPiAweEZGRkYpe1xuICAgICAgICB0aHJvdyBcIlRvbyBtYW55IHJlZmVyZW5jZXMuIExvZyBhbiBpc3N1ZSBvbiBnaWh1YiBhbiBpJ2xsIGFkZCBhbiBvcmRlciBvZiBtYWduYXR1ZGUgdG8gdGhlIGtleXMuXCI7XG4gICAgfVxuICAgIHJldHVybiBlc2NhcGVIZXgobnVtYmVyICsgMHhFMDAxKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVLZXk7IiwidmFyIGxlbnplID0gcmVxdWlyZSgnLi4vLi4vJykoe1xuICAgIGNoYW5nZUludGVydmFsOiAxNixcbiAgICBzZW5kOiBmdW5jdGlvbihkYXRhKXtcbiAgICAgICAgc2VsZi5wb3N0TWVzc2FnZShkYXRhKTtcbiAgICB9LFxuICAgIHJlY2VpdmU6IGZ1bmN0aW9uKGNhbGxiYWNrKXtcbiAgICAgICAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24obWVzc2FnZSl7XG4gICAgICAgICAgICBjYWxsYmFjayhtZXNzYWdlLmRhdGEpO1xuICAgICAgICB9KTtcbiAgICB9XG59KTtcblxudmFyIHN0YXRlID0gbGVuemUuc3RhdGU7XG5cbnN0YXRlLnNldEhlYWRpbmcgPSBmdW5jdGlvbih2YWx1ZSl7XG4gICAgc3RhdGUuaGVhZGluZyA9ICdIZWxsbyAnICsgKHZhbHVlIHx8ICdXb3JsZCcpO1xufTtcbnN0YXRlLnNldEhlYWRpbmcoKTtcblxuc3RhdGUub2JqcyA9IFtdO1xuc3RhdGUueCA9IHt9O1xuc3RhdGUueSA9IHN0YXRlLng7XG5cbnNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICBzdGF0ZS56ID0gc3RhdGUueDtcbn0sIDEwMDApOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICBkaWZmID0gcmVxdWlyZSgnZGVlcC1kaWZmJyksXG4gICAgc2h1diA9IHJlcXVpcmUoJ3NodXYnKSxcbiAgICBzdGF0aGFtID0gcmVxdWlyZSgnc3RhdGhhbScpLFxuICAgIGNyZWF0ZUtleSA9IHJlcXVpcmUoJy4vY3JlYXRlS2V5JyksXG4gICAga2V5S2V5ID0gY3JlYXRlS2V5KC0yKTtcblxudmFyIElOVk9LRSA9ICdpbnZva2UnO1xudmFyIENIQU5HRVMgPSAnY2hhbmdlcyc7XG52YXIgQ09OTkVDVCA9ICdjb25uZWN0JztcbnZhciBTVEFURSA9ICdzdGF0ZSc7XG5cbmZ1bmN0aW9uIGFwcGx5Q2hhbmdlcyh0YXJnZXQsIGNoYW5nZXMpe1xuICAgIGNoYW5nZXMuZm9yRWFjaChmdW5jdGlvbihjaGFuZ2Upe1xuICAgICAgICBkaWZmLmFwcGx5Q2hhbmdlKHRhcmdldCwgdHJ1ZSAsIGNoYW5nZSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybUZ1bmN0aW9ucyhzY29wZSwga2V5LCB2YWx1ZSl7XG4gICAgaWYodHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICYmIHZhbHVlW2tleUtleV0pe1xuICAgICAgICByZXR1cm4geydMRU5aRV9GVU5DVElPTic6IHZhbHVlW2tleUtleV19O1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gbmV4dEluc3RhbmNlSWQoc2NvcGUpe1xuICAgIHJldHVybiBzY29wZS5pbnN0YW5jZUlkcysrO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDaGFuZ2VzKHNjb3BlLCBjaGFuZ2VzKXtcbiAgICBjaGFuZ2VzID0gY2hhbmdlcy5tYXAoZnVuY3Rpb24oY2hhbmdlKXtcbiAgICAgICAgdmFyIHZhbHVlID0gY2hhbmdlLnJocztcblxuICAgICAgICBpZih2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKXtcbiAgICAgICAgICAgIGlmKCF2YWx1ZVtrZXlLZXldKXtcbiAgICAgICAgICAgICAgICB2YWx1ZVtrZXlLZXldID0gY3JlYXRlS2V5KG5leHRJbnN0YW5jZUlkKHNjb3BlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZih0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpe1xuICAgICAgICAgICAgdmFyIGlkID0gdmFsdWVba2V5S2V5XTtcblxuICAgICAgICAgICAgaWYoaWQgPT0gbnVsbCl7XG4gICAgICAgICAgICAgICAgaWQgPSB2YWx1ZVtrZXlLZXldID0gY3JlYXRlS2V5KG5leHRJbnN0YW5jZUlkKHNjb3BlKSk7XG4gICAgICAgICAgICAgICAgc2NvcGUuZnVuY3Rpb25zW2lkXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgZm46IHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICBjb3VudDogMFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNjb3BlLmZ1bmN0aW9uc1tpZF0uY291bnQrKztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjaGFuZ2U7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gc3RhdGhhbS5zdHJpbmdpZnkoY2hhbmdlcywgc2h1dih0cmFuc2Zvcm1GdW5jdGlvbnMsIHNjb3BlKSk7XG59XG5cbmZ1bmN0aW9uIHBhcnNlTWVzc2FnZShkYXRhKXtcbiAgICB2YXIgbWVzc2FnZSA9IGRhdGEubWF0Y2goL14oXFx3Kz8pXFw6KC4qKS8pO1xuXG4gICAgaWYobWVzc2FnZSl7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB0eXBlOiBtZXNzYWdlWzFdLFxuICAgICAgICAgICAgZGF0YTogbWVzc2FnZVsyXVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZWNlaXZlKHNjb3BlLCBkYXRhKXtcbiAgICB2YXIgbWVzc2FnZSA9IHBhcnNlTWVzc2FnZShkYXRhKTtcblxuICAgIGlmKCFtZXNzYWdlKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmKG1lc3NhZ2UudHlwZSA9PT0gSU5WT0tFKXtcbiAgICAgICAgc2NvcGUuaGFuZGxlRnVuY3Rpb24uYXBwbHkobnVsbCwgc3RhdGhhbS5wYXJzZShtZXNzYWdlLmRhdGEpKTtcbiAgICB9XG5cbiAgICBpZihtZXNzYWdlLnR5cGUgPT09IENPTk5FQ1Qpe1xuICAgICAgICBzY29wZS5zZW5kKENPTk5FQ1QsIHNjb3BlLmxlbnplLnN0YXRlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGluZmxhdGVEYXRhKHNjb3BlLCB2YWx1ZSl7XG4gICAgaWYodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jyl7XG4gICAgICAgIGlmKHZhbHVlW2tleUtleV0pe1xuICAgICAgICAgICAgdmFyIGlkID0gdmFsdWVba2V5S2V5XTtcbiAgICAgICAgICAgIGlmKCFzY29wZS5pbnN0YW5jZUhhc2hbaWRdKXtcbiAgICAgICAgICAgICAgICBzY29wZS5pbnN0YW5jZUhhc2hbaWRdID0ge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICAgICAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHNjb3BlLmluc3RhbmNlSGFzaFtpZF0udmFsdWU7XG4gICAgICAgIH1lbHNlIGlmKCdMRU5aRV9GVU5DVElPTicgaW4gdmFsdWUpe1xuICAgICAgICAgICAgdmFyIGZ1bmN0aW9uSWQgPSB2YWx1ZVsnTEVOWkVfRlVOQ1RJT04nXSxcbiAgICAgICAgICAgICAgICBmbiA9IHNjb3BlLmludm9rZS5iaW5kKHRoaXMsIHZhbHVlWydMRU5aRV9GVU5DVElPTiddKTtcblxuICAgICAgICAgICAgZm5bJ0xFTlpFX0ZVTkNUSU9OJ10gPSBmdW5jdGlvbklkO1xuICAgICAgICAgICAgaWYoIXNjb3BlLmZ1bmN0aW9uc1tmdW5jdGlvbklkXSl7XG4gICAgICAgICAgICAgICAgc2NvcGUuZnVuY3Rpb25zW2Z1bmN0aW9uSWRdID0ge1xuICAgICAgICAgICAgICAgICAgICBmbjogZm4sXG4gICAgICAgICAgICAgICAgICAgIGNvdW50OiAwXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmbjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gaW5mbGF0ZU9iamVjdChzY29wZSwgY2hhbmdlKXtcbiAgICB2YXIgaWQgPSBjaGFuZ2UucmhzICYmIGNoYW5nZS5yaHNba2V5S2V5XTtcblxuICAgIGNoYW5nZS5yaHMgPSBpbmZsYXRlRGF0YShzY29wZSwgY2hhbmdlLnJocyk7XG4gICAgY2hhbmdlLmxocyA9IGluZmxhdGVEYXRhKHNjb3BlLCBjaGFuZ2UubGhzKTtcblxuICAgIGlmKCFpZCl7XG4gICAgICAgIHJldHVybiBjaGFuZ2U7XG4gICAgfVxuXG4gICAgaWYoIWNoYW5nZS5yaHMgfHwgdHlwZW9mIGNoYW5nZS5yaHMgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNjb3BlLmluc3RhbmNlSGFzaFtpZF0uY291bnQgKz0gY2hhbmdlLmtpbmQgPT09ICdOJyA/IDEgOiAtMTtcblxuICAgIGlmKHR5cGVvZiBjaGFuZ2UucmhzID09PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgY2hhbmdlLnJoc1trZXlLZXldID0gaWQ7XG4gICAgfVxuXG4gICAgZGVsZXRlIGNoYW5nZS5yaHNba2V5S2V5XTtcbn1cblxuZnVuY3Rpb24gaW5mbGF0ZUNoYW5nZXMoc2NvcGUsIGRhdGEpe1xuICAgIHJldHVybiBzdGF0aGFtLnBhcnNlKGRhdGEpLm1hcChmdW5jdGlvbihjaGFuZ2Upe1xuICAgICAgICB2YXIgdmFsdWUgPSBjaGFuZ2UucmhzO1xuXG4gICAgICAgIGluZmxhdGVPYmplY3Qoc2NvcGUsIGNoYW5nZSk7XG5cbiAgICAgICAgdmFyIHByZXZpb3VzID0gY2hhbmdlLmxocztcblxuICAgICAgICBpZih0eXBlb2YgcHJldmlvdXMgPT09ICdmdW5jdGlvbicpe1xuXG4gICAgICAgICAgICB2YXIgaWQgPSBwcmV2aW91cyAmJiBwcmV2aW91c1snTEVOWkVfRlVOQ1RJT04nXTtcbiAgICAgICAgICAgIGlmKGlkKXtcbiAgICAgICAgICAgICAgICBzY29wZS5mdW5jdGlvbnNbaWRdLmNvdW50LS07XG4gICAgICAgICAgICAgICAgaWYoIXNjb3BlLmZ1bmN0aW9uc1tpZF0uY291bnQpe1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgc2NvcGUuZnVuY3Rpb25zW2lkXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZih0eXBlb2YgY2hhbmdlLnJocyA9PT0gJ2Z1bmN0aW9uJyAmJiAnTEVOWkVfRlVOQ1RJT04nIGluIGNoYW5nZS5yaHMpe1xuICAgICAgICAgICAgc2NvcGUuZnVuY3Rpb25zW2NoYW5nZS5yaHNbJ0xFTlpFX0ZVTkNUSU9OJ11dLmNvdW50Kys7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY2hhbmdlO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiB1cGRhdGUoc2NvcGUpe1xuICAgIHZhciBjaGFuZ2VzID0gZGlmZihzY29wZS5vcmlnaW5hbCwgc2NvcGUubGVuemUuc3RhdGUpO1xuXG4gICAgaWYoY2hhbmdlcyl7XG4gICAgICAgIHNjb3BlLmxlbnplLmVtaXQoJ2NoYW5nZScsIGNoYW5nZXMpO1xuICAgICAgICBhcHBseUNoYW5nZXMoc2NvcGUub3JpZ2luYWwsIGNoYW5nZXMpO1xuICAgICAgICBpZihzY29wZS5zZW5kKXtcbiAgICAgICAgICAgIHNjb3BlLnNlbmQoQ0hBTkdFUywgY2hhbmdlcyk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZUZ1bmN0aW9uKHNjb3BlLCBpZCl7XG4gICAgc2NvcGUuZnVuY3Rpb25zW2lkXS5mbi5hcHBseSh0aGlzLCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpKTtcbn1cblxuZnVuY3Rpb24gc2VuZChzY29wZSwgc2VuZCwgdHlwZSwgZGF0YSl7XG4gICAgaWYodHlwZSA9PT0gQ0hBTkdFUyl7XG4gICAgICAgIHNlbmQoQ0hBTkdFUyArICc6JyArIGNyZWF0ZUNoYW5nZXMoc2NvcGUsIGRhdGEpKTtcbiAgICB9XG4gICAgaWYodHlwZSA9PT0gQ09OTkVDVCl7XG4gICAgICAgIHNlbmQoU1RBVEUgKyAnOicgKyBzdGF0aGFtLnN0cmluZ2lmeShkYXRhLCBzaHV2KHRyYW5zZm9ybUZ1bmN0aW9ucywgc2NvcGUpKSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzZW5kSW52b2tlKHNjb3BlLCBzZW5kSW52b2tlKXtcbiAgICBzZW5kSW52b2tlKElOVk9LRSArICc6JyArIHN0YXRoYW0uc3RyaW5naWZ5KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMikpKTtcbn1cblxuZnVuY3Rpb24gaW5pdFNjb3BlKHNldHRpbmdzKXtcbiAgICBpZighc2V0dGluZ3Mpe1xuICAgICAgICBzZXR0aW5ncyA9IHt9O1xuICAgIH1cblxuICAgIHZhciBsZW56ZSA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgICB2YXIgc2NvcGUgPSB7XG4gICAgICAgIGZ1bmN0aW9uczoge30sXG4gICAgICAgIGluc3RhbmNlSWRzOiAwLFxuICAgICAgICBsZW56ZTogbGVuemUsXG4gICAgICAgIG9yaWdpbmFsOiB7fVxuICAgIH07XG5cbiAgICBsZW56ZS51cGRhdGUgPSBzaHV2KHVwZGF0ZSwgc2NvcGUpO1xuICAgIGxlbnplLnN0YXRlID0ge307XG5cbiAgICByZXR1cm4gc2NvcGU7XG59XG5cbmZ1bmN0aW9uIGluaXQoc2V0dGluZ3Mpe1xuICAgIHZhciBzY29wZSA9IGluaXRTY29wZShzZXR0aW5ncyk7XG5cbiAgICBzY29wZS5oYW5kbGVGdW5jdGlvbiA9IHNodXYoaGFuZGxlRnVuY3Rpb24sIHNjb3BlKTtcbiAgICBzY29wZS5zZW5kID0gc2h1dihzZW5kLCBzY29wZSwgc2V0dGluZ3Muc2VuZCk7XG4gICAgc2V0dGluZ3MucmVjZWl2ZShzaHV2KHJlY2VpdmUsIHNjb3BlKSk7XG5cbiAgICBzZXRJbnRlcnZhbChzY29wZS5sZW56ZS51cGRhdGUsIHNldHRpbmdzLmNoYW5nZUludGVydmFsIHx8IDEwMCk7XG5cbiAgICByZXR1cm4gc2NvcGUubGVuemU7XG59XG5cbmZ1bmN0aW9uIHJlcGxpY2FudChzZXR0aW5ncyl7XG4gICAgdmFyIHNjb3BlID0gaW5pdFNjb3BlKCk7XG5cbiAgICBzY29wZS5pbnN0YW5jZUhhc2ggPSB7fTtcblxuICAgIHNldHRpbmdzLnJlY2VpdmUoZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIGlmKCFzY29wZS5yZWFkeSl7XG4gICAgICAgICAgICBzY29wZS5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBzY29wZS5sZW56ZS5lbWl0KCdyZWFkeScpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG1lc3NhZ2UgPSBwYXJzZU1lc3NhZ2UoZGF0YSk7XG5cbiAgICAgICAgaWYoIW1lc3NhZ2Upe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYobWVzc2FnZS50eXBlID09PSBTVEFURSl7XG4gICAgICAgICAgICBzY29wZS5sZW56ZS5zdGF0ZSA9IGluZmxhdGVEYXRhKHNjb3BlLCBzdGF0aGFtLnBhcnNlKG1lc3NhZ2UuZGF0YSkpO1xuICAgICAgICAgICAgdXBkYXRlKHNjb3BlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKG1lc3NhZ2UudHlwZSA9PT0gQ0hBTkdFUyl7XG4gICAgICAgICAgICBhcHBseUNoYW5nZXMoc2NvcGUubGVuemUuc3RhdGUsIGluZmxhdGVDaGFuZ2VzKHNjb3BlLCBtZXNzYWdlLmRhdGEpKTtcbiAgICAgICAgICAgIHVwZGF0ZShzY29wZSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHNjb3BlLmludm9rZSA9IHNodXYoc2VuZEludm9rZSwgc2NvcGUsIHNldHRpbmdzLnNlbmQpO1xuXG4gICAgc2V0dGluZ3Muc2VuZChDT05ORUNUICsgJzonKTtcblxuICAgIHJldHVybiBzY29wZS5sZW56ZVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGluaXQ7XG5tb2R1bGUuZXhwb3J0cy5yZXBsaWNhbnQgPSByZXBsaWNhbnQ7XG4iLCIvKiFcbiAqIGRlZXAtZGlmZi5cbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS5cbiAqL1xuOyhmdW5jdGlvbihyb290LCBmYWN0b3J5KSB7XG4gICd1c2Ugc3RyaWN0JztcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIC8vIEFNRC4gUmVnaXN0ZXIgYXMgYW4gYW5vbnltb3VzIG1vZHVsZS5cbiAgICBkZWZpbmUoW10sIGZhY3RvcnkpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIC8vIE5vZGUuIERvZXMgbm90IHdvcmsgd2l0aCBzdHJpY3QgQ29tbW9uSlMsIGJ1dFxuICAgIC8vIG9ubHkgQ29tbW9uSlMtbGlrZSBlbnZpcm9ubWVudHMgdGhhdCBzdXBwb3J0IG1vZHVsZS5leHBvcnRzLFxuICAgIC8vIGxpa2UgTm9kZS5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBCcm93c2VyIGdsb2JhbHMgKHJvb3QgaXMgd2luZG93KVxuICAgIHJvb3QuRGVlcERpZmYgPSBmYWN0b3J5KCk7XG4gIH1cbn0odGhpcywgZnVuY3Rpb24odW5kZWZpbmVkKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICB2YXIgJHNjb3BlLCBjb25mbGljdCwgY29uZmxpY3RSZXNvbHV0aW9uID0gW107XG4gIGlmICh0eXBlb2YgZ2xvYmFsID09PSAnb2JqZWN0JyAmJiBnbG9iYWwpIHtcbiAgICAkc2NvcGUgPSBnbG9iYWw7XG4gIH0gZWxzZSBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAkc2NvcGUgPSB3aW5kb3c7XG4gIH0gZWxzZSB7XG4gICAgJHNjb3BlID0ge307XG4gIH1cbiAgY29uZmxpY3QgPSAkc2NvcGUuRGVlcERpZmY7XG4gIGlmIChjb25mbGljdCkge1xuICAgIGNvbmZsaWN0UmVzb2x1dGlvbi5wdXNoKFxuICAgICAgZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIGNvbmZsaWN0ICYmICRzY29wZS5EZWVwRGlmZiA9PT0gYWNjdW11bGF0ZURpZmYpIHtcbiAgICAgICAgICAkc2NvcGUuRGVlcERpZmYgPSBjb25mbGljdDtcbiAgICAgICAgICBjb25mbGljdCA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICAvLyBub2RlanMgY29tcGF0aWJsZSBvbiBzZXJ2ZXIgc2lkZSBhbmQgaW4gdGhlIGJyb3dzZXIuXG4gIGZ1bmN0aW9uIGluaGVyaXRzKGN0b3IsIHN1cGVyQ3Rvcikge1xuICAgIGN0b3Iuc3VwZXJfID0gc3VwZXJDdG9yO1xuICAgIGN0b3IucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckN0b3IucHJvdG90eXBlLCB7XG4gICAgICBjb25zdHJ1Y3Rvcjoge1xuICAgICAgICB2YWx1ZTogY3RvcixcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIERpZmYoa2luZCwgcGF0aCkge1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAna2luZCcsIHtcbiAgICAgIHZhbHVlOiBraW5kLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIGlmIChwYXRoICYmIHBhdGgubGVuZ3RoKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3BhdGgnLCB7XG4gICAgICAgIHZhbHVlOiBwYXRoLFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBEaWZmRWRpdChwYXRoLCBvcmlnaW4sIHZhbHVlKSB7XG4gICAgRGlmZkVkaXQuc3VwZXJfLmNhbGwodGhpcywgJ0UnLCBwYXRoKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2xocycsIHtcbiAgICAgIHZhbHVlOiBvcmlnaW4sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdyaHMnLCB7XG4gICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH1cbiAgaW5oZXJpdHMoRGlmZkVkaXQsIERpZmYpO1xuXG4gIGZ1bmN0aW9uIERpZmZOZXcocGF0aCwgdmFsdWUpIHtcbiAgICBEaWZmTmV3LnN1cGVyXy5jYWxsKHRoaXMsICdOJywgcGF0aCk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdyaHMnLCB7XG4gICAgICB2YWx1ZTogdmFsdWUsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSk7XG4gIH1cbiAgaW5oZXJpdHMoRGlmZk5ldywgRGlmZik7XG5cbiAgZnVuY3Rpb24gRGlmZkRlbGV0ZWQocGF0aCwgdmFsdWUpIHtcbiAgICBEaWZmRGVsZXRlZC5zdXBlcl8uY2FsbCh0aGlzLCAnRCcsIHBhdGgpO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnbGhzJywge1xuICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICB9XG4gIGluaGVyaXRzKERpZmZEZWxldGVkLCBEaWZmKTtcblxuICBmdW5jdGlvbiBEaWZmQXJyYXkocGF0aCwgaW5kZXgsIGl0ZW0pIHtcbiAgICBEaWZmQXJyYXkuc3VwZXJfLmNhbGwodGhpcywgJ0EnLCBwYXRoKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2luZGV4Jywge1xuICAgICAgdmFsdWU6IGluZGV4LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAnaXRlbScsIHtcbiAgICAgIHZhbHVlOiBpdGVtLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICB9XG4gIGluaGVyaXRzKERpZmZBcnJheSwgRGlmZik7XG5cbiAgZnVuY3Rpb24gYXJyYXlSZW1vdmUoYXJyLCBmcm9tLCB0bykge1xuICAgIHZhciByZXN0ID0gYXJyLnNsaWNlKCh0byB8fCBmcm9tKSArIDEgfHwgYXJyLmxlbmd0aCk7XG4gICAgYXJyLmxlbmd0aCA9IGZyb20gPCAwID8gYXJyLmxlbmd0aCArIGZyb20gOiBmcm9tO1xuICAgIGFyci5wdXNoLmFwcGx5KGFyciwgcmVzdCk7XG4gICAgcmV0dXJuIGFycjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWxUeXBlT2Yoc3ViamVjdCkge1xuICAgIHZhciB0eXBlID0gdHlwZW9mIHN1YmplY3Q7XG4gICAgaWYgKHR5cGUgIT09ICdvYmplY3QnKSB7XG4gICAgICByZXR1cm4gdHlwZTtcbiAgICB9XG5cbiAgICBpZiAoc3ViamVjdCA9PT0gTWF0aCkge1xuICAgICAgcmV0dXJuICdtYXRoJztcbiAgICB9IGVsc2UgaWYgKHN1YmplY3QgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiAnbnVsbCc7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHN1YmplY3QpKSB7XG4gICAgICByZXR1cm4gJ2FycmF5JztcbiAgICB9IGVsc2UgaWYgKHN1YmplY3QgaW5zdGFuY2VvZiBEYXRlKSB7XG4gICAgICByZXR1cm4gJ2RhdGUnO1xuICAgIH0gZWxzZSBpZiAoL15cXC8uKlxcLy8udGVzdChzdWJqZWN0LnRvU3RyaW5nKCkpKSB7XG4gICAgICByZXR1cm4gJ3JlZ2V4cCc7XG4gICAgfVxuICAgIHJldHVybiAnb2JqZWN0JztcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlZXBEaWZmKGxocywgcmhzLCBjaGFuZ2VzLCBwcmVmaWx0ZXIsIHBhdGgsIGtleSwgc3RhY2spIHtcbiAgICBwYXRoID0gcGF0aCB8fCBbXTtcbiAgICB2YXIgY3VycmVudFBhdGggPSBwYXRoLnNsaWNlKDApO1xuICAgIGlmICh0eXBlb2Yga2V5ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgaWYgKHByZWZpbHRlciAmJiBwcmVmaWx0ZXIoY3VycmVudFBhdGgsIGtleSwgeyBsaHM6IGxocywgcmhzOiByaHMgfSkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY3VycmVudFBhdGgucHVzaChrZXkpO1xuICAgIH1cbiAgICB2YXIgbHR5cGUgPSB0eXBlb2YgbGhzO1xuICAgIHZhciBydHlwZSA9IHR5cGVvZiByaHM7XG4gICAgaWYgKGx0eXBlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgaWYgKHJ0eXBlICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBjaGFuZ2VzKG5ldyBEaWZmTmV3KGN1cnJlbnRQYXRoLCByaHMpKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHJ0eXBlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgY2hhbmdlcyhuZXcgRGlmZkRlbGV0ZWQoY3VycmVudFBhdGgsIGxocykpO1xuICAgIH0gZWxzZSBpZiAocmVhbFR5cGVPZihsaHMpICE9PSByZWFsVHlwZU9mKHJocykpIHtcbiAgICAgIGNoYW5nZXMobmV3IERpZmZFZGl0KGN1cnJlbnRQYXRoLCBsaHMsIHJocykpO1xuICAgIH0gZWxzZSBpZiAobGhzIGluc3RhbmNlb2YgRGF0ZSAmJiByaHMgaW5zdGFuY2VvZiBEYXRlICYmICgobGhzIC0gcmhzKSAhPT0gMCkpIHtcbiAgICAgIGNoYW5nZXMobmV3IERpZmZFZGl0KGN1cnJlbnRQYXRoLCBsaHMsIHJocykpO1xuICAgIH0gZWxzZSBpZiAobHR5cGUgPT09ICdvYmplY3QnICYmIGxocyAhPT0gbnVsbCAmJiByaHMgIT09IG51bGwpIHtcbiAgICAgIHN0YWNrID0gc3RhY2sgfHwgW107XG4gICAgICBpZiAoc3RhY2suaW5kZXhPZihsaHMpIDwgMCkge1xuICAgICAgICBzdGFjay5wdXNoKGxocyk7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGxocykpIHtcbiAgICAgICAgICB2YXIgaSwgbGVuID0gbGhzLmxlbmd0aDtcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgbGhzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBpZiAoaSA+PSByaHMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGNoYW5nZXMobmV3IERpZmZBcnJheShjdXJyZW50UGF0aCwgaSwgbmV3IERpZmZEZWxldGVkKHVuZGVmaW5lZCwgbGhzW2ldKSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZGVlcERpZmYobGhzW2ldLCByaHNbaV0sIGNoYW5nZXMsIHByZWZpbHRlciwgY3VycmVudFBhdGgsIGksIHN0YWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgd2hpbGUgKGkgPCByaHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjaGFuZ2VzKG5ldyBEaWZmQXJyYXkoY3VycmVudFBhdGgsIGksIG5ldyBEaWZmTmV3KHVuZGVmaW5lZCwgcmhzW2krK10pKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBha2V5cyA9IE9iamVjdC5rZXlzKGxocyk7XG4gICAgICAgICAgdmFyIHBrZXlzID0gT2JqZWN0LmtleXMocmhzKTtcbiAgICAgICAgICBha2V5cy5mb3JFYWNoKGZ1bmN0aW9uKGssIGkpIHtcbiAgICAgICAgICAgIHZhciBvdGhlciA9IHBrZXlzLmluZGV4T2Yoayk7XG4gICAgICAgICAgICBpZiAob3RoZXIgPj0gMCkge1xuICAgICAgICAgICAgICBkZWVwRGlmZihsaHNba10sIHJoc1trXSwgY2hhbmdlcywgcHJlZmlsdGVyLCBjdXJyZW50UGF0aCwgaywgc3RhY2spO1xuICAgICAgICAgICAgICBwa2V5cyA9IGFycmF5UmVtb3ZlKHBrZXlzLCBvdGhlcik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBkZWVwRGlmZihsaHNba10sIHVuZGVmaW5lZCwgY2hhbmdlcywgcHJlZmlsdGVyLCBjdXJyZW50UGF0aCwgaywgc3RhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHBrZXlzLmZvckVhY2goZnVuY3Rpb24oaykge1xuICAgICAgICAgICAgZGVlcERpZmYodW5kZWZpbmVkLCByaHNba10sIGNoYW5nZXMsIHByZWZpbHRlciwgY3VycmVudFBhdGgsIGssIHN0YWNrKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICBzdGFjay5sZW5ndGggPSBzdGFjay5sZW5ndGggLSAxO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobGhzICE9PSByaHMpIHtcbiAgICAgIGlmICghKGx0eXBlID09PSAnbnVtYmVyJyAmJiBpc05hTihsaHMpICYmIGlzTmFOKHJocykpKSB7XG4gICAgICAgIGNoYW5nZXMobmV3IERpZmZFZGl0KGN1cnJlbnRQYXRoLCBsaHMsIHJocykpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGFjY3VtdWxhdGVEaWZmKGxocywgcmhzLCBwcmVmaWx0ZXIsIGFjY3VtKSB7XG4gICAgYWNjdW0gPSBhY2N1bSB8fCBbXTtcbiAgICBkZWVwRGlmZihsaHMsIHJocyxcbiAgICAgIGZ1bmN0aW9uKGRpZmYpIHtcbiAgICAgICAgaWYgKGRpZmYpIHtcbiAgICAgICAgICBhY2N1bS5wdXNoKGRpZmYpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgcHJlZmlsdGVyKTtcbiAgICByZXR1cm4gKGFjY3VtLmxlbmd0aCkgPyBhY2N1bSA6IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFwcGx5QXJyYXlDaGFuZ2UoYXJyLCBpbmRleCwgY2hhbmdlKSB7XG4gICAgaWYgKGNoYW5nZS5wYXRoICYmIGNoYW5nZS5wYXRoLmxlbmd0aCkge1xuICAgICAgdmFyIGl0ID0gYXJyW2luZGV4XSxcbiAgICAgICAgaSwgdSA9IGNoYW5nZS5wYXRoLmxlbmd0aCAtIDE7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgdTsgaSsrKSB7XG4gICAgICAgIGl0ID0gaXRbY2hhbmdlLnBhdGhbaV1dO1xuICAgICAgfVxuICAgICAgc3dpdGNoIChjaGFuZ2Uua2luZCkge1xuICAgICAgICBjYXNlICdBJzpcbiAgICAgICAgICBhcHBseUFycmF5Q2hhbmdlKGl0W2NoYW5nZS5wYXRoW2ldXSwgY2hhbmdlLmluZGV4LCBjaGFuZ2UuaXRlbSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0QnOlxuICAgICAgICAgIGRlbGV0ZSBpdFtjaGFuZ2UucGF0aFtpXV07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0UnOlxuICAgICAgICBjYXNlICdOJzpcbiAgICAgICAgICBpdFtjaGFuZ2UucGF0aFtpXV0gPSBjaGFuZ2UucmhzO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzd2l0Y2ggKGNoYW5nZS5raW5kKSB7XG4gICAgICAgIGNhc2UgJ0EnOlxuICAgICAgICAgIGFwcGx5QXJyYXlDaGFuZ2UoYXJyW2luZGV4XSwgY2hhbmdlLmluZGV4LCBjaGFuZ2UuaXRlbSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0QnOlxuICAgICAgICAgIGFyciA9IGFycmF5UmVtb3ZlKGFyciwgaW5kZXgpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFJzpcbiAgICAgICAgY2FzZSAnTic6XG4gICAgICAgICAgYXJyW2luZGV4XSA9IGNoYW5nZS5yaHM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhcnI7XG4gIH1cblxuICBmdW5jdGlvbiBhcHBseUNoYW5nZSh0YXJnZXQsIHNvdXJjZSwgY2hhbmdlKSB7XG4gICAgaWYgKHRhcmdldCAmJiBzb3VyY2UgJiYgY2hhbmdlICYmIGNoYW5nZS5raW5kKSB7XG4gICAgICB2YXIgaXQgPSB0YXJnZXQsXG4gICAgICAgIGkgPSAtMSxcbiAgICAgICAgbGFzdCA9IGNoYW5nZS5wYXRoID8gY2hhbmdlLnBhdGgubGVuZ3RoIC0gMSA6IDA7XG4gICAgICB3aGlsZSAoKytpIDwgbGFzdCkge1xuICAgICAgICBpZiAodHlwZW9mIGl0W2NoYW5nZS5wYXRoW2ldXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBpdFtjaGFuZ2UucGF0aFtpXV0gPSAodHlwZW9mIGNoYW5nZS5wYXRoW2ldID09PSAnbnVtYmVyJykgPyBbXSA6IHt9O1xuICAgICAgICB9XG4gICAgICAgIGl0ID0gaXRbY2hhbmdlLnBhdGhbaV1dO1xuICAgICAgfVxuICAgICAgc3dpdGNoIChjaGFuZ2Uua2luZCkge1xuICAgICAgICBjYXNlICdBJzpcbiAgICAgICAgICBhcHBseUFycmF5Q2hhbmdlKGNoYW5nZS5wYXRoID8gaXRbY2hhbmdlLnBhdGhbaV1dIDogaXQsIGNoYW5nZS5pbmRleCwgY2hhbmdlLml0ZW0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdEJzpcbiAgICAgICAgICBkZWxldGUgaXRbY2hhbmdlLnBhdGhbaV1dO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFJzpcbiAgICAgICAgY2FzZSAnTic6XG4gICAgICAgICAgaXRbY2hhbmdlLnBhdGhbaV1dID0gY2hhbmdlLnJocztcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZXZlcnRBcnJheUNoYW5nZShhcnIsIGluZGV4LCBjaGFuZ2UpIHtcbiAgICBpZiAoY2hhbmdlLnBhdGggJiYgY2hhbmdlLnBhdGgubGVuZ3RoKSB7XG4gICAgICAvLyB0aGUgc3RydWN0dXJlIG9mIHRoZSBvYmplY3QgYXQgdGhlIGluZGV4IGhhcyBjaGFuZ2VkLi4uXG4gICAgICB2YXIgaXQgPSBhcnJbaW5kZXhdLFxuICAgICAgICBpLCB1ID0gY2hhbmdlLnBhdGgubGVuZ3RoIC0gMTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCB1OyBpKyspIHtcbiAgICAgICAgaXQgPSBpdFtjaGFuZ2UucGF0aFtpXV07XG4gICAgICB9XG4gICAgICBzd2l0Y2ggKGNoYW5nZS5raW5kKSB7XG4gICAgICAgIGNhc2UgJ0EnOlxuICAgICAgICAgIHJldmVydEFycmF5Q2hhbmdlKGl0W2NoYW5nZS5wYXRoW2ldXSwgY2hhbmdlLmluZGV4LCBjaGFuZ2UuaXRlbSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0QnOlxuICAgICAgICAgIGl0W2NoYW5nZS5wYXRoW2ldXSA9IGNoYW5nZS5saHM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0UnOlxuICAgICAgICAgIGl0W2NoYW5nZS5wYXRoW2ldXSA9IGNoYW5nZS5saHM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ04nOlxuICAgICAgICAgIGRlbGV0ZSBpdFtjaGFuZ2UucGF0aFtpXV07XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHRoZSBhcnJheSBpdGVtIGlzIGRpZmZlcmVudC4uLlxuICAgICAgc3dpdGNoIChjaGFuZ2Uua2luZCkge1xuICAgICAgICBjYXNlICdBJzpcbiAgICAgICAgICByZXZlcnRBcnJheUNoYW5nZShhcnJbaW5kZXhdLCBjaGFuZ2UuaW5kZXgsIGNoYW5nZS5pdGVtKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRCc6XG4gICAgICAgICAgYXJyW2luZGV4XSA9IGNoYW5nZS5saHM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0UnOlxuICAgICAgICAgIGFycltpbmRleF0gPSBjaGFuZ2UubGhzO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdOJzpcbiAgICAgICAgICBhcnIgPSBhcnJheVJlbW92ZShhcnIsIGluZGV4KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGFycjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJldmVydENoYW5nZSh0YXJnZXQsIHNvdXJjZSwgY2hhbmdlKSB7XG4gICAgaWYgKHRhcmdldCAmJiBzb3VyY2UgJiYgY2hhbmdlICYmIGNoYW5nZS5raW5kKSB7XG4gICAgICB2YXIgaXQgPSB0YXJnZXQsXG4gICAgICAgIGksIHU7XG4gICAgICB1ID0gY2hhbmdlLnBhdGgubGVuZ3RoIC0gMTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCB1OyBpKyspIHtcbiAgICAgICAgaWYgKHR5cGVvZiBpdFtjaGFuZ2UucGF0aFtpXV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgaXRbY2hhbmdlLnBhdGhbaV1dID0ge307XG4gICAgICAgIH1cbiAgICAgICAgaXQgPSBpdFtjaGFuZ2UucGF0aFtpXV07XG4gICAgICB9XG4gICAgICBzd2l0Y2ggKGNoYW5nZS5raW5kKSB7XG4gICAgICAgIGNhc2UgJ0EnOlxuICAgICAgICAgIC8vIEFycmF5IHdhcyBtb2RpZmllZC4uLlxuICAgICAgICAgIC8vIGl0IHdpbGwgYmUgYW4gYXJyYXkuLi5cbiAgICAgICAgICByZXZlcnRBcnJheUNoYW5nZShpdFtjaGFuZ2UucGF0aFtpXV0sIGNoYW5nZS5pbmRleCwgY2hhbmdlLml0ZW0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdEJzpcbiAgICAgICAgICAvLyBJdGVtIHdhcyBkZWxldGVkLi4uXG4gICAgICAgICAgaXRbY2hhbmdlLnBhdGhbaV1dID0gY2hhbmdlLmxocztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRSc6XG4gICAgICAgICAgLy8gSXRlbSB3YXMgZWRpdGVkLi4uXG4gICAgICAgICAgaXRbY2hhbmdlLnBhdGhbaV1dID0gY2hhbmdlLmxocztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnTic6XG4gICAgICAgICAgLy8gSXRlbSBpcyBuZXcuLi5cbiAgICAgICAgICBkZWxldGUgaXRbY2hhbmdlLnBhdGhbaV1dO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGFwcGx5RGlmZih0YXJnZXQsIHNvdXJjZSwgZmlsdGVyKSB7XG4gICAgaWYgKHRhcmdldCAmJiBzb3VyY2UpIHtcbiAgICAgIHZhciBvbkNoYW5nZSA9IGZ1bmN0aW9uKGNoYW5nZSkge1xuICAgICAgICBpZiAoIWZpbHRlciB8fCBmaWx0ZXIodGFyZ2V0LCBzb3VyY2UsIGNoYW5nZSkpIHtcbiAgICAgICAgICBhcHBseUNoYW5nZSh0YXJnZXQsIHNvdXJjZSwgY2hhbmdlKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGRlZXBEaWZmKHRhcmdldCwgc291cmNlLCBvbkNoYW5nZSk7XG4gICAgfVxuICB9XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoYWNjdW11bGF0ZURpZmYsIHtcblxuICAgIGRpZmY6IHtcbiAgICAgIHZhbHVlOiBhY2N1bXVsYXRlRGlmZixcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIG9ic2VydmFibGVEaWZmOiB7XG4gICAgICB2YWx1ZTogZGVlcERpZmYsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBhcHBseURpZmY6IHtcbiAgICAgIHZhbHVlOiBhcHBseURpZmYsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBhcHBseUNoYW5nZToge1xuICAgICAgdmFsdWU6IGFwcGx5Q2hhbmdlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgcmV2ZXJ0Q2hhbmdlOiB7XG4gICAgICB2YWx1ZTogcmV2ZXJ0Q2hhbmdlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgaXNDb25mbGljdDoge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBjb25mbGljdDtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBub0NvbmZsaWN0OiB7XG4gICAgICB2YWx1ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIGlmIChjb25mbGljdFJlc29sdXRpb24pIHtcbiAgICAgICAgICBjb25mbGljdFJlc29sdXRpb24uZm9yRWFjaChmdW5jdGlvbihpdCkge1xuICAgICAgICAgICAgaXQoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjb25mbGljdFJlc29sdXRpb24gPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhY2N1bXVsYXRlRGlmZjtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gYWNjdW11bGF0ZURpZmY7XG59KSk7XG4iLCJ2YXIgcGxhY2Vob2xkZXIgPSB7fSxcbiAgICBlbmRPZkFyZ3MgPSB7fSxcbiAgICBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsLmJpbmQoQXJyYXkucHJvdG90eXBlLnNsaWNlKTtcblxuZnVuY3Rpb24gc2h1dihmbil7XG4gICAgdmFyIG91dGVyQXJncyA9IHNsaWNlKGFyZ3VtZW50cywgMSk7XG5cbiAgICBpZih0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG9yIG5vbi1mdW5jdGlvbiBwYXNzZWQgdG8gc2h1dicpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbigpe1xuICAgICAgICB2YXIgY29udGV4dCA9IHRoaXMsXG4gICAgICAgICAgICBpbm5lckFyZ3MgPSBzbGljZShhcmd1bWVudHMpLFxuICAgICAgICAgICAgZmluYWxBcmdzID0gW10sXG4gICAgICAgICAgICBhcHBlbmQgPSB0cnVlO1xuXG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBvdXRlckFyZ3MubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgdmFyIG91dGVyQXJnID0gb3V0ZXJBcmdzW2ldO1xuXG4gICAgICAgICAgICBpZihvdXRlckFyZyA9PT0gZW5kT2ZBcmdzKXtcbiAgICAgICAgICAgICAgICBhcHBlbmQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYob3V0ZXJBcmcgPT09IHBsYWNlaG9sZGVyKXtcbiAgICAgICAgICAgICAgICBmaW5hbEFyZ3MucHVzaChpbm5lckFyZ3Muc2hpZnQoKSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZpbmFsQXJncy5wdXNoKG91dGVyQXJnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGFwcGVuZCl7XG4gICAgICAgICAgICBmaW5hbEFyZ3MgPSBmaW5hbEFyZ3MuY29uY2F0KGlubmVyQXJncyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZm4uYXBwbHkoY29udGV4dCwgZmluYWxBcmdzKTtcbiAgICB9O1xufVxuXG5zaHV2Ll8gPSBwbGFjZWhvbGRlcjtcbnNodXYuJCA9IGVuZE9mQXJncztcblxubW9kdWxlLmV4cG9ydHMgPSBzaHV2OyIsInZhciByZXZpdmUgPSByZXF1aXJlKCcuL3Jldml2ZScpO1xuXG5mdW5jdGlvbiBwYXJzZShqc29uLCByZXZpdmVyKXtcbiAgICByZXR1cm4gcmV2aXZlKEpTT04ucGFyc2UoanNvbiwgcmV2aXZlcikpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlOyIsInZhciBjcmVhdGVLZXkgPSByZXF1aXJlKCcuL2NyZWF0ZUtleScpLFxuICAgIGtleUtleSA9IGNyZWF0ZUtleSgtMSk7XG5cbmZ1bmN0aW9uIHJldml2ZShpbnB1dCl7XG4gICAgdmFyIG9iamVjdHMgPSB7fSxcbiAgICAgICAgc2Nhbm5lZE9iamVjdHMgPSBbXTtcblxuICAgIGZ1bmN0aW9uIHNjYW4oaW5wdXQpe1xuICAgICAgICB2YXIgb3V0cHV0ID0gaW5wdXQ7XG5cbiAgICAgICAgaWYodHlwZW9mIG91dHB1dCAhPT0gJ29iamVjdCcpe1xuICAgICAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICAgICAgfVxuXG4gICAgICAgIG91dHB1dCA9IGlucHV0IGluc3RhbmNlb2YgQXJyYXkgPyBbXSA6IHt9O1xuXG4gICAgICAgIGlmKGlucHV0W2tleUtleV0pe1xuICAgICAgICAgICAgb2JqZWN0c1tpbnB1dFtrZXlLZXldXSA9IG91dHB1dDtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvcih2YXIga2V5IGluIGlucHV0KXtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IGlucHV0W2tleV07XG5cbiAgICAgICAgICAgIGlmKGtleSA9PT0ga2V5S2V5KXtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYodmFsdWUgIT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKXtcbiAgICAgICAgICAgICAgICBpZihzY2FubmVkT2JqZWN0cy5pbmRleE9mKHZhbHVlKTwwKXtcbiAgICAgICAgICAgICAgICAgICAgc2Nhbm5lZE9iamVjdHMucHVzaCh2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dFtrZXldID0gc2Nhbih2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfWVsc2UgaWYodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJyAmJiB2YWx1ZS5sZW5ndGggPT09IDEgJiYgdmFsdWUuY2hhckNvZGVBdCgwKSA+IGtleUtleS5jaGFyQ29kZUF0KDApKXtcbiAgICAgICAgICAgICAgICBvdXRwdXRba2V5XSA9IG9iamVjdHNbdmFsdWVdIHx8IGlucHV0W2tleV07XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICBvdXRwdXRba2V5XSA9IGlucHV0W2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICBpZighaW5wdXQgfHwgdHlwZW9mIGlucHV0ICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHJldHVybiBpbnB1dDtcbiAgICB9XG5cbiAgICByZXR1cm4gc2NhbihpbnB1dCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcmV2aXZlOyIsIm1vZHVsZS5leHBvcnRzID0ge1xuICAgIHN0cmluZ2lmeTogcmVxdWlyZSgnLi9zdHJpbmdpZnknKSxcbiAgICBwYXJzZTogcmVxdWlyZSgnLi9wYXJzZScpLFxuICAgIHJldml2ZTogcmVxdWlyZSgnLi9yZXZpdmUnKVxufTsiLCJ2YXIgY3JlYXRlS2V5ID0gcmVxdWlyZSgnLi9jcmVhdGVLZXknKSxcbiAgICBrZXlLZXkgPSBjcmVhdGVLZXkoLTEpO1xuXG5mdW5jdGlvbiB0b0pzb25WYWx1ZSh2YWx1ZSl7XG4gICAgaWYodmFsdWUgIT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKXtcbiAgICAgICAgdmFyIHJlc3VsdCA9IHZhbHVlIGluc3RhbmNlb2YgQXJyYXkgPyBbXSA6IHt9LFxuICAgICAgICAgICAgb3V0cHV0ID0gdmFsdWU7XG4gICAgICAgIGlmKCd0b0pTT04nIGluIHZhbHVlKXtcbiAgICAgICAgICAgIG91dHB1dCA9IHZhbHVlLnRvSlNPTigpO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIga2V5IGluIG91dHB1dCl7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IG91dHB1dFtrZXldO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHZhbHVlO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnkoaW5wdXQsIHJlcGxhY2VyLCBzcGFjZXIpe1xuICAgIHZhciBvYmplY3RzID0gW10sXG4gICAgICAgIG91dHB1dE9iamVjdHMgPSBbXSxcbiAgICAgICAgcmVmcyA9IFtdO1xuXG4gICAgZnVuY3Rpb24gc2NhbihpbnB1dCl7XG5cbiAgICAgICAgaWYoaW5wdXQgPT09IG51bGwgfHwgdHlwZW9mIGlucHV0ICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgICAgICByZXR1cm4gaW5wdXQ7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb3V0cHV0LFxuICAgICAgICAgICAgaW5kZXggPSBvYmplY3RzLmluZGV4T2YoaW5wdXQpO1xuXG4gICAgICAgIGlmKGluZGV4ID49IDApe1xuICAgICAgICAgICAgb3V0cHV0T2JqZWN0c1tpbmRleF1ba2V5S2V5XSA9IHJlZnNbaW5kZXhdXG4gICAgICAgICAgICByZXR1cm4gcmVmc1tpbmRleF07XG4gICAgICAgIH1cblxuICAgICAgICBpbmRleCA9IG9iamVjdHMubGVuZ3RoO1xuICAgICAgICBvYmplY3RzW2luZGV4XSA9IGlucHV0O1xuICAgICAgICBvdXRwdXQgPSB0b0pzb25WYWx1ZShpbnB1dCk7XG4gICAgICAgIG91dHB1dE9iamVjdHNbaW5kZXhdID0gb3V0cHV0O1xuICAgICAgICByZWZzW2luZGV4XSA9IGNyZWF0ZUtleShpbmRleCk7XG5cbiAgICAgICAgZm9yKHZhciBrZXkgaW4gb3V0cHV0KXtcbiAgICAgICAgICAgIG91dHB1dFtrZXldID0gc2NhbihvdXRwdXRba2V5XSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3V0cHV0O1xuICAgIH1cblxuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShzY2FuKGlucHV0KSwgcmVwbGFjZXIsIHNwYWNlcik7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc3RyaW5naWZ5OyJdfQ==
