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
    handleInvoke: function(callback){
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

module.exports = lenze;
},{"../../":4}],4:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92NS4zLjAvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y1LjMuMC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9ldmVudHMvZXZlbnRzLmpzIiwiY3JlYXRlS2V5LmpzIiwiZXhhbXBsZS9hcHAvYXBwLmpzIiwiaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVlcC1kaWZmL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3NodXYvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc3RhdGhhbS9wYXJzZS5qcyIsIm5vZGVfbW9kdWxlcy9zdGF0aGFtL3Jldml2ZS5qcyIsIm5vZGVfbW9kdWxlcy9zdGF0aGFtL3N0YXRoYW0uanMiLCJub2RlX21vZHVsZXMvc3RhdGhhbS9zdHJpbmdpZnkuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUM1SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ25aQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiZnVuY3Rpb24gZXNjYXBlSGV4KGhleCl7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoaGV4KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlS2V5KG51bWJlcil7XG4gICAgaWYobnVtYmVyICsgMHhFMDAxID4gMHhGRkZGKXtcbiAgICAgICAgdGhyb3cgXCJUb28gbWFueSByZWZlcmVuY2VzLiBMb2cgYW4gaXNzdWUgb24gZ2lodWIgYW4gaSdsbCBhZGQgYW4gb3JkZXIgb2YgbWFnbmF0dWRlIHRvIHRoZSBrZXlzLlwiO1xuICAgIH1cbiAgICByZXR1cm4gZXNjYXBlSGV4KG51bWJlciArIDB4RTAwMSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlS2V5OyIsInZhciBsZW56ZSA9IHJlcXVpcmUoJy4uLy4uLycpKHtcbiAgICBjaGFuZ2VJbnRlcnZhbDogMTYsXG4gICAgc2VuZDogZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIHNlbGYucG9zdE1lc3NhZ2UoZGF0YSk7XG4gICAgfSxcbiAgICBoYW5kbGVJbnZva2U6IGZ1bmN0aW9uKGNhbGxiYWNrKXtcbiAgICAgICAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24obWVzc2FnZSl7XG4gICAgICAgICAgICBjYWxsYmFjayhtZXNzYWdlLmRhdGEpO1xuICAgICAgICB9KTtcbiAgICB9XG59KTtcblxudmFyIHN0YXRlID0gbGVuemUuc3RhdGU7XG5cbnN0YXRlLnNldEhlYWRpbmcgPSBmdW5jdGlvbih2YWx1ZSl7XG4gICAgc3RhdGUuaGVhZGluZyA9ICdIZWxsbyAnICsgKHZhbHVlIHx8ICdXb3JsZCcpO1xufTtcbnN0YXRlLnNldEhlYWRpbmcoKTtcblxuc3RhdGUub2JqcyA9IFtdO1xuc3RhdGUueCA9IHt9O1xuc3RhdGUueSA9IHN0YXRlLng7XG5cbnNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICBzdGF0ZS56ID0gc3RhdGUueDtcbn0sIDEwMDApO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGxlbnplOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICBkaWZmID0gcmVxdWlyZSgnZGVlcC1kaWZmJyksXG4gICAgc2h1diA9IHJlcXVpcmUoJ3NodXYnKSxcbiAgICBzdGF0aGFtID0gcmVxdWlyZSgnc3RhdGhhbScpLFxuICAgIGNyZWF0ZUtleSA9IHJlcXVpcmUoJy4vY3JlYXRlS2V5JyksXG4gICAga2V5S2V5ID0gY3JlYXRlS2V5KC0yKTtcblxuZnVuY3Rpb24gYXBwbHlDaGFuZ2VzKHRhcmdldCwgY2hhbmdlcyl7XG4gICAgY2hhbmdlcy5mb3JFYWNoKGZ1bmN0aW9uKGNoYW5nZSl7XG4gICAgICAgIGRpZmYuYXBwbHlDaGFuZ2UodGFyZ2V0LCB0cnVlICwgY2hhbmdlKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ2hhbmdlcyhzY29wZSwgY2hhbmdlcyl7XG4gICAgY2hhbmdlcyA9IGNoYW5nZXMubWFwKGZ1bmN0aW9uKGNoYW5nZSl7XG4gICAgICAgIHZhciB2YWx1ZSA9IGNoYW5nZS5yaHM7XG5cbiAgICAgICAgaWYodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jyl7XG4gICAgICAgICAgICBpZighdmFsdWVba2V5S2V5XSl7XG4gICAgICAgICAgICAgICAgdmFsdWVba2V5S2V5XSA9IGNyZWF0ZUtleShzY29wZS5pbnN0YW5jZUlkcysrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyl7XG4gICAgICAgICAgICB2YXIgaWQgPSB2YWx1ZVtrZXlLZXldO1xuXG4gICAgICAgICAgICBpZihpZCA9PSBudWxsKXtcbiAgICAgICAgICAgICAgICBpZCA9IHZhbHVlW2tleUtleV0gPSBjcmVhdGVLZXkoc2NvcGUuaW5zdGFuY2VJZHMrKyk7XG4gICAgICAgICAgICAgICAgc2NvcGUuZnVuY3Rpb25zW2lkXSA9IHtcbiAgICAgICAgICAgICAgICAgICAgZm46IHZhbHVlLFxuICAgICAgICAgICAgICAgICAgICBjb3VudDogMFxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNoYW5nZS5yaHMgPSB7J0xFTlpFX0ZVTkNUSU9OJzogaWR9O1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGNoYW5nZTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzdGF0aGFtLnN0cmluZ2lmeShjaGFuZ2VzKTtcbn1cblxuZnVuY3Rpb24gaGFuZGxlSW52b2tlKHNjb3BlLCBkYXRhKXtcbiAgICB2YXIgaW52b2tlID0gZGF0YS5tYXRjaCgvXmludm9rZVxcOiguKikvKTtcblxuICAgIGlmKGludm9rZSl7XG4gICAgICAgIHNjb3BlLmhhbmRsZUZ1bmN0aW9uLmFwcGx5KG51bGwsIHN0YXRoYW0ucGFyc2UoaW52b2tlWzFdKSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpbmZsYXRlQ2hhbmdlcyhzY29wZSwgZGF0YSl7XG4gICAgcmV0dXJuIHN0YXRoYW0ucGFyc2UoZGF0YSkubWFwKGZ1bmN0aW9uKGNoYW5nZSl7XG4gICAgICAgIHZhciB2YWx1ZSA9IGNoYW5nZS5yaHM7XG5cbiAgICAgICAgaWYodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jyl7XG4gICAgICAgICAgICBpZih2YWx1ZVtrZXlLZXldKXtcbiAgICAgICAgICAgICAgICB2YXIgaWQgPSB2YWx1ZVtrZXlLZXldO1xuICAgICAgICAgICAgICAgIGlmKCFzY29wZS5pbnN0YW5jZUhhc2hbaWRdKXtcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUuaW5zdGFuY2VIYXNoW2lkXSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNoYW5nZS5yaHMgPSBzY29wZS5pbnN0YW5jZUhhc2hbaWRdO1xuICAgICAgICAgICAgfWVsc2UgaWYoJ0xFTlpFX0ZVTkNUSU9OJyBpbiB2YWx1ZSl7XG4gICAgICAgICAgICAgICAgY2hhbmdlLnJocyA9IHNjb3BlLmludm9rZS5iaW5kKHRoaXMsIHZhbHVlWydMRU5aRV9GVU5DVElPTiddKTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBkZWxldGUgdmFsdWVba2V5S2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjaGFuZ2U7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZShzY29wZSl7XG4gICAgdmFyIGNoYW5nZXMgPSBkaWZmKHNjb3BlLm9yaWdpbmFsLCBzY29wZS5sZW56ZS5zdGF0ZSk7XG5cbiAgICBpZihjaGFuZ2VzKXtcbiAgICAgICAgc2NvcGUubGVuemUuZW1pdCgnY2hhbmdlJywgY2hhbmdlcyk7XG4gICAgICAgIGFwcGx5Q2hhbmdlcyhzY29wZS5vcmlnaW5hbCwgY2hhbmdlcyk7XG4gICAgICAgIGlmKHNjb3BlLnNlbmQpe1xuICAgICAgICAgICAgc2NvcGUuc2VuZChjaGFuZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlRnVuY3Rpb24oc2NvcGUsIGlkKXtcbiAgICBzY29wZS5mdW5jdGlvbnNbaWRdLmZuLmFwcGx5KHRoaXMsIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMikpO1xufVxuXG5mdW5jdGlvbiBzZW5kKHNjb3BlLCBzZW5kLCBjaGFuZ2VzKXtcbiAgICBzZW5kKCdjaGFuZ2VzOicgKyBjcmVhdGVDaGFuZ2VzKHNjb3BlLCBjaGFuZ2VzKSk7XG59XG5cbmZ1bmN0aW9uIHNlbmRJbnZva2Uoc2NvcGUsIHNlbmRJbnZva2Upe1xuICAgIHNlbmRJbnZva2UoJ2ludm9rZTonICsgc3RhdGhhbS5zdHJpbmdpZnkoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSkpO1xufVxuXG5mdW5jdGlvbiBpbml0U2NvcGUoc2V0dGluZ3Mpe1xuICAgIGlmKCFzZXR0aW5ncyl7XG4gICAgICAgIHNldHRpbmdzID0ge307XG4gICAgfVxuXG4gICAgdmFyIGxlbnplID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICAgIHZhciBzY29wZSA9IHtcbiAgICAgICAgZnVuY3Rpb25zOiB7fSxcbiAgICAgICAgaW5zdGFuY2VJZHM6IDAsXG4gICAgICAgIGxlbnplOiBsZW56ZSxcbiAgICAgICAgb3JpZ2luYWw6IHt9XG4gICAgfTtcblxuICAgIGxlbnplLnVwZGF0ZSA9IHNodXYodXBkYXRlLCBzY29wZSk7XG4gICAgbGVuemUuc3RhdGUgPSB7fTtcblxuICAgIHJldHVybiBzY29wZTtcbn1cblxuZnVuY3Rpb24gaW5pdChzZXR0aW5ncyl7XG4gICAgdmFyIHNjb3BlID0gaW5pdFNjb3BlKHNldHRpbmdzKTtcblxuICAgIHNjb3BlLmhhbmRsZUZ1bmN0aW9uID0gc2h1dihoYW5kbGVGdW5jdGlvbiwgc2NvcGUpO1xuICAgIHNjb3BlLnNlbmQgPSBzaHV2KHNlbmQsIHNjb3BlLCBzZXR0aW5ncy5zZW5kKTtcbiAgICBzZXR0aW5ncy5oYW5kbGVJbnZva2Uoc2h1dihoYW5kbGVJbnZva2UsIHNjb3BlKSk7XG5cbiAgICBzZXRJbnRlcnZhbChzY29wZS5sZW56ZS51cGRhdGUsIHNldHRpbmdzLmNoYW5nZUludGVydmFsIHx8IDEwMCk7XG5cbiAgICByZXR1cm4gc2NvcGUubGVuemU7XG59XG5cbmZ1bmN0aW9uIHJlcGxpY2FudChzZXR0aW5ncyl7XG4gICAgdmFyIHNjb3BlID0gaW5pdFNjb3BlKCk7XG5cbiAgICBzY29wZS5pbnN0YW5jZUhhc2ggPSB7fTtcblxuICAgIHNldHRpbmdzLnJlY2lldmUoZnVuY3Rpb24oZGF0YSl7XG4gICAgICAgIGlmKCFzY29wZS5yZWFkeSl7XG4gICAgICAgICAgICBzY29wZS5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBzY29wZS5sZW56ZS5lbWl0KCdyZWFkeScpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNoYW5nZXMgPSBkYXRhLm1hdGNoKC9eY2hhbmdlc1xcOiguKikvKTtcblxuICAgICAgICBpZihjaGFuZ2VzKXtcbiAgICAgICAgICAgIGFwcGx5Q2hhbmdlcyhzY29wZS5sZW56ZS5zdGF0ZSwgaW5mbGF0ZUNoYW5nZXMoc2NvcGUsIGNoYW5nZXNbMV0pKTtcbiAgICAgICAgICAgIHVwZGF0ZShzY29wZSk7XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHNjb3BlLmludm9rZSA9IHNodXYoc2VuZEludm9rZSwgc2NvcGUsIHNldHRpbmdzLmludm9rZSk7XG5cbiAgICByZXR1cm4gc2NvcGUubGVuemVcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xubW9kdWxlLmV4cG9ydHMucmVwbGljYW50ID0gcmVwbGljYW50O1xuIiwiLyohXG4gKiBkZWVwLWRpZmYuXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuXG4gKi9cbjsoZnVuY3Rpb24ocm9vdCwgZmFjdG9yeSkge1xuICAndXNlIHN0cmljdCc7XG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAvLyBBTUQuIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBtb2R1bGUuXG4gICAgZGVmaW5lKFtdLCBmYWN0b3J5KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBOb2RlLiBEb2VzIG5vdCB3b3JrIHdpdGggc3RyaWN0IENvbW1vbkpTLCBidXRcbiAgICAvLyBvbmx5IENvbW1vbkpTLWxpa2UgZW52aXJvbm1lbnRzIHRoYXQgc3VwcG9ydCBtb2R1bGUuZXhwb3J0cyxcbiAgICAvLyBsaWtlIE5vZGUuXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gQnJvd3NlciBnbG9iYWxzIChyb290IGlzIHdpbmRvdylcbiAgICByb290LkRlZXBEaWZmID0gZmFjdG9yeSgpO1xuICB9XG59KHRoaXMsIGZ1bmN0aW9uKHVuZGVmaW5lZCkge1xuICAndXNlIHN0cmljdCc7XG5cbiAgdmFyICRzY29wZSwgY29uZmxpY3QsIGNvbmZsaWN0UmVzb2x1dGlvbiA9IFtdO1xuICBpZiAodHlwZW9mIGdsb2JhbCA9PT0gJ29iamVjdCcgJiYgZ2xvYmFsKSB7XG4gICAgJHNjb3BlID0gZ2xvYmFsO1xuICB9IGVsc2UgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgJHNjb3BlID0gd2luZG93O1xuICB9IGVsc2Uge1xuICAgICRzY29wZSA9IHt9O1xuICB9XG4gIGNvbmZsaWN0ID0gJHNjb3BlLkRlZXBEaWZmO1xuICBpZiAoY29uZmxpY3QpIHtcbiAgICBjb25mbGljdFJlc29sdXRpb24ucHVzaChcbiAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoJ3VuZGVmaW5lZCcgIT09IHR5cGVvZiBjb25mbGljdCAmJiAkc2NvcGUuRGVlcERpZmYgPT09IGFjY3VtdWxhdGVEaWZmKSB7XG4gICAgICAgICAgJHNjb3BlLkRlZXBEaWZmID0gY29uZmxpY3Q7XG4gICAgICAgICAgY29uZmxpY3QgPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgLy8gbm9kZWpzIGNvbXBhdGlibGUgb24gc2VydmVyIHNpZGUgYW5kIGluIHRoZSBicm93c2VyLlxuICBmdW5jdGlvbiBpbmhlcml0cyhjdG9yLCBzdXBlckN0b3IpIHtcbiAgICBjdG9yLnN1cGVyXyA9IHN1cGVyQ3RvcjtcbiAgICBjdG9yLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDdG9yLnByb3RvdHlwZSwge1xuICAgICAgY29uc3RydWN0b3I6IHtcbiAgICAgICAgdmFsdWU6IGN0b3IsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBEaWZmKGtpbmQsIHBhdGgpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2tpbmQnLCB7XG4gICAgICB2YWx1ZToga2luZCxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBpZiAocGF0aCAmJiBwYXRoLmxlbmd0aCkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdwYXRoJywge1xuICAgICAgICB2YWx1ZTogcGF0aCxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gRGlmZkVkaXQocGF0aCwgb3JpZ2luLCB2YWx1ZSkge1xuICAgIERpZmZFZGl0LnN1cGVyXy5jYWxsKHRoaXMsICdFJywgcGF0aCk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdsaHMnLCB7XG4gICAgICB2YWx1ZTogb3JpZ2luLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAncmhzJywge1xuICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICB9XG4gIGluaGVyaXRzKERpZmZFZGl0LCBEaWZmKTtcblxuICBmdW5jdGlvbiBEaWZmTmV3KHBhdGgsIHZhbHVlKSB7XG4gICAgRGlmZk5ldy5zdXBlcl8uY2FsbCh0aGlzLCAnTicsIHBhdGgpO1xuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCAncmhzJywge1xuICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0pO1xuICB9XG4gIGluaGVyaXRzKERpZmZOZXcsIERpZmYpO1xuXG4gIGZ1bmN0aW9uIERpZmZEZWxldGVkKHBhdGgsIHZhbHVlKSB7XG4gICAgRGlmZkRlbGV0ZWQuc3VwZXJfLmNhbGwodGhpcywgJ0QnLCBwYXRoKTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2xocycsIHtcbiAgICAgIHZhbHVlOiB2YWx1ZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgfVxuICBpbmhlcml0cyhEaWZmRGVsZXRlZCwgRGlmZik7XG5cbiAgZnVuY3Rpb24gRGlmZkFycmF5KHBhdGgsIGluZGV4LCBpdGVtKSB7XG4gICAgRGlmZkFycmF5LnN1cGVyXy5jYWxsKHRoaXMsICdBJywgcGF0aCk7XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpbmRleCcsIHtcbiAgICAgIHZhbHVlOiBpbmRleCxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ2l0ZW0nLCB7XG4gICAgICB2YWx1ZTogaXRlbSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9KTtcbiAgfVxuICBpbmhlcml0cyhEaWZmQXJyYXksIERpZmYpO1xuXG4gIGZ1bmN0aW9uIGFycmF5UmVtb3ZlKGFyciwgZnJvbSwgdG8pIHtcbiAgICB2YXIgcmVzdCA9IGFyci5zbGljZSgodG8gfHwgZnJvbSkgKyAxIHx8IGFyci5sZW5ndGgpO1xuICAgIGFyci5sZW5ndGggPSBmcm9tIDwgMCA/IGFyci5sZW5ndGggKyBmcm9tIDogZnJvbTtcbiAgICBhcnIucHVzaC5hcHBseShhcnIsIHJlc3QpO1xuICAgIHJldHVybiBhcnI7XG4gIH1cblxuICBmdW5jdGlvbiByZWFsVHlwZU9mKHN1YmplY3QpIHtcbiAgICB2YXIgdHlwZSA9IHR5cGVvZiBzdWJqZWN0O1xuICAgIGlmICh0eXBlICE9PSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIHR5cGU7XG4gICAgfVxuXG4gICAgaWYgKHN1YmplY3QgPT09IE1hdGgpIHtcbiAgICAgIHJldHVybiAnbWF0aCc7XG4gICAgfSBlbHNlIGlmIChzdWJqZWN0ID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gJ251bGwnO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShzdWJqZWN0KSkge1xuICAgICAgcmV0dXJuICdhcnJheSc7XG4gICAgfSBlbHNlIGlmIChzdWJqZWN0IGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgcmV0dXJuICdkYXRlJztcbiAgICB9IGVsc2UgaWYgKC9eXFwvLipcXC8vLnRlc3Qoc3ViamVjdC50b1N0cmluZygpKSkge1xuICAgICAgcmV0dXJuICdyZWdleHAnO1xuICAgIH1cbiAgICByZXR1cm4gJ29iamVjdCc7XG4gIH1cblxuICBmdW5jdGlvbiBkZWVwRGlmZihsaHMsIHJocywgY2hhbmdlcywgcHJlZmlsdGVyLCBwYXRoLCBrZXksIHN0YWNrKSB7XG4gICAgcGF0aCA9IHBhdGggfHwgW107XG4gICAgdmFyIGN1cnJlbnRQYXRoID0gcGF0aC5zbGljZSgwKTtcbiAgICBpZiAodHlwZW9mIGtleSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGlmIChwcmVmaWx0ZXIgJiYgcHJlZmlsdGVyKGN1cnJlbnRQYXRoLCBrZXksIHsgbGhzOiBsaHMsIHJoczogcmhzIH0pKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGN1cnJlbnRQYXRoLnB1c2goa2V5KTtcbiAgICB9XG4gICAgdmFyIGx0eXBlID0gdHlwZW9mIGxocztcbiAgICB2YXIgcnR5cGUgPSB0eXBlb2YgcmhzO1xuICAgIGlmIChsdHlwZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGlmIChydHlwZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgY2hhbmdlcyhuZXcgRGlmZk5ldyhjdXJyZW50UGF0aCwgcmhzKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChydHlwZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIGNoYW5nZXMobmV3IERpZmZEZWxldGVkKGN1cnJlbnRQYXRoLCBsaHMpKTtcbiAgICB9IGVsc2UgaWYgKHJlYWxUeXBlT2YobGhzKSAhPT0gcmVhbFR5cGVPZihyaHMpKSB7XG4gICAgICBjaGFuZ2VzKG5ldyBEaWZmRWRpdChjdXJyZW50UGF0aCwgbGhzLCByaHMpKTtcbiAgICB9IGVsc2UgaWYgKGxocyBpbnN0YW5jZW9mIERhdGUgJiYgcmhzIGluc3RhbmNlb2YgRGF0ZSAmJiAoKGxocyAtIHJocykgIT09IDApKSB7XG4gICAgICBjaGFuZ2VzKG5ldyBEaWZmRWRpdChjdXJyZW50UGF0aCwgbGhzLCByaHMpKTtcbiAgICB9IGVsc2UgaWYgKGx0eXBlID09PSAnb2JqZWN0JyAmJiBsaHMgIT09IG51bGwgJiYgcmhzICE9PSBudWxsKSB7XG4gICAgICBzdGFjayA9IHN0YWNrIHx8IFtdO1xuICAgICAgaWYgKHN0YWNrLmluZGV4T2YobGhzKSA8IDApIHtcbiAgICAgICAgc3RhY2sucHVzaChsaHMpO1xuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShsaHMpKSB7XG4gICAgICAgICAgdmFyIGksIGxlbiA9IGxocy5sZW5ndGg7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IGxocy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGkgPj0gcmhzLmxlbmd0aCkge1xuICAgICAgICAgICAgICBjaGFuZ2VzKG5ldyBEaWZmQXJyYXkoY3VycmVudFBhdGgsIGksIG5ldyBEaWZmRGVsZXRlZCh1bmRlZmluZWQsIGxoc1tpXSkpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGRlZXBEaWZmKGxoc1tpXSwgcmhzW2ldLCBjaGFuZ2VzLCBwcmVmaWx0ZXIsIGN1cnJlbnRQYXRoLCBpLCBzdGFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHdoaWxlIChpIDwgcmhzLmxlbmd0aCkge1xuICAgICAgICAgICAgY2hhbmdlcyhuZXcgRGlmZkFycmF5KGN1cnJlbnRQYXRoLCBpLCBuZXcgRGlmZk5ldyh1bmRlZmluZWQsIHJoc1tpKytdKSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgYWtleXMgPSBPYmplY3Qua2V5cyhsaHMpO1xuICAgICAgICAgIHZhciBwa2V5cyA9IE9iamVjdC5rZXlzKHJocyk7XG4gICAgICAgICAgYWtleXMuZm9yRWFjaChmdW5jdGlvbihrLCBpKSB7XG4gICAgICAgICAgICB2YXIgb3RoZXIgPSBwa2V5cy5pbmRleE9mKGspO1xuICAgICAgICAgICAgaWYgKG90aGVyID49IDApIHtcbiAgICAgICAgICAgICAgZGVlcERpZmYobGhzW2tdLCByaHNba10sIGNoYW5nZXMsIHByZWZpbHRlciwgY3VycmVudFBhdGgsIGssIHN0YWNrKTtcbiAgICAgICAgICAgICAgcGtleXMgPSBhcnJheVJlbW92ZShwa2V5cywgb3RoZXIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZGVlcERpZmYobGhzW2tdLCB1bmRlZmluZWQsIGNoYW5nZXMsIHByZWZpbHRlciwgY3VycmVudFBhdGgsIGssIHN0YWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBwa2V5cy5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgICAgICAgIGRlZXBEaWZmKHVuZGVmaW5lZCwgcmhzW2tdLCBjaGFuZ2VzLCBwcmVmaWx0ZXIsIGN1cnJlbnRQYXRoLCBrLCBzdGFjayk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgc3RhY2subGVuZ3RoID0gc3RhY2subGVuZ3RoIC0gMTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGxocyAhPT0gcmhzKSB7XG4gICAgICBpZiAoIShsdHlwZSA9PT0gJ251bWJlcicgJiYgaXNOYU4obGhzKSAmJiBpc05hTihyaHMpKSkge1xuICAgICAgICBjaGFuZ2VzKG5ldyBEaWZmRWRpdChjdXJyZW50UGF0aCwgbGhzLCByaHMpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBhY2N1bXVsYXRlRGlmZihsaHMsIHJocywgcHJlZmlsdGVyLCBhY2N1bSkge1xuICAgIGFjY3VtID0gYWNjdW0gfHwgW107XG4gICAgZGVlcERpZmYobGhzLCByaHMsXG4gICAgICBmdW5jdGlvbihkaWZmKSB7XG4gICAgICAgIGlmIChkaWZmKSB7XG4gICAgICAgICAgYWNjdW0ucHVzaChkaWZmKTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIHByZWZpbHRlcik7XG4gICAgcmV0dXJuIChhY2N1bS5sZW5ndGgpID8gYWNjdW0gOiB1bmRlZmluZWQ7XG4gIH1cblxuICBmdW5jdGlvbiBhcHBseUFycmF5Q2hhbmdlKGFyciwgaW5kZXgsIGNoYW5nZSkge1xuICAgIGlmIChjaGFuZ2UucGF0aCAmJiBjaGFuZ2UucGF0aC5sZW5ndGgpIHtcbiAgICAgIHZhciBpdCA9IGFycltpbmRleF0sXG4gICAgICAgIGksIHUgPSBjaGFuZ2UucGF0aC5sZW5ndGggLSAxO1xuICAgICAgZm9yIChpID0gMDsgaSA8IHU7IGkrKykge1xuICAgICAgICBpdCA9IGl0W2NoYW5nZS5wYXRoW2ldXTtcbiAgICAgIH1cbiAgICAgIHN3aXRjaCAoY2hhbmdlLmtpbmQpIHtcbiAgICAgICAgY2FzZSAnQSc6XG4gICAgICAgICAgYXBwbHlBcnJheUNoYW5nZShpdFtjaGFuZ2UucGF0aFtpXV0sIGNoYW5nZS5pbmRleCwgY2hhbmdlLml0ZW0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdEJzpcbiAgICAgICAgICBkZWxldGUgaXRbY2hhbmdlLnBhdGhbaV1dO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFJzpcbiAgICAgICAgY2FzZSAnTic6XG4gICAgICAgICAgaXRbY2hhbmdlLnBhdGhbaV1dID0gY2hhbmdlLnJocztcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3dpdGNoIChjaGFuZ2Uua2luZCkge1xuICAgICAgICBjYXNlICdBJzpcbiAgICAgICAgICBhcHBseUFycmF5Q2hhbmdlKGFycltpbmRleF0sIGNoYW5nZS5pbmRleCwgY2hhbmdlLml0ZW0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdEJzpcbiAgICAgICAgICBhcnIgPSBhcnJheVJlbW92ZShhcnIsIGluZGV4KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRSc6XG4gICAgICAgIGNhc2UgJ04nOlxuICAgICAgICAgIGFycltpbmRleF0gPSBjaGFuZ2UucmhzO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXJyO1xuICB9XG5cbiAgZnVuY3Rpb24gYXBwbHlDaGFuZ2UodGFyZ2V0LCBzb3VyY2UsIGNoYW5nZSkge1xuICAgIGlmICh0YXJnZXQgJiYgc291cmNlICYmIGNoYW5nZSAmJiBjaGFuZ2Uua2luZCkge1xuICAgICAgdmFyIGl0ID0gdGFyZ2V0LFxuICAgICAgICBpID0gLTEsXG4gICAgICAgIGxhc3QgPSBjaGFuZ2UucGF0aCA/IGNoYW5nZS5wYXRoLmxlbmd0aCAtIDEgOiAwO1xuICAgICAgd2hpbGUgKCsraSA8IGxhc3QpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBpdFtjaGFuZ2UucGF0aFtpXV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgaXRbY2hhbmdlLnBhdGhbaV1dID0gKHR5cGVvZiBjaGFuZ2UucGF0aFtpXSA9PT0gJ251bWJlcicpID8gW10gOiB7fTtcbiAgICAgICAgfVxuICAgICAgICBpdCA9IGl0W2NoYW5nZS5wYXRoW2ldXTtcbiAgICAgIH1cbiAgICAgIHN3aXRjaCAoY2hhbmdlLmtpbmQpIHtcbiAgICAgICAgY2FzZSAnQSc6XG4gICAgICAgICAgYXBwbHlBcnJheUNoYW5nZShjaGFuZ2UucGF0aCA/IGl0W2NoYW5nZS5wYXRoW2ldXSA6IGl0LCBjaGFuZ2UuaW5kZXgsIGNoYW5nZS5pdGVtKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRCc6XG4gICAgICAgICAgZGVsZXRlIGl0W2NoYW5nZS5wYXRoW2ldXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRSc6XG4gICAgICAgIGNhc2UgJ04nOlxuICAgICAgICAgIGl0W2NoYW5nZS5wYXRoW2ldXSA9IGNoYW5nZS5yaHM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmV2ZXJ0QXJyYXlDaGFuZ2UoYXJyLCBpbmRleCwgY2hhbmdlKSB7XG4gICAgaWYgKGNoYW5nZS5wYXRoICYmIGNoYW5nZS5wYXRoLmxlbmd0aCkge1xuICAgICAgLy8gdGhlIHN0cnVjdHVyZSBvZiB0aGUgb2JqZWN0IGF0IHRoZSBpbmRleCBoYXMgY2hhbmdlZC4uLlxuICAgICAgdmFyIGl0ID0gYXJyW2luZGV4XSxcbiAgICAgICAgaSwgdSA9IGNoYW5nZS5wYXRoLmxlbmd0aCAtIDE7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgdTsgaSsrKSB7XG4gICAgICAgIGl0ID0gaXRbY2hhbmdlLnBhdGhbaV1dO1xuICAgICAgfVxuICAgICAgc3dpdGNoIChjaGFuZ2Uua2luZCkge1xuICAgICAgICBjYXNlICdBJzpcbiAgICAgICAgICByZXZlcnRBcnJheUNoYW5nZShpdFtjaGFuZ2UucGF0aFtpXV0sIGNoYW5nZS5pbmRleCwgY2hhbmdlLml0ZW0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdEJzpcbiAgICAgICAgICBpdFtjaGFuZ2UucGF0aFtpXV0gPSBjaGFuZ2UubGhzO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFJzpcbiAgICAgICAgICBpdFtjaGFuZ2UucGF0aFtpXV0gPSBjaGFuZ2UubGhzO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdOJzpcbiAgICAgICAgICBkZWxldGUgaXRbY2hhbmdlLnBhdGhbaV1dO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyB0aGUgYXJyYXkgaXRlbSBpcyBkaWZmZXJlbnQuLi5cbiAgICAgIHN3aXRjaCAoY2hhbmdlLmtpbmQpIHtcbiAgICAgICAgY2FzZSAnQSc6XG4gICAgICAgICAgcmV2ZXJ0QXJyYXlDaGFuZ2UoYXJyW2luZGV4XSwgY2hhbmdlLmluZGV4LCBjaGFuZ2UuaXRlbSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0QnOlxuICAgICAgICAgIGFycltpbmRleF0gPSBjaGFuZ2UubGhzO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdFJzpcbiAgICAgICAgICBhcnJbaW5kZXhdID0gY2hhbmdlLmxocztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnTic6XG4gICAgICAgICAgYXJyID0gYXJyYXlSZW1vdmUoYXJyLCBpbmRleCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhcnI7XG4gIH1cblxuICBmdW5jdGlvbiByZXZlcnRDaGFuZ2UodGFyZ2V0LCBzb3VyY2UsIGNoYW5nZSkge1xuICAgIGlmICh0YXJnZXQgJiYgc291cmNlICYmIGNoYW5nZSAmJiBjaGFuZ2Uua2luZCkge1xuICAgICAgdmFyIGl0ID0gdGFyZ2V0LFxuICAgICAgICBpLCB1O1xuICAgICAgdSA9IGNoYW5nZS5wYXRoLmxlbmd0aCAtIDE7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgdTsgaSsrKSB7XG4gICAgICAgIGlmICh0eXBlb2YgaXRbY2hhbmdlLnBhdGhbaV1dID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIGl0W2NoYW5nZS5wYXRoW2ldXSA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGl0ID0gaXRbY2hhbmdlLnBhdGhbaV1dO1xuICAgICAgfVxuICAgICAgc3dpdGNoIChjaGFuZ2Uua2luZCkge1xuICAgICAgICBjYXNlICdBJzpcbiAgICAgICAgICAvLyBBcnJheSB3YXMgbW9kaWZpZWQuLi5cbiAgICAgICAgICAvLyBpdCB3aWxsIGJlIGFuIGFycmF5Li4uXG4gICAgICAgICAgcmV2ZXJ0QXJyYXlDaGFuZ2UoaXRbY2hhbmdlLnBhdGhbaV1dLCBjaGFuZ2UuaW5kZXgsIGNoYW5nZS5pdGVtKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRCc6XG4gICAgICAgICAgLy8gSXRlbSB3YXMgZGVsZXRlZC4uLlxuICAgICAgICAgIGl0W2NoYW5nZS5wYXRoW2ldXSA9IGNoYW5nZS5saHM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0UnOlxuICAgICAgICAgIC8vIEl0ZW0gd2FzIGVkaXRlZC4uLlxuICAgICAgICAgIGl0W2NoYW5nZS5wYXRoW2ldXSA9IGNoYW5nZS5saHM7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ04nOlxuICAgICAgICAgIC8vIEl0ZW0gaXMgbmV3Li4uXG4gICAgICAgICAgZGVsZXRlIGl0W2NoYW5nZS5wYXRoW2ldXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBhcHBseURpZmYodGFyZ2V0LCBzb3VyY2UsIGZpbHRlcikge1xuICAgIGlmICh0YXJnZXQgJiYgc291cmNlKSB7XG4gICAgICB2YXIgb25DaGFuZ2UgPSBmdW5jdGlvbihjaGFuZ2UpIHtcbiAgICAgICAgaWYgKCFmaWx0ZXIgfHwgZmlsdGVyKHRhcmdldCwgc291cmNlLCBjaGFuZ2UpKSB7XG4gICAgICAgICAgYXBwbHlDaGFuZ2UodGFyZ2V0LCBzb3VyY2UsIGNoYW5nZSk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBkZWVwRGlmZih0YXJnZXQsIHNvdXJjZSwgb25DaGFuZ2UpO1xuICAgIH1cbiAgfVxuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKGFjY3VtdWxhdGVEaWZmLCB7XG5cbiAgICBkaWZmOiB7XG4gICAgICB2YWx1ZTogYWNjdW11bGF0ZURpZmYsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBvYnNlcnZhYmxlRGlmZjoge1xuICAgICAgdmFsdWU6IGRlZXBEaWZmLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgYXBwbHlEaWZmOiB7XG4gICAgICB2YWx1ZTogYXBwbHlEaWZmLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgYXBwbHlDaGFuZ2U6IHtcbiAgICAgIHZhbHVlOiBhcHBseUNoYW5nZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIHJldmVydENoYW5nZToge1xuICAgICAgdmFsdWU6IHJldmVydENoYW5nZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIGlzQ29uZmxpY3Q6IHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuICd1bmRlZmluZWQnICE9PSB0eXBlb2YgY29uZmxpY3Q7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgbm9Db25mbGljdDoge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAoY29uZmxpY3RSZXNvbHV0aW9uKSB7XG4gICAgICAgICAgY29uZmxpY3RSZXNvbHV0aW9uLmZvckVhY2goZnVuY3Rpb24oaXQpIHtcbiAgICAgICAgICAgIGl0KCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgY29uZmxpY3RSZXNvbHV0aW9uID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWNjdW11bGF0ZURpZmY7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIGFjY3VtdWxhdGVEaWZmO1xufSkpO1xuIiwidmFyIHBsYWNlaG9sZGVyID0ge30sXG4gICAgZW5kT2ZBcmdzID0ge30sXG4gICAgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbC5iaW5kKEFycmF5LnByb3RvdHlwZS5zbGljZSk7XG5cbmZ1bmN0aW9uIHNodXYoZm4pe1xuICAgIHZhciBvdXRlckFyZ3MgPSBzbGljZShhcmd1bWVudHMsIDEpO1xuXG4gICAgaWYodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBvciBub24tZnVuY3Rpb24gcGFzc2VkIHRvIHNodXYnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIGNvbnRleHQgPSB0aGlzLFxuICAgICAgICAgICAgaW5uZXJBcmdzID0gc2xpY2UoYXJndW1lbnRzKSxcbiAgICAgICAgICAgIGZpbmFsQXJncyA9IFtdLFxuICAgICAgICAgICAgYXBwZW5kID0gdHJ1ZTtcblxuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgb3V0ZXJBcmdzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIHZhciBvdXRlckFyZyA9IG91dGVyQXJnc1tpXTtcblxuICAgICAgICAgICAgaWYob3V0ZXJBcmcgPT09IGVuZE9mQXJncyl7XG4gICAgICAgICAgICAgICAgYXBwZW5kID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKG91dGVyQXJnID09PSBwbGFjZWhvbGRlcil7XG4gICAgICAgICAgICAgICAgZmluYWxBcmdzLnB1c2goaW5uZXJBcmdzLnNoaWZ0KCkpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBmaW5hbEFyZ3MucHVzaChvdXRlckFyZyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihhcHBlbmQpe1xuICAgICAgICAgICAgZmluYWxBcmdzID0gZmluYWxBcmdzLmNvbmNhdChpbm5lckFyZ3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZuLmFwcGx5KGNvbnRleHQsIGZpbmFsQXJncyk7XG4gICAgfTtcbn1cblxuc2h1di5fID0gcGxhY2Vob2xkZXI7XG5zaHV2LiQgPSBlbmRPZkFyZ3M7XG5cbm1vZHVsZS5leHBvcnRzID0gc2h1djsiLCJ2YXIgcmV2aXZlID0gcmVxdWlyZSgnLi9yZXZpdmUnKTtcblxuZnVuY3Rpb24gcGFyc2UoanNvbiwgcmV2aXZlcil7XG4gICAgcmV0dXJuIHJldml2ZShKU09OLnBhcnNlKGpzb24sIHJldml2ZXIpKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBwYXJzZTsiLCJ2YXIgY3JlYXRlS2V5ID0gcmVxdWlyZSgnLi9jcmVhdGVLZXknKSxcbiAgICBrZXlLZXkgPSBjcmVhdGVLZXkoLTEpO1xuXG5mdW5jdGlvbiByZXZpdmUoaW5wdXQpe1xuICAgIHZhciBvYmplY3RzID0ge30sXG4gICAgICAgIHNjYW5uZWRPYmplY3RzID0gW107XG5cbiAgICBmdW5jdGlvbiBzY2FuKGlucHV0KXtcbiAgICAgICAgdmFyIG91dHB1dCA9IGlucHV0O1xuXG4gICAgICAgIGlmKHR5cGVvZiBvdXRwdXQgIT09ICdvYmplY3QnKXtcbiAgICAgICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgICAgIH1cblxuICAgICAgICBvdXRwdXQgPSBpbnB1dCBpbnN0YW5jZW9mIEFycmF5ID8gW10gOiB7fTtcblxuICAgICAgICBpZihpbnB1dFtrZXlLZXldKXtcbiAgICAgICAgICAgIG9iamVjdHNbaW5wdXRba2V5S2V5XV0gPSBvdXRwdXQ7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IodmFyIGtleSBpbiBpbnB1dCl7XG4gICAgICAgICAgICB2YXIgdmFsdWUgPSBpbnB1dFtrZXldO1xuXG4gICAgICAgICAgICBpZihrZXkgPT09IGtleUtleSl7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKHZhbHVlICE9IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jyl7XG4gICAgICAgICAgICAgICAgaWYoc2Nhbm5lZE9iamVjdHMuaW5kZXhPZih2YWx1ZSk8MCl7XG4gICAgICAgICAgICAgICAgICAgIHNjYW5uZWRPYmplY3RzLnB1c2godmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXRba2V5XSA9IHNjYW4odmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1lbHNlIGlmKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgJiYgdmFsdWUubGVuZ3RoID09PSAxICYmIHZhbHVlLmNoYXJDb2RlQXQoMCkgPiBrZXlLZXkuY2hhckNvZGVBdCgwKSl7XG4gICAgICAgICAgICAgICAgb3V0cHV0W2tleV0gPSBvYmplY3RzW3ZhbHVlXSB8fCBpbnB1dFtrZXldO1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgb3V0cHV0W2tleV0gPSBpbnB1dFtrZXldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfVxuXG4gICAgaWYoIWlucHV0IHx8IHR5cGVvZiBpbnB1dCAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm4gaW5wdXQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNjYW4oaW5wdXQpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJldml2ZTsiLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBzdHJpbmdpZnk6IHJlcXVpcmUoJy4vc3RyaW5naWZ5JyksXG4gICAgcGFyc2U6IHJlcXVpcmUoJy4vcGFyc2UnKSxcbiAgICByZXZpdmU6IHJlcXVpcmUoJy4vcmV2aXZlJylcbn07IiwidmFyIGNyZWF0ZUtleSA9IHJlcXVpcmUoJy4vY3JlYXRlS2V5JyksXG4gICAga2V5S2V5ID0gY3JlYXRlS2V5KC0xKTtcblxuZnVuY3Rpb24gdG9Kc29uVmFsdWUodmFsdWUpe1xuICAgIGlmKHZhbHVlICE9IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jyl7XG4gICAgICAgIHZhciByZXN1bHQgPSB2YWx1ZSBpbnN0YW5jZW9mIEFycmF5ID8gW10gOiB7fSxcbiAgICAgICAgICAgIG91dHB1dCA9IHZhbHVlO1xuICAgICAgICBpZigndG9KU09OJyBpbiB2YWx1ZSl7XG4gICAgICAgICAgICBvdXRwdXQgPSB2YWx1ZS50b0pTT04oKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IodmFyIGtleSBpbiBvdXRwdXQpe1xuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBvdXRwdXRba2V5XTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHJldHVybiB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gc3RyaW5naWZ5KGlucHV0LCByZXBsYWNlciwgc3BhY2VyKXtcbiAgICB2YXIgb2JqZWN0cyA9IFtdLFxuICAgICAgICBvdXRwdXRPYmplY3RzID0gW10sXG4gICAgICAgIHJlZnMgPSBbXTtcblxuICAgIGZ1bmN0aW9uIHNjYW4oaW5wdXQpe1xuXG4gICAgICAgIGlmKGlucHV0ID09PSBudWxsIHx8IHR5cGVvZiBpbnB1dCAhPT0gJ29iamVjdCcpe1xuICAgICAgICAgICAgcmV0dXJuIGlucHV0O1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIG91dHB1dCxcbiAgICAgICAgICAgIGluZGV4ID0gb2JqZWN0cy5pbmRleE9mKGlucHV0KTtcblxuICAgICAgICBpZihpbmRleCA+PSAwKXtcbiAgICAgICAgICAgIG91dHB1dE9iamVjdHNbaW5kZXhdW2tleUtleV0gPSByZWZzW2luZGV4XVxuICAgICAgICAgICAgcmV0dXJuIHJlZnNbaW5kZXhdO1xuICAgICAgICB9XG5cbiAgICAgICAgaW5kZXggPSBvYmplY3RzLmxlbmd0aDtcbiAgICAgICAgb2JqZWN0c1tpbmRleF0gPSBpbnB1dDtcbiAgICAgICAgb3V0cHV0ID0gdG9Kc29uVmFsdWUoaW5wdXQpO1xuICAgICAgICBvdXRwdXRPYmplY3RzW2luZGV4XSA9IG91dHB1dDtcbiAgICAgICAgcmVmc1tpbmRleF0gPSBjcmVhdGVLZXkoaW5kZXgpO1xuXG4gICAgICAgIGZvcih2YXIga2V5IGluIG91dHB1dCl7XG4gICAgICAgICAgICBvdXRwdXRba2V5XSA9IHNjYW4ob3V0cHV0W2tleV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9XG5cbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoc2NhbihpbnB1dCksIHJlcGxhY2VyLCBzcGFjZXIpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHN0cmluZ2lmeTsiXX0=
