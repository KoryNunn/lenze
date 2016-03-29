(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
;(function (exports) {
  'use strict'

  var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

  var PLUS = '+'.charCodeAt(0)
  var SLASH = '/'.charCodeAt(0)
  var NUMBER = '0'.charCodeAt(0)
  var LOWER = 'a'.charCodeAt(0)
  var UPPER = 'A'.charCodeAt(0)
  var PLUS_URL_SAFE = '-'.charCodeAt(0)
  var SLASH_URL_SAFE = '_'.charCodeAt(0)

  function decode (elt) {
    var code = elt.charCodeAt(0)
    if (code === PLUS || code === PLUS_URL_SAFE) return 62 // '+'
    if (code === SLASH || code === SLASH_URL_SAFE) return 63 // '/'
    if (code < NUMBER) return -1 // no match
    if (code < NUMBER + 10) return code - NUMBER + 26 + 26
    if (code < UPPER + 26) return code - UPPER
    if (code < LOWER + 26) return code - LOWER + 26
  }

  function b64ToByteArray (b64) {
    var i, j, l, tmp, placeHolders, arr

    if (b64.length % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4')
    }

    // the number of equal signs (place holders)
    // if there are two placeholders, than the two characters before it
    // represent one byte
    // if there is only one, then the three characters before it represent 2 bytes
    // this is just a cheap hack to not do indexOf twice
    var len = b64.length
    placeHolders = b64.charAt(len - 2) === '=' ? 2 : b64.charAt(len - 1) === '=' ? 1 : 0

    // base64 is 4/3 + up to two characters of the original data
    arr = new Arr(b64.length * 3 / 4 - placeHolders)

    // if there are placeholders, only get up to the last complete 4 chars
    l = placeHolders > 0 ? b64.length - 4 : b64.length

    var L = 0

    function push (v) {
      arr[L++] = v
    }

    for (i = 0, j = 0; i < l; i += 4, j += 3) {
      tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
      push((tmp & 0xFF0000) >> 16)
      push((tmp & 0xFF00) >> 8)
      push(tmp & 0xFF)
    }

    if (placeHolders === 2) {
      tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
      push(tmp & 0xFF)
    } else if (placeHolders === 1) {
      tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
      push((tmp >> 8) & 0xFF)
      push(tmp & 0xFF)
    }

    return arr
  }

  function uint8ToBase64 (uint8) {
    var i
    var extraBytes = uint8.length % 3 // if we have 1 byte left, pad 2 bytes
    var output = ''
    var temp, length

    function encode (num) {
      return lookup.charAt(num)
    }

    function tripletToBase64 (num) {
      return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
    }

    // go through the array every three bytes, we'll deal with trailing stuff later
    for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
      temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
      output += tripletToBase64(temp)
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    switch (extraBytes) {
      case 1:
        temp = uint8[uint8.length - 1]
        output += encode(temp >> 2)
        output += encode((temp << 4) & 0x3F)
        output += '=='
        break
      case 2:
        temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
        output += encode(temp >> 10)
        output += encode((temp >> 4) & 0x3F)
        output += encode((temp << 2) & 0x3F)
        output += '='
        break
      default:
        break
    }

    return output
  }

  exports.toByteArray = b64ToByteArray
  exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    this.length = 0
    this.parent = undefined
  }

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(array)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
} else {
  // pre-set for values that may exist in the future
  Buffer.prototype.length = undefined
  Buffer.prototype.parent = undefined
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":1,"ieee754":5,"isarray":3}],3:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],6:[function(require,module,exports){
require('pseudo-worker/polyfill');

var myWorker = new Worker('app/app.browser.js'),
    ui = require('./ui')(myWorker);

},{"./ui":9,"pseudo-worker/polyfill":35}],7:[function(require,module,exports){
var fastn = require('./fastn'),
    Lenze = require('../../'),
    EventEmitter = require('events');

module.exports = function(worker){
    var app = new EventEmitter(),
        lenze = Lenze.replicant(app, {
            receive: function(callback){
                worker.addEventListener('message', function(message){
                    callback(message.data);
                });
            },
            send: function(data){
                worker.postMessage(data);
            }
        });

    lenze.on('change', function(changes){
        for(var i = 1; i < changes.length; i++){
            var change = lenze.getChangeInfo(changes[i]);

            fastn.Model.emit(change.target, change.key, change.value);
        }
    });

    return app;
};
},{"../../":10,"./fastn":8,"events":4}],8:[function(require,module,exports){
module.exports = require('fastn')({
    _generic: require('fastn/genericComponent'),
    list: require('fastn/listComponent'),
    text: require('fastn/textComponent'),
    templater: require('fastn/templaterComponent'),
}, true);

},{"fastn":22,"fastn/genericComponent":21,"fastn/listComponent":24,"fastn/templaterComponent":27,"fastn/textComponent":28}],9:[function(require,module,exports){
var fastn = require('./fastn');

module.exports = function(worker){
    var app = require('./app')(worker);

    function renderUser(){
        return fastn('div', {class: 'user'},
            'Name: ', fastn.binding('name'),
            ' - ',
            'Age: ', fastn.binding('dob', function(dob){
                return new Date().getYear() - dob.getYear();
            })
        )
        .binding('item')
    };

    var ui = fastn('div',
            fastn('div', {class: 'search'},
                'Search: ',
                fastn('input')
                .on('keyup', function(event, scope){
                    scope.get('.').setSearch(event.target.value);
                })
            ),
            fastn('templater', {
                data: fastn.binding('selectedUser'),
                template: function(model){
                    if(model.get('item')){
                        return fastn('div', {class: 'selectedUser'},
                            'SelectedUser: ',
                            fastn('input', {value: fastn.binding('name')})
                            .on('keyup', function(event, scope){
                                scope.get('.').setName(event.target.value);
                            })
                        )
                        .binding('item');
                    }
                }
            }),
            fastn('h2', 'All users:'),
            fastn('list', {
                class: 'users',
                items: fastn.binding('visibleUsers|*'),
                template: function(){
                    return renderUser().on('click', function(event, scope){
                        app.setSelectedUser(scope.get('.'));
                    });
                }
            })
        ).attach(app);

    window.onload = function(){
        document.body.appendChild(ui.render().element);
    }
};
},{"./app":7,"./fastn":8}],10:[function(require,module,exports){
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

},{"events":4,"is-instance":30,"shuv":39,"viscous":44}],11:[function(require,module,exports){
module.exports = function(element){
    var lastClasses = [];

    return function(classes){

        if(!arguments.length){
            return lastClasses.join(' ');
        }

        function cleanClassName(result, className){
            if(typeof className === 'string' && className.match(/\s/)){
                className = className.split(' ');
            }

            if(Array.isArray(className)){
                return result.concat(className.reduce(cleanClassName, []));
            }

            if(className != null && className !== '' && typeof className !== 'boolean'){
                result.push(String(className).trim());
            }

            return result;
        }

        var newClasses = cleanClassName([], classes),
            currentClasses = element.className ? element.className.split(' ') : [];

        lastClasses.map(function(className){
            if(!className){
                return;
            }

            var index = currentClasses.indexOf(className);

            if(~index){
                currentClasses.splice(index, 1);
            }
        });

        currentClasses = currentClasses.concat(newClasses);
        lastClasses = newClasses;

        element.className = currentClasses.join(' ');
    };
};

},{}],12:[function(require,module,exports){
(function (Buffer){
var clone = (function() {
'use strict';

/**
 * Clones (copies) an Object using deep copying.
 *
 * This function supports circular references by default, but if you are certain
 * there are no circular references in your object, you can save some CPU time
 * by calling clone(obj, false).
 *
 * Caution: if `circular` is false and `parent` contains circular references,
 * your program may enter an infinite loop and crash.
 *
 * @param `parent` - the object to be cloned
 * @param `circular` - set to true if the object to be cloned may contain
 *    circular references. (optional - true by default)
 * @param `depth` - set to a number if the object is only to be cloned to
 *    a particular depth. (optional - defaults to Infinity)
 * @param `prototype` - sets the prototype to be used when cloning an object.
 *    (optional - defaults to parent prototype).
*/
function clone(parent, circular, depth, prototype) {
  var filter;
  if (typeof circular === 'object') {
    depth = circular.depth;
    prototype = circular.prototype;
    filter = circular.filter;
    circular = circular.circular
  }
  // maintain two arrays for circular references, where corresponding parents
  // and children have the same index
  var allParents = [];
  var allChildren = [];

  var useBuffer = typeof Buffer != 'undefined';

  if (typeof circular == 'undefined')
    circular = true;

  if (typeof depth == 'undefined')
    depth = Infinity;

  // recurse this function so we don't reset allParents and allChildren
  function _clone(parent, depth) {
    // cloning null always returns null
    if (parent === null)
      return null;

    if (depth == 0)
      return parent;

    var child;
    var proto;
    if (typeof parent != 'object') {
      return parent;
    }

    if (clone.__isArray(parent)) {
      child = [];
    } else if (clone.__isRegExp(parent)) {
      child = new RegExp(parent.source, __getRegExpFlags(parent));
      if (parent.lastIndex) child.lastIndex = parent.lastIndex;
    } else if (clone.__isDate(parent)) {
      child = new Date(parent.getTime());
    } else if (useBuffer && Buffer.isBuffer(parent)) {
      child = new Buffer(parent.length);
      parent.copy(child);
      return child;
    } else {
      if (typeof prototype == 'undefined') {
        proto = Object.getPrototypeOf(parent);
        child = Object.create(proto);
      }
      else {
        child = Object.create(prototype);
        proto = prototype;
      }
    }

    if (circular) {
      var index = allParents.indexOf(parent);

      if (index != -1) {
        return allChildren[index];
      }
      allParents.push(parent);
      allChildren.push(child);
    }

    for (var i in parent) {
      var attrs;
      if (proto) {
        attrs = Object.getOwnPropertyDescriptor(proto, i);
      }

      if (attrs && attrs.set == null) {
        continue;
      }
      child[i] = _clone(parent[i], depth - 1);
    }

    return child;
  }

  return _clone(parent, depth);
}

/**
 * Simple flat clone using prototype, accepts only objects, usefull for property
 * override on FLAT configuration object (no nested props).
 *
 * USE WITH CAUTION! This may not behave as you wish if you do not know how this
 * works.
 */
clone.clonePrototype = function clonePrototype(parent) {
  if (parent === null)
    return null;

  var c = function () {};
  c.prototype = parent;
  return new c();
};

// private utility functions

function __objToStr(o) {
  return Object.prototype.toString.call(o);
};
clone.__objToStr = __objToStr;

function __isDate(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Date]';
};
clone.__isDate = __isDate;

function __isArray(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Array]';
};
clone.__isArray = __isArray;

function __isRegExp(o) {
  return typeof o === 'object' && __objToStr(o) === '[object RegExp]';
};
clone.__isRegExp = __isRegExp;

function __getRegExpFlags(re) {
  var flags = '';
  if (re.global) flags += 'g';
  if (re.ignoreCase) flags += 'i';
  if (re.multiline) flags += 'm';
  return flags;
};
clone.__getRegExpFlags = __getRegExpFlags;

return clone;
})();

if (typeof module === 'object' && module.exports) {
  module.exports = clone;
}

}).call(this,require("buffer").Buffer)

},{"buffer":2}],13:[function(require,module,exports){
//Copyright (C) 2012 Kory Nunn

//Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

//The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

/*

    This code is not formatted for readability, but rather run-speed and to assist compilers.

    However, the code's intention should be transparent.

    *** IE SUPPORT ***

    If you require this library to work in IE7, add the following after declaring crel.

    var testDiv = document.createElement('div'),
        testLabel = document.createElement('label');

    testDiv.setAttribute('class', 'a');
    testDiv['className'] !== 'a' ? crel.attrMap['class'] = 'className':undefined;
    testDiv.setAttribute('name','a');
    testDiv['name'] !== 'a' ? crel.attrMap['name'] = function(element, value){
        element.id = value;
    }:undefined;


    testLabel.setAttribute('for', 'a');
    testLabel['htmlFor'] !== 'a' ? crel.attrMap['for'] = 'htmlFor':undefined;



*/

(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.crel = factory();
    }
}(this, function () {
    var fn = 'function',
        obj = 'object',
        nodeType = 'nodeType',
        textContent = 'textContent',
        setAttribute = 'setAttribute',
        attrMapString = 'attrMap',
        isNodeString = 'isNode',
        isElementString = 'isElement',
        d = typeof document === obj ? document : {},
        isType = function(a, type){
            return typeof a === type;
        },
        isNode = typeof Node === fn ? function (object) {
            return object instanceof Node;
        } :
        // in IE <= 8 Node is an object, obviously..
        function(object){
            return object &&
                isType(object, obj) &&
                (nodeType in object) &&
                isType(object.ownerDocument,obj);
        },
        isElement = function (object) {
            return crel[isNodeString](object) && object[nodeType] === 1;
        },
        isArray = function(a){
            return a instanceof Array;
        },
        appendChild = function(element, child) {
          if(!crel[isNodeString](child)){
              child = d.createTextNode(child);
          }
          element.appendChild(child);
        };


    function crel(){
        var args = arguments, //Note: assigned to a variable to assist compilers. Saves about 40 bytes in closure compiler. Has negligable effect on performance.
            element = args[0],
            child,
            settings = args[1],
            childIndex = 2,
            argumentsLength = args.length,
            attributeMap = crel[attrMapString];

        element = crel[isElementString](element) ? element : d.createElement(element);
        // shortcut
        if(argumentsLength === 1){
            return element;
        }

        if(!isType(settings,obj) || crel[isNodeString](settings) || isArray(settings)) {
            --childIndex;
            settings = null;
        }

        // shortcut if there is only one child that is a string
        if((argumentsLength - childIndex) === 1 && isType(args[childIndex], 'string') && element[textContent] !== undefined){
            element[textContent] = args[childIndex];
        }else{
            for(; childIndex < argumentsLength; ++childIndex){
                child = args[childIndex];

                if(child == null){
                    continue;
                }

                if (isArray(child)) {
                  for (var i=0; i < child.length; ++i) {
                    appendChild(element, child[i]);
                  }
                } else {
                  appendChild(element, child);
                }
            }
        }

        for(var key in settings){
            if(!attributeMap[key]){
                element[setAttribute](key, settings[key]);
            }else{
                var attr = attributeMap[key];
                if(typeof attr === fn){
                    attr(element, settings[key]);
                }else{
                    element[setAttribute](attr, settings[key]);
                }
            }
        }

        return element;
    }

    // Used for mapping one kind of attribute to the supported version of that in bad browsers.
    crel[attrMapString] = {};

    crel[isElementString] = isElement;

    crel[isNodeString] = isNode;

    if(typeof Proxy !== 'undefined'){
        return new Proxy(crel, {
            get: function(target, key){
                !(key in crel) && (crel[key] = crel.bind(null, key));
                return crel[key];
            }
        });
    }

    return crel;
}));

},{}],14:[function(require,module,exports){
(function (global){
var EventEmitter = require('events').EventEmitter;

function toArray(items){
    return Array.prototype.slice.call(items);
}

var deepRegex = /[|.]/i;

function matchDeep(path){
    return (path + '').match(deepRegex);
}

function isWildcardPath(path){
    var stringPath = (path + '');
    return ~stringPath.indexOf('*');
}

function getTargetKey(path){
    var stringPath = (path + '');
    return stringPath.split('|').shift();
}

var eventSystemVersion = 1,
    globalKey = '_entiEventState' + eventSystemVersion
    globalState = global[globalKey] = global[globalKey] || {
        instances: []
    };

var modifiedEnties = globalState.modifiedEnties = globalState.modifiedEnties || new Set(),
    trackedObjects = globalState.trackedObjects = globalState.trackedObjects || new WeakMap();

function leftAndRest(path){
    var stringPath = (path + '');

    // Special case when you want to filter on self (.)
    if(stringPath.slice(0,2) === '.|'){
        return ['.', stringPath.slice(2)];
    }

    var match = matchDeep(stringPath);
    if(match){
        return [stringPath.slice(0, match.index), stringPath.slice(match.index+1)];
    }
    return stringPath;
}

function isWildcardKey(key){
    return key.charAt(0) === '*';
}

function isFeralcardKey(key){
    return key === '**';
}

function addHandler(object, key, handler){
    var trackedKeys = trackedObjects.get(object);

    if(trackedKeys == null){
        trackedKeys = {};
        trackedObjects.set(object, trackedKeys);
    }

    var handlers = trackedKeys[key];

    if(!handlers){
        handlers = new Set();
        trackedKeys[key] = handlers;
    }

    handlers.add(handler);
}

function removeHandler(object, key, handler){
    var trackedKeys = trackedObjects.get(object);

    if(trackedKeys == null){
        return;
    }

    var handlers = trackedKeys[key];

    if(!handlers){
        return;
    }

    handlers.delete(handler);
}

function trackObjects(eventName, tracked, handler, object, key, path){
    if(!object || typeof object !== 'object'){
        return;
    }

    var eventKey = key === '**' ? '*' : key,
        target = object[key],
        targetIsObject = target && typeof target === 'object';

    if(targetIsObject && tracked.has(target)){
        return;
    }

    var handle = function(value, event, emitKey){
        if(eventKey !== '*' && typeof object[eventKey] === 'object' && object[eventKey] !== target){
            if(targetIsObject){
                tracked.delete(target);
            }
            removeHandler(object, eventKey, handle);
            trackObjects(eventName, tracked, handler, object, key, path);
            return;
        }

        if(eventKey === '*'){
            trackKeys(object, key, path);
        }

        if(!tracked.has(object)){
            return;
        }

        if(key !== '**' || !path){
            handler(value, event, emitKey);
        }
    }

    function trackKeys(target, root, rest){
        var keys = Object.keys(target);
        for(var i = 0; i < keys.length; i++){
            if(isFeralcardKey(root)){
                trackObjects(eventName, tracked, handler, target, keys[i], '**' + (rest ? '.' : '') + (rest || ''));
            }else{
                trackObjects(eventName, tracked, handler, target, keys[i], rest);
            }
        }
    }

    addHandler(object, eventKey, handle);

    if(!targetIsObject){
        return;
    }

    // This would obviously be better implemented with a WeakSet,
    // But I'm trying to keep filesize down, and I don't really want another
    // polyfill when WeakMap works well enough for the task.
    tracked.add(target);

    if(!path){
        return;
    }

    var rootAndRest = leftAndRest(path),
        root,
        rest;

    if(!Array.isArray(rootAndRest)){
        root = rootAndRest;
    }else{
        root = rootAndRest[0];
        rest = rootAndRest[1];

        // If the root is '.', watch for events on *
        if(root === '.'){
            root = '*';
        }
    }

    if(targetIsObject && isWildcardKey(root)){
        trackKeys(target, root, rest);
    }

    trackObjects(eventName, tracked, handler, target, root, rest);
}

var trackedEvents = new WeakMap();
function createHandler(enti, trackedObjectPaths, trackedPaths, eventName){
    var oldModel = enti._model;
    return function(event, emitKey){
        trackedPaths.entis.forEach(function(enti){
            if(enti._emittedEvents[eventName] === emitKey){
                return;
            }

            if(enti._model !== oldModel){
                trackedPaths.entis.delete(enti);
                if(trackedPaths.entis.size === 0){
                    delete trackedObjectPaths[eventName];
                    if(!Object.keys(trackedObjectPaths).length){
                        trackedEvents.delete(oldModel);
                    }
                }
                return;
            }

            enti._emittedEvents[eventName] = emitKey;

            var targetKey = getTargetKey(eventName),
                value = isWildcardPath(targetKey) ? undefined : enti.get(targetKey);

            enti.emit(eventName, value, event);
        });
    };
}

function trackPath(enti, eventName){
    var object = enti._model,
        trackedObjectPaths = trackedEvents.get(object);

    if(!trackedObjectPaths){
        trackedObjectPaths = {};
        trackedEvents.set(object, trackedObjectPaths);
    }

    var trackedPaths = trackedObjectPaths[eventName];

    if(!trackedPaths){
        trackedPaths = {
            entis: new Set(),
            trackedObjects: new WeakSet()
        };
        trackedObjectPaths[eventName] = trackedPaths;
    }else if(trackedPaths.entis.has(enti)){
        return;
    }

    trackedPaths.entis.add(enti);

    var handler = createHandler(enti, trackedObjectPaths, trackedPaths, eventName);

    trackObjects(eventName, trackedPaths.trackedObjects, handler, {model:object}, 'model', eventName);
}

function trackPaths(enti){
    if(!enti._events || !enti._model){
        return;
    }

    for(var key in enti._events){
        trackPath(enti, key);
    }
    modifiedEnties.delete(enti);
}

function emitEvent(object, key, value, emitKey){

    modifiedEnties.forEach(trackPaths);

    var trackedKeys = trackedObjects.get(object);

    if(!trackedKeys){
        return;
    }

    var event = {
        value: value,
        key: key,
        object: object
    };

    function emitForKey(handler){
        handler(event, emitKey);
    }

    if(trackedKeys[key]){
        trackedKeys[key].forEach(emitForKey);
    }

    if(trackedKeys['*']){
        trackedKeys['*'].forEach(emitForKey);
    }
}

function emit(events){
    var emitKey = {};
    events.forEach(function(event){
        emitEvent(event[0], event[1], event[2], emitKey);
    });
}

function Enti(model){
    var detached = model === false;

    if(!model || (typeof model !== 'object' && typeof model !== 'function')){
        model = {};
    }

    this._emittedEvents = {};
    if(detached){
        this._model = {};
    }else{
        this.attach(model);
    }

    this.on('newListener', function(){
        modifiedEnties.add(this);
    });
}
Enti.emit = function(model, key, value){
    if(!(typeof model === 'object' || typeof model === 'function')){
        return;
    }

    emit([[model, key, value]]);
};
Enti.get = function(model, key){
    if(!model || typeof model !== 'object'){
        return;
    }

    key = getTargetKey(key);

    if(key === '.'){
        return model;
    }


    var path = leftAndRest(key);
    if(Array.isArray(path)){
        return Enti.get(model[path[0]], path[1]);
    }

    return model[key];
};
Enti.set = function(model, key, value){
    if(!model || typeof model !== 'object'){
        return;
    }

    key = getTargetKey(key);

    var path = leftAndRest(key);
    if(Array.isArray(path)){
        return Enti.set(model[path[0]], path[1], value);
    }

    var original = model[key];

    if(typeof value !== 'object' && value === original){
        return;
    }

    var keysChanged = !(key in model);

    model[key] = value;

    var events = [[model, key, value]];

    if(keysChanged){
        if(Array.isArray(model)){
            events.push([model, 'length', model.length]);
        }
    }

    emit(events);
};
Enti.push = function(model, key, value){
    if(!model || typeof model !== 'object'){
        return;
    }

    var target;
    if(arguments.length < 3){
        value = key;
        key = '.';
        target = model;
    }else{
        var path = leftAndRest(key);
        if(Array.isArray(path)){
            return Enti.push(model[path[0]], path[1], value);
        }

        target = model[key];
    }

    if(!Array.isArray(target)){
        throw 'The target is not an array.';
    }

    target.push(value);

    var events = [
        [target, target.length-1, value],
        [target, 'length', target.length]
    ];

    emit(events);
};
Enti.insert = function(model, key, value, index){
    if(!model || typeof model !== 'object'){
        return;
    }


    var target;
    if(arguments.length < 4){
        index = value;
        value = key;
        key = '.';
        target = model;
    }else{
        var path = leftAndRest(key);
        if(Array.isArray(path)){
            return Enti.insert(model[path[0]], path[1], value, index);
        }

        target = model[key];
    }

    if(!Array.isArray(target)){
        throw 'The target is not an array.';
    }

    target.splice(index, 0, value);

    var events = [
        [target, index, value],
        [target, 'length', target.length]
    ];

    emit(events);
};
Enti.remove = function(model, key, subKey){
    if(!model || typeof model !== 'object'){
        return;
    }

    var path = leftAndRest(key);
    if(Array.isArray(path)){
        return Enti.remove(model[path[0]], path[1], subKey);
    }

    // Remove a key off of an object at 'key'
    if(subKey != null){
        Enti.remove(model[key], subKey);
        return;
    }

    if(key === '.'){
        throw '. (self) is not a valid key to remove';
    }

    var events = [];

    if(Array.isArray(model)){
        model.splice(key, 1);
        events.push([model, 'length', model.length]);
    }else{
        delete model[key];
        events.push([model, key]);
    }

    emit(events);
};
Enti.move = function(model, key, index){
    if(!model || typeof model !== 'object'){
        return;
    }

    var path = leftAndRest(key);
    if(Array.isArray(path)){
        return Enti.move(model[path[0]], path[1], index);
    }

    if(key === index){
        return;
    }

    if(!Array.isArray(model)){
        throw 'The model is not an array.';
    }

    var item = model[key];

    model.splice(key, 1);

    model.splice(index - (index > key ? 0 : 1), 0, item);

    emit([[model, index, item]]);
};
Enti.update = function(model, key, value){
    if(!model || typeof model !== 'object'){
        return;
    }

    var target,
        isArray = Array.isArray(value);

    if(arguments.length < 3){
        value = key;
        key = '.';
        target = model;
    }else{
        var path = leftAndRest(key);
        if(Array.isArray(path)){
            return Enti.update(model[path[0]], path[1], value);
        }

        target = model[key];

        if(target == null){
            model[key] = isArray ? [] : {};
        }
    }

    if(typeof value !== 'object'){
        throw 'The value is not an object.';
    }

    if(typeof target !== 'object'){
        throw 'The target is not an object.';
    }

    var events = [],
        updatedObjects = new WeakSet();

    function updateTarget(target, value){
        for(var key in value){
            var currentValue = target[key];
            if(currentValue instanceof Object && !updatedObjects.has(currentValue) && !(currentValue instanceof Date)){
                updatedObjects.add(currentValue);
                updateTarget(currentValue, value[key]);
                continue;
            }
            target[key] = value[key];
            events.push([target, key, value[key]]);
        }

        if(Array.isArray(target)){
            events.push([target, 'length', target.length]);
        }
    }

    updateTarget(target, value);

    emit(events);
};
Enti.prototype = Object.create(EventEmitter.prototype);
Enti.prototype._maxListeners = 100;
Enti.prototype.constructor = Enti;
Enti.prototype.attach = function(model){
    if(this._model !== model){
        this.detach();
    }

    modifiedEnties.add(this);
    this._attached = true;
    this._model = model;
    this.emit('attach', model);
};
Enti.prototype.detach = function(){
    modifiedEnties.delete(this);

    this._emittedEvents = {};
    this._model = {};
    this._attached = false;
    this.emit('detach');
};
Enti.prototype.destroy = function(){
    this.detach();
    this._events = null;
    this.emit('destroy');
};
Enti.prototype.get = function(key){
    return Enti.get(this._model, key);
};

Enti.prototype.set = function(key, value){
    return Enti.set(this._model, key, value);
};

Enti.prototype.push = function(key, value){
    return Enti.push.apply(null, [this._model].concat(toArray(arguments)));
};

Enti.prototype.insert = function(key, value, index){
    return Enti.insert.apply(null, [this._model].concat(toArray(arguments)));
};

Enti.prototype.remove = function(key, subKey){
    return Enti.remove.apply(null, [this._model].concat(toArray(arguments)));
};

Enti.prototype.move = function(key, index){
    return Enti.move.apply(null, [this._model].concat(toArray(arguments)));
};

Enti.prototype.update = function(key, index){
    return Enti.update.apply(null, [this._model].concat(toArray(arguments)));
};
Enti.prototype.isAttached = function(){
    return this._attached;
};
Enti.prototype.attachedCount = function(){
    return modifiedEnties.size;
};

Enti.isEnti = function(target){
    return target && !!~globalState.instances.indexOf(target.constructor);
};

Enti.store = function(target, key, value){
    if(arguments.length < 2){
        return Enti.get(target, key);
    }

    Enti.set(target, key, value);
};

globalState.instances.push(Enti);

module.exports = Enti;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"events":4}],15:[function(require,module,exports){
var is = require('./is'),
    GENERIC = '_generic',
    EventEmitter = require('events').EventEmitter,
    slice = Array.prototype.slice;

function flatten(item){
    return Array.isArray(item) ? item.reduce(function(result, element){
        if(element == null){
            return result;
        }
        return result.concat(flatten(element));
    },[]) : item;
}

function attachProperties(object, firm){
    for(var key in this._properties){
        this._properties[key].attach(object, firm);
    }
}

function onRender(){

    // Ensure all bindings are somewhat attached just before rendering
    this.attach(undefined, 0);

    for(var key in this._properties){
        this._properties[key].update();
    }
}

function detachProperties(firm){
    for(var key in this._properties){
        this._properties[key].detach(firm);
    }
}

function destroyProperties(){
    for(var key in this._properties){
        this._properties[key].destroy();
    }
}

function clone(){
    return this.fastn(this.component._type, this.component._settings, this.component._children.filter(function(child){
            return !child._templated;
        }).map(function(child){
            return child.clone();
        })
    );
}

function getSetBinding(newBinding){
    if(!arguments.length){
        return this.binding;
    }

    if(!is.binding(newBinding)){
        newBinding = this.fastn.binding(newBinding);
    }

    if(this.binding && this.binding !== newBinding){
        this.binding.removeListener('change', this.emitAttach);
        newBinding.attach(this.binding._model, this.binding._firm);
    }

    this.binding = newBinding;

    this.binding.on('change', this.emitAttach);
    this.binding.on('detach', this.emitDetach);

    this.emitAttach();

    return this.component;
};

function emitAttach(){
    var newBound = this.binding();
    if(newBound !== this.lastBound){
        this.lastBound = newBound;
        this.scope.attach(this.lastBound);
        this.component.emit('attach', this.scope, 1);
    }
}

function emitDetach(){
    this.component.emit('detach', 1);
}

function getScope(){
    return this.scope;
}

function destroy(){
    if(this.destroyed){
        return;
    }
    this.destroyed = true;

    this.component
        .removeAllListeners('render')
        .removeAllListeners('attach');

    this.component.emit('destroy');
    this.component.element = null;
    this.scope.destroy();
    this.binding.destroy();

    return this.component;
}

function attachComponent(object, firm){
    this.binding.attach(object, firm);
    return this.component;
}

function detachComponent(firm){
    this.binding.detach(firm);
    return this.component;
}

function isDestroyed(){
    return this.destroyed;
}

function setProperty(key, property){

    // Add a default property or use the one already there
    if(!property){
        property = this.component[key] || this.fastn.property();
    }

    this.component[key] = property;
    this.component._properties[key] = property;

    return this.component;
}

function extendComponent(type, settings, children){

    if(type in this.types){
        return this.component;
    }

    if(!(type in this.fastn.components)){

        if(!(GENERIC in this.fastn.components)){
            throw new Error('No component of type "' + type + '" is loaded');
        }

        this.fastn.components._generic(this.fastn, this.component, type, settings, children);

        this.types._generic = true;
    }else{

        this.fastn.components[type](this.fastn, this.component, type, settings, children);
    }

    this.types[type] = true;

    return this.component;
};

function isType(type){
    return type in this.types;
}

function FastnComponent(fastn, type, settings, children){
    var component = this;

    var componentScope = {
        types: {},
        fastn: fastn,
        component: component,
        binding: fastn.binding('.'),
        destroyed: false,
        scope: new fastn.Model(false),
        lastBound: null
    };

    componentScope.emitAttach = emitAttach.bind(componentScope);
    componentScope.emitDetach = emitDetach.bind(componentScope);
    componentScope.binding._default_binding = true;

    component._type = type;
    component._properties = {};
    component._settings = settings || {};
    component._children = children ? flatten(children) : [];

    component.attach = attachComponent.bind(componentScope);
    component.detach = detachComponent.bind(componentScope);
    component.scope = getScope.bind(componentScope);
    component.destroy = destroy.bind(componentScope);
    component.destroyed = isDestroyed.bind(componentScope);
    component.binding = getSetBinding.bind(componentScope);
    component.setProperty = setProperty.bind(componentScope);
    component.clone = clone.bind(componentScope);
    component.children = slice.bind(component._children);
    component.extend = extendComponent.bind(componentScope);
    component.is = isType.bind(componentScope);

    component.binding(componentScope.binding);

    component.on('attach', attachProperties.bind(this));
    component.on('render', onRender.bind(this));
    component.on('detach', detachProperties.bind(this));
    component.on('destroy', destroyProperties.bind(this));

    if(fastn.debug){
        component.on('render', function(){
            if(component.element && typeof component.element === 'object'){
                component.element._component = component;
            }
        });
    }
}
FastnComponent.prototype = Object.create(EventEmitter.prototype);
FastnComponent.prototype.constructor = FastnComponent;
FastnComponent.prototype._fastn_component = true;

module.exports = FastnComponent;
},{"./is":23,"events":4}],16:[function(require,module,exports){
var Enti = require('enti'),
    is = require('./is'),
    firmer = require('./firmer'),
    functionEmitter = require('./functionEmitter'),
    setPrototypeOf = require('setprototypeof'),
    same = require('same-value');

function fuseBinding(){
    var args = Array.prototype.slice.call(arguments);

    var bindings = args.slice(),
        transform = bindings.pop(),
        updateTransform,
        resultBinding = createBinding('result'),
        selfChanging;

    resultBinding._arguments = args;

    if(typeof bindings[bindings.length-1] === 'function' && !is.binding(bindings[bindings.length-1])){
        updateTransform = transform;
        transform = bindings.pop();
    }

    resultBinding._model.removeAllListeners();
    resultBinding._set = function(value){
        if(updateTransform){
            selfChanging = true;
            var newValue = updateTransform(value);
            if(!same(newValue, bindings[0]())){
                bindings[0](newValue);
                resultBinding._change(newValue);
            }
            selfChanging = false;
        }else{
            resultBinding._change(value);
        }
    };

    function change(){
        if(selfChanging){
            return;
        }
        resultBinding(transform.apply(null, bindings.map(function(binding){
            return binding();
        })));
    }

    bindings.forEach(function(binding, index){
        if(!is.binding(binding)){
            binding = createBinding(binding);
            bindings.splice(index,1,binding);
        }
        binding.on('change', change);
        resultBinding.on('detach', binding.detach);
    });

    var lastAttached;
    resultBinding.on('attach', function(object){
        selfChanging = true;
        bindings.forEach(function(binding){
            binding.attach(object, 1);
        });
        selfChanging = false;
        if(lastAttached !== object){
            change();
        }
        lastAttached = object;
    });

    return resultBinding;
}

function createValueBinding(){
    var valueBinding = createBinding('value');
    valueBinding.attach = function(){return valueBinding;};
    valueBinding.detach = function(){return valueBinding;};
    return valueBinding;
}

function bindingTemplate(newValue){
    if(!arguments.length){
        return this.value;
    }

    if(this.binding._fastn_binding === '.'){
        return;
    }

    this.binding._set(newValue);
    return this.binding;
}

function createBinding(path, more){

    if(more){ // used instead of arguments.length for performance
        return fuseBinding.apply(null, arguments);
    }

    if(path == null){
        return createValueBinding();
    }

    var bindingScope = {},
        binding = bindingScope.binding = bindingTemplate.bind(bindingScope),
        destroyed;

    setPrototypeOf(binding, functionEmitter);
    binding.setMaxListeners(10000);
    binding._arguments = [path];
    binding._model = new Enti(false);
    binding._fastn_binding = path;
    binding._firm = -Infinity;

    function modelAttachHandler(data){
        binding._model.attach(data);
        binding._change(binding._model.get(path));
        binding.emit('attach', data, 1);
    }

    function modelDetachHandler(){
        binding._model.detach();
    }

    binding.attach = function(object, firm){

        // If the binding is being asked to attach loosly to an object,
        // but it has already been defined as being firmly attached, do not attach.
        if(firmer(binding, firm)){
            return binding;
        }

        binding._firm = firm;

        var isEnti = Enti.isEnti(object);

        if(isEnti && bindingScope.attachedModel === object){
            return binding;
        }

        if(bindingScope.attachedModel){
            bindingScope.attachedModel.removeListener('attach', modelAttachHandler);
            bindingScope.attachedModel.removeListener('detach', modelDetachHandler);
            bindingScope.attachedModel = null;
        }

        if(isEnti){
            bindingScope.attachedModel = object;
            bindingScope.attachedModel.on('attach', modelAttachHandler);
            bindingScope.attachedModel.on('detach', modelDetachHandler);
            object = object._model;
        }

        if(!(object instanceof Object)){
            object = {};
        }

        if(binding._model._model === object){
            return binding;
        }

        modelAttachHandler(object);

        return binding;
    };

    binding.detach = function(firm){
        if(firmer(binding, firm)){
            return binding;
        }

        bindingScope.value = undefined;
        if(binding._model.isAttached()){
            binding._model.detach();
        }
        binding.emit('detach', 1);
        return binding;
    };
    binding._set = function(newValue){
        if(same(binding._model.get(path), newValue)){
            return;
        }
        if(!binding._model.isAttached()){
            binding._model.attach(binding._model.get('.'));
        }
        binding._model.set(path, newValue);
    };
    binding._change = function(newValue){
        bindingScope.value = newValue;
        binding.emit('change', binding());
    };
    binding.clone = function(keepAttachment){
        var newBinding = createBinding.apply(null, binding._arguments);

        if(keepAttachment){
            newBinding.attach(bindingScope.attachedModel || binding._model._model, binding._firm);
        }

        return newBinding;
    };
    binding.destroy = function(soft){
        if(destroyed){
            return;
        }
        if(soft && binding.listeners('change').length){
            return;
        }
        destroyed = true;
        binding.emit('destroy');
        binding.detach();
        binding._model.destroy();
    };

    binding.destroyed = function(){
        return destroyed;
    };

    if(path !== '.'){
        binding._model.on(path, binding._change);
    }

    return binding;
}

function from(valueOrBinding){
    if(is.binding(valueOrBinding)){
        return valueOrBinding;
    }

    return createBinding()(valueOrBinding);
}

createBinding.from = from;

module.exports = createBinding;
},{"./firmer":19,"./functionEmitter":20,"./is":23,"enti":14,"same-value":36,"setprototypeof":38}],17:[function(require,module,exports){
function insertChild(fastn, container, child, index){
    if(child == null || child === false){
        return;
    }

    var currentIndex = container._children.indexOf(child),
        newComponent = fastn.toComponent(child);

    if(newComponent !== child && ~currentIndex){
        container._children.splice(currentIndex, 1, newComponent);
    }

    if(!~currentIndex || newComponent !== child){
        newComponent.attach(container.scope(), 1);
    }

    if(currentIndex !== index){
        if(~currentIndex){
            container._children.splice(currentIndex, 1);
        }
        container._children.splice(index, 0, newComponent);
    }

    if(container.element){
        if(!newComponent.element){
            newComponent.render();
        }
        container._insert(newComponent.element, index);
        newComponent.emit('insert', container);
        container.emit('childInsert', newComponent);
    }
}

function getContainerElement(){
    return this.containerElement || this.element;
}

function insert(child, index){
    var childComponent = child,
        container = this.container,
        fastn = this.fastn;

    if(index && typeof index === 'object'){
        childComponent = Array.prototype.slice.call(arguments);
    }

    if(isNaN(index)){
        index = container._children.length;
    }

    if(Array.isArray(childComponent)){
        for (var i = 0; i < childComponent.length; i++) {
            container.insert(childComponent[i], i + index);
        }
    }else{
        insertChild(fastn, container, childComponent, index);
    }

    return container;
}

module.exports = function(fastn, component, type, settings, children){
    component.insert = insert.bind({
        container: component,
        fastn: fastn
    });

    component._insert = function(element, index){
        var containerElement = component.getContainerElement();
        if(!containerElement){
            return;
        }

        if(containerElement.childNodes[index] === element){
            return;
        }

        containerElement.insertBefore(element, containerElement.childNodes[index]);
    };

    component.remove = function(childComponent){
        var index = component._children.indexOf(childComponent);
        if(~index){
            component._children.splice(index,1);
        }

        childComponent.detach(1);

        if(childComponent.element){
            component._remove(childComponent.element);
            childComponent.emit('remove', component);
        }
        component.emit('childRemove', childComponent);
    };

    component._remove = function(element){
        var containerElement = component.getContainerElement();

        if(!element || !containerElement || element.parentNode !== containerElement){
            return;
        }

        containerElement.removeChild(element);
    };

    component.empty = function(){
        while(component._children.length){
            component.remove(component._children.pop());
        }
    };

    component.replaceChild = function(oldChild, newChild){
        var index = component._children.indexOf(oldChild);

        if(!~index){
            return;
        }

        component.remove(oldChild);
        component.insert(newChild, index);
    };

    component.getContainerElement = getContainerElement.bind(component);

    component.on('render', component.insert.bind(null, component._children, 0));

    component.on('attach', function(model, firm){
        for(var i = 0; i < component._children.length; i++){
            if(fastn.isComponent(component._children[i])){
                component._children[i].attach(model, firm);
            }
        }
    });

    component.on('destroy', function(data, firm){
        for(var i = 0; i < component._children.length; i++){
            if(fastn.isComponent(component._children[i])){
                component._children[i].destroy(firm);
            }
        }
    });

    return component;
};
},{}],18:[function(require,module,exports){
var setify = require('setify'),
    classist = require('classist');

function updateTextProperty(generic, element, value){
    if(arguments.length === 2){
        return element.textContent;
    }
    element.textContent = (value == null ? '' : value);
}

module.exports = {
    class: function(generic, element, value){
        if(!generic._classist){
            generic._classist = classist(element);
        }

        if(arguments.length < 3){
            return generic._classist();
        }

        generic._classist(value);
    },
    display: function(generic, element, value){
        if(arguments.length === 2){
            return element.style.display !== 'none';
        }
        element.style.display = value ? null : 'none';
    },
    disabled: function(generic, element, value){
        if(arguments.length === 2){
            return element.hasAttribute('disabled');
        }
        if(value){
            element.setAttribute('disabled', 'disabled');
        }else{
            element.removeAttribute('disabled');
        }
    },
    textContent: updateTextProperty,
    innerText: updateTextProperty,
    innerHTML: function(generic, element, value){
        if(arguments.length === 2){
            return element.innerHTML;
        }
        element.innerHTML = (value == null ? '' : value);
    },
    value: function(generic, element, value){
        var inputType = element.type;

        if(element.nodeName === 'INPUT' && inputType === 'date'){
            if(arguments.length === 2){
                return element.value ? new Date(element.value.replace(/-/g,'/').replace('T',' ')) : null;
            }

            value = value != null ? new Date(value) : null;

            if(!value || isNaN(value)){
                element.value = null;
            }else{
                element.value = [
                    value.getFullYear(),
                    ('0' + (value.getMonth() + 1)).slice(-2),
                    ('0' + value.getDate()).slice(-2)
                ].join('-');
            }
            return;
        }

        if(arguments.length === 2){
            return element.value;
        }
        if(value === undefined){
            value = null;
        }

        if(element.nodeName === 'PROGRESS'){
            value = parseFloat(value) || 0;
        }

        setify(element, value);
    },
    max: function(generic, element, value) {
        if(arguments.length === 2){
            return element.value;
        }

        if(element.nodeName === 'PROGRESS'){
            value = parseFloat(value) || 0;
        }

        element.max = value;
    },
    style: function(generic, element, value){
        if(arguments.length === 2){
            return element.style;
        }

        for(var key in value){
            element.style[key] = value[key];
        }
    },
    type: function(generic, element, value){
        if(arguments.length === 2){
            return element.type;
        }
        element.setAttribute('type', value);
    }
};
},{"classist":11,"setify":37}],19:[function(require,module,exports){
// Is the entity firmer than the new firmness
module.exports = function(entity, firm){
    if(firm != null && (entity._firm === undefined || firm < entity._firm)){
        return true;
    }
};
},{}],20:[function(require,module,exports){
var EventEmitter = require('events').EventEmitter,
    functionEmitterPrototype = function(){};

for(var key in EventEmitter.prototype){
    functionEmitterPrototype[key] = EventEmitter.prototype[key];
}

module.exports = functionEmitterPrototype;
},{"events":4}],21:[function(require,module,exports){
var containerComponent = require('./containerComponent'),
    schedule = require('./schedule'),
    fancyProps = require('./fancyProps'),
    matchDomHandlerName = /^((?:el\.)?)([^. ]+)(?:\.(capture))?$/,
    GENERIC = '_generic';

function createProperties(fastn, component, settings){
    for(var key in settings){
        var setting = settings[key];

        if(typeof setting === 'function' && !fastn.isProperty(setting) && !fastn.isBinding(setting)){
            continue;
        }

        component.addDomProperty(key);
    }
}

function addDomHandler(component, element, handlerName, eventName, capture){
    var eventParts = handlerName.split('.');

    if(eventParts[0] === 'on'){
        eventParts.shift();
    }

    var handler = function(event){
            component.emit(handlerName, event, component.scope());
        };

    element.addEventListener(eventName, handler, capture);

    component.on('destroy', function(){
        element.removeEventListener(eventName, handler, capture);
    });
}

function addDomHandlers(component, element, eventNames){
    var events = eventNames.split(' ');

    for(var i = 0; i < events.length; i++){
        var eventName = events[i],
            match = eventName.match(matchDomHandlerName);

        if(!match){
            continue;
        }

        if(match[1] || 'on' + match[2] in element){
            addDomHandler(component, element, eventNames, match[2], match[3]);
        }
    }
}

function addAutoHandler(component, element, key, settings){
    if(!settings[key]){
        return;
    }

    var autoEvent = settings[key].split(':'),
        eventName = key.slice(2);

    delete settings[key];

    var handler = function(event){
        var fancyProp = fancyProps[autoEvent[1]],
            value = fancyProp ? fancyProp(component, element) : element[autoEvent[1]];

        component[autoEvent[0]](value);
    };

    element.addEventListener(eventName, handler);

    component.on('destroy', function(){
        element.removeEventListener(eventName, handler);
    });
}

function addDomProperty(fastn, key, property){
    var component = this;

    property = property || component[key] || fastn.property();
    component.setProperty(key, property);

    function update(){
        var element = component.getPropertyElement(key),
            value = property();

        if(!element || component.destroyed()){
            return;
        }

        var isProperty = key in element,
            fancyProp = fancyProps[key],
            previous = fancyProp ? fancyProp(component, element) : isProperty ? element[key] : element.getAttribute(key);

        if(!fancyProp && !isProperty && value == null){
            value = '';
        }

        if(value !== previous){
            if(fancyProp){
                fancyProp(component, element, value);
                return;
            }

            if(isProperty){
                element[key] = value;
                return;
            }

            if(typeof value !== 'function' && typeof value !== 'object'){
                element.setAttribute(key, value);
            }
        }
    }

    property.updater(update);
}

function onRender(){
    var component = this,
        element;

    for(var key in component._settings){
        element = component.getEventElement(key);
        if(key.slice(0,2) === 'on' && key in element){
            addAutoHandler(component, element, key, component._settings);
        }
    }

    for(var eventKey in component._events){
        element = component.getEventElement(key);
        addDomHandlers(component, element, eventKey);
    }
}

function render(){
    this.element = this.createElement(this._settings.tagName || this._tagName);

    this.emit('render');

    return this;
};

function genericComponent(fastn, component, type, settings, children){
    if(component.is(type)){
        return component;
    }

    if(type === GENERIC){
        component._tagName = component._tagName || 'div';
    }else{
        component._tagName = type;
    }

    if(component.is(GENERIC)){
        return component;
    }

    component.extend('_container', settings, children);

    component.addDomProperty = addDomProperty.bind(component, fastn);
    component.getEventElement = component.getContainerElement;
    component.getPropertyElement = component.getContainerElement;
    component.updateProperty = genericComponent.updateProperty;
    component.createElement = genericComponent.createElement;

    createProperties(fastn, component, settings);

    component.render = render.bind(component);

    component.on('render', onRender);

    return component;
}

genericComponent.updateProperty = function(component, property, update){
    if(typeof document !== 'undefined' && document.contains(component.element)){
        schedule(property, update);
    }else{
        update();
    }
};

genericComponent.createElement = function(tagName){
    if(tagName instanceof Node){
        return tagName;
    }
    return document.createElement(tagName);
};

module.exports = genericComponent;
},{"./containerComponent":17,"./fancyProps":18,"./schedule":26}],22:[function(require,module,exports){
var createProperty = require('./property'),
    createBinding = require('./binding'),
    BaseComponent = require('./baseComponent'),
    crel = require('crel'),
    Enti = require('enti'),
    objectAssign = require('object-assign'),
    is = require('./is');

function inflateProperties(component, settings){
    for(var key in settings){
        var setting = settings[key],
            property = component[key];

        if(is.property(settings[key])){

            if(is.property(property)){
                property.destroy();
            }

            setting.addTo(component, key);

        }else if(is.property(property)){

            if(is.binding(setting)){
                property.binding(setting);
            }else{
                property(setting);
            }

            property.addTo(component, key);
        }
    }
}

function validateExpectedComponents(components, componentName, expectedComponents){
    expectedComponents = expectedComponents.filter(function(componentName){
        return !(componentName in components);
    });

    if(expectedComponents.length){
        console.warn([
            'fastn("' + componentName + '") uses some components that have not been registered with fastn',
            'Expected conponent constructors: ' + expectedComponents.join(', ')
        ].join('\n\n'));
    }
}

module.exports = function(components, debug){

    if(!components || typeof components !== 'object'){
        throw new Error('fastn must be initialised with a components object');
    }

    components._container = components._container || require('./containerComponent');

    function fastn(type){

        var args = [];
        for(var i = 0; i < arguments.length; i++){
            args[i] = arguments[i];
        }

        var settings = args[1],
            childrenIndex = 2,
            settingsChild = fastn.toComponent(args[1]);

        if(Array.isArray(args[1]) || settingsChild || !args[1]){
            args[1] = settingsChild || args[1];
            childrenIndex--;
            settings = null;
        }

        settings = objectAssign({}, settings || {});

        var types = typeof type === 'string' ? type.split(':') : Array.isArray(type) ? type : [type],
            baseType,
            children = args.slice(childrenIndex),
            component = fastn.base(type, settings, children);

        while(baseType = types.shift()){
            component.extend(baseType, settings, children);
        }

        component._properties = {};

        inflateProperties(component, settings);

        return component;
    }

    fastn.toComponent = function(component){
        if(component == null){
            return;
        }
        if(is.component(component)){
            return component;
        }
        if(typeof component !== 'object' || component instanceof Date){
            return fastn('text', {auto: true}, component);
        }
        if(crel.isElement(component)){
            return fastn(component);
        }
        if(crel.isNode(component)){
            return fastn('text', {auto: true}, component.textContent);
        }
    };

    fastn.debug = debug;
    fastn.property = createProperty;
    fastn.binding = createBinding;
    fastn.isComponent = is.component;
    fastn.isBinding = is.binding;
    fastn.isDefaultBinding = is.defaultBinding;
    fastn.isBindingObject = is.bindingObject;
    fastn.isProperty = is.property;
    fastn.components = components;
    fastn.Model = Enti;

    fastn.base = function(type, settings, children){
        return new BaseComponent(fastn, type, settings, children);
    };

    for(var key in components){
        var componentConstructor = components[key];

        if(componentConstructor.expectedComponents){
            validateExpectedComponents(components, key, componentConstructor.expectedComponents);
        }
    }

    return fastn;
};
},{"./baseComponent":15,"./binding":16,"./containerComponent":17,"./is":23,"./property":25,"crel":13,"enti":14,"object-assign":33}],23:[function(require,module,exports){
var FUNCTION = 'function',
    OBJECT = 'object',
    FASTNBINDING = '_fastn_binding',
    FASTNPROPERTY = '_fastn_property',
    FASTNCOMPONENT = '_fastn_component',
    DEFAULTBINDING = '_default_binding';

function isComponent(thing){
    return thing && typeof thing === OBJECT && FASTNCOMPONENT in thing;
}

function isBindingObject(thing){
    return thing && typeof thing === OBJECT && FASTNBINDING in thing;
}

function isBinding(thing){
    return typeof thing === FUNCTION && FASTNBINDING in thing;
}

function isProperty(thing){
    return typeof thing === FUNCTION && FASTNPROPERTY in thing;
}

function isDefaultBinding(thing){
    return typeof thing === FUNCTION && FASTNBINDING in thing && DEFAULTBINDING in thing;
}

module.exports = {
    component: isComponent,
    bindingObject: isBindingObject,
    binding: isBinding,
    defaultBinding: isDefaultBinding,
    property: isProperty
};
},{}],24:[function(require,module,exports){
var MultiMap = require('multimap'),
    merge = require('flat-merge');

MultiMap.Map = Map;

function each(value, fn){
    if(!value || typeof value !== 'object'){
        return;
    }

    if(Array.isArray(value)){
        for(var i = 0; i < value.length; i++){
            fn(value[i], i)
        }
    }else{
        for(var key in value){
            fn(value[key], key);
        }
    }
}

function keyFor(object, value){
    if(!object || typeof object !== 'object'){
        return false;
    }

    if(Array.isArray(object)){
        var index = object.indexOf(value);
        return index >=0 ? index : false;
    }

    for(var key in object){
        if(object[key] === value){
            return key;
        }
    }

    return false;
}

module.exports = function(fastn, component, type, settings, children){

    if(fastn.components._generic){
        component.extend('_generic', settings, children);
    }else{
        component.extend('_container', settings, children);
    }

    if(!('template' in settings)){
        console.warn('No "template" function was set for this templater component');
    }

    var itemsMap = new MultiMap(),
        dataMap = new WeakMap(),
        lastTemplate,
        existingItem = {};

    function updateItems(){
        var value = component.items(),
            template = component.template(),
            emptyTemplate = component.emptyTemplate(),
            newTemplate = lastTemplate !== template;

        var currentItems = merge(template ? value : []);

        itemsMap.forEach(function(childComponent, item){
            var currentKey = keyFor(currentItems, item);

            if(!newTemplate && currentKey !== false){
                currentItems[currentKey] = [existingItem, item, childComponent];
            }else{
                removeComponent(childComponent);
                itemsMap.delete(item);
            }
        });

        var index = 0;

        function updateItem(item, key){
            var child,
                existing;

            while(index < component._children.length && !component._children[index]._templated){
                index++;
            }

            if(Array.isArray(item) && item[0] === existingItem){
                existing = true;
                child = item[2];
                item = item[1];
            }

            var childModel;

            if(!existing){
                childModel = new fastn.Model({
                    item: item,
                    key: key
                });

                child = fastn.toComponent(template(childModel, component.scope()));
                if(!child){
                    child = fastn('template');
                }
                child._listItem = item;
                child._templated = true;

                dataMap.set(child, childModel);
                itemsMap.set(item, child);
            }else{
                childModel = dataMap.get(child);
                childModel.set('key', key);
            }

            if(fastn.isComponent(child) && component._settings.attachTemplates !== false){
                child.attach(childModel, 2);
            }

            component.insert(child, index);
            index++;
        }

        each(currentItems, updateItem);

        lastTemplate = template;

        if(index === 0 && emptyTemplate){
            var child = fastn.toComponent(emptyTemplate(component.scope()));
            if(!child){
                child = fastn('template');
            }
            child._templated = true;

            itemsMap.set({}, child);

            component.insert(child);
        }
    }

    function removeComponent(childComponent){
        component.remove(childComponent);
        childComponent.destroy();
    }

    component.setProperty('items',
        fastn.property([], settings.itemChanges || 'type keys shallowStructure')
            .on('change', updateItems)
    );

    component.setProperty('template',
        fastn.property().on('change', updateItems)
    );

    component.setProperty('emptyTemplate',
        fastn.property().on('change', updateItems)
    );

    return component;
};
},{"flat-merge":29,"multimap":31}],25:[function(require,module,exports){
var Enti = require('enti'),
    WhatChanged = require('what-changed'),
    same = require('same-value'),
    firmer = require('./firmer'),
    createBinding = require('./binding'),
    functionEmitter = require('./functionEmitter'),
    setPrototypeOf = require('setprototypeof'),
    is = require('./is');

var propertyProto = Object.create(functionEmitter);

propertyProto._fastn_property = true;
propertyProto._firm = 1;

function propertyTemplate(value){
    if(!arguments.length){
        return this.binding && this.binding() || this.property._value;
    }

    if(!this.destroyed){
        if(this.binding){
            this.binding(value);
            return this.property;
        }

        this.valueUpdate(value);
    }

    return this.property;
}

function changeChecker(current, changes){
    if(changes){
        var changes = new WhatChanged(current, changes);

        return function(value){
            return Object.keys(changes.update(value)).length > 0;
        };
    }else{
        var lastValue = current;
        return function(newValue){
            if(!same(lastValue, newValue)){
                lastValue = newValue;
                return true;
            }
        };
    }
}


function propertyBinding(newBinding){
    if(!arguments.length){
        return this.binding;
    }

    if(!is.binding(newBinding)){
        newBinding = createBinding(newBinding);
    }

    if(newBinding === this.binding){
        return this.property;
    }

    if(this.binding){
        this.binding.removeListener('change', this.valueUpdate);
    }

    this.binding = newBinding;

    if(this.model){
        this.property.attach(this.model, this.property._firm);
    }

    this.binding.on('change', this.valueUpdate);
    this.valueUpdate(this.binding());

    return this.property;
};

function attachProperty(object, firm){
    if(firmer(this.property, firm)){
        return this.property;
    }

    this.property._firm = firm;

    if(!(object instanceof Object)){
        object = {};
    }

    if(this.binding){
        this.model = object;
        this.binding.attach(object, 1);
    }

    if(this.property._events && 'attach' in this.property._events){
        this.property.emit('attach', object, 1);
    }

    return this.property;
};

function detachProperty(firm){
    if(firmer(this.property, firm)){
        return this.property;
    }

    if(this.binding){
        this.binding.removeListener('change', this.valueUpdate);
        this.binding.detach(1);
        this.model = null;
    }

    if(this.property._events && 'detach' in this.property._events){
        this.property.emit('detach', 1);
    }

    return this.property;
};

function updateProperty(){
    if(!this.destroyed){

        if(this.property._update){
            this.property._update(this.property._value, this.property);
        }

        this.property.emit('update', this.property._value);
    }
    return this.property;
};

function propertyUpdater(fn){
    if(!arguments.length){
        return this.property._update;
    }
    this.property._update = fn;
    return this.property;
};

function destroyProperty(){
    if(!this.destroyed){
        this.destroyed = true;

        this.property
            .removeAllListeners('change')
            .removeAllListeners('update')
            .removeAllListeners('attach');

        this.property.emit('destroy');
        this.property.detach();
        if(this.binding){
            this.binding.destroy(true);
        }
    }
    return this.property;
};

function propertyDestroyed(){
    return this.destroyed;
};

function addPropertyTo(component, key){
    component.setProperty(key, this.property);

    return this.property;
};

function createProperty(currentValue, changes, updater){
    if(typeof changes === 'function'){
        updater = changes;
        changes = null;
    }

    var propertyScope =
        property = propertyTemplate.bind(propertyScope)
        propertyScope = {
        hasChanged: changeChecker(currentValue, changes),
        valueUpdate: function(value){
            property._value = value;
            if(!propertyScope.hasChanged(value)){
                return;
            }
            property.emit('change', property._value);
            property.update();
        }
    };

    var property = propertyScope.property = propertyTemplate.bind(propertyScope);

    property._value = currentValue;
    property._update = updater;

    setPrototypeOf(property, propertyProto);

    property.binding = propertyBinding.bind(propertyScope);
    property.attach = attachProperty.bind(propertyScope);
    property.detach = detachProperty.bind(propertyScope);
    property.update = updateProperty.bind(propertyScope);
    property.updater = propertyUpdater.bind(propertyScope);
    property.destroy = destroyProperty.bind(propertyScope);
    property.destroyed = propertyDestroyed.bind(propertyScope);
    property.addTo = addPropertyTo.bind(propertyScope);

    return property;
};

module.exports = createProperty;
},{"./binding":16,"./firmer":19,"./functionEmitter":20,"./is":23,"enti":14,"same-value":36,"setprototypeof":38,"what-changed":40}],26:[function(require,module,exports){
var todo = [],
    todoKeys = [],
    scheduled,
    updates = 0;

function run(){
    var startTime = Date.now();

    while(todo.length && Date.now() - startTime < 16){
        todoKeys.shift();
        todo.shift()();
    }

    if(todo.length){
        requestAnimationFrame(run);
    }else{
        scheduled = false;
    }
}

function schedule(key, fn){
    if(~todoKeys.indexOf(key)){
        return;
    }

    todo.push(fn);
    todoKeys.push(key);

    if(!scheduled){
        scheduled = true;
        requestAnimationFrame(run);
    }
}

module.exports = schedule;
},{}],27:[function(require,module,exports){
module.exports = function(fastn, component, type, settings, children){
    var itemModel = new fastn.Model({});

    if(!('template' in settings)){
        console.warn('No "template" function was set for this templater component');
    }

    function replaceElement(element){
        if(component.element && component.element.parentNode){
            component.element.parentNode.replaceChild(element, component.element);
        }
        component.element = element;
    }

    function update(){

        var value = component.data(),
            template = component.template();

        itemModel.set('item', value);

        var newComponent;

        if(template){
           newComponent = fastn.toComponent(template(itemModel, component.scope(), component._currentComponent));
        }

        if(component._currentComponent && component._currentComponent !== newComponent){
            if(fastn.isComponent(component._currentComponent)){
                component._currentComponent.destroy();
            }
        }

        component._currentComponent = newComponent;

        if(!newComponent){
            replaceElement(component.emptyElement);
            return;
        }

        if(fastn.isComponent(newComponent)){
            if(component._settings.attachTemplates !== false){
                newComponent.attach(itemModel, 2);
            }else{
                newComponent.attach(component.scope(), 1);
            }

            if(component.element && component.element !== newComponent.element){
                if(newComponent.element == null){
                    newComponent.render();
                }
                replaceElement(component._currentComponent.element);
            }
        }
    }

    component.render = function(){
        var element;
        component.emptyElement = document.createTextNode('');
        if(component._currentComponent){
            component._currentComponent.render();
            element = component._currentComponent.element;
        }
        component.element = element || component.emptyElement;
        component.emit('render');
    };

    component.setProperty('data',
        fastn.property(undefined, settings.dataChanges || 'value structure')
            .on('change', update)
    );

    component.setProperty('template',
        fastn.property(undefined, 'value reference')
            .on('change', update)
    );

    component.on('destroy', function(){
        if(fastn.isComponent(component._currentComponent)){
            component._currentComponent.destroy();
        }
    });

    component.on('attach', function(data){
        if(fastn.isComponent(component._currentComponent)){
            component._currentComponent.attach(component.scope(), 1);
        }
    });

    return component;
};
},{}],28:[function(require,module,exports){
function updateText(){
    if(!this.element){
        return;
    }

    var value = this.text();

    this.element.textContent = (value == null ? '' : value);
}

function autoRender(content){
    this.element = document.createTextNode(content);
}

function autoText(text, fastn, content) {
    text.render = autoRender.bind(text, content);

    return text;
}

function render(){
    this.element = this.createTextNode(this.text());
    this.emit('render');
};

function textComponent(fastn, component, type, settings, children){
    if(settings.auto){
        delete settings.auto;
        if(!fastn.isBinding(children[0])){
            return autoText(component, fastn, children[0]);
        }
        settings.text = children.pop();
    }

    component.createTextNode = textComponent.createTextNode;
    component.render = render.bind(component);

    component.setProperty('text', fastn.property('', updateText.bind(component)));

    return component;
}

textComponent.createTextNode = function(text){
    return document.createTextNode(text);
};

module.exports = textComponent;
},{}],29:[function(require,module,exports){
function flatMerge(a,b){
    if(!b || typeof b !== 'object'){
        b = {};
    }

    if(!a || typeof a !== 'object'){
        a = new b.constructor();
    }

    var result = new a.constructor(),
        aKeys = Object.keys(a),
        bKeys = Object.keys(b);

    for(var i = 0; i < aKeys.length; i++){
        result[aKeys[i]] = a[aKeys[i]];
    }

    for(var i = 0; i < bKeys.length; i++){
        result[bKeys[i]] = b[bKeys[i]];
    }

    return result;
}

module.exports = flatMerge;
},{}],30:[function(require,module,exports){
module.exports = function(value){
    return value && typeof value === 'object' || typeof value === 'function';
};
},{}],31:[function(require,module,exports){
"use strict";

/* global module, define */

function mapEach(map, operation){
  var keys = map.keys();
  var next;
  while(!(next = keys.next()).done) {
    operation(map.get(next.value), next.value, map);
  }
}

var Multimap = (function() {
  var mapCtor;
  if (typeof Map !== 'undefined') {
    mapCtor = Map;

    if (!Map.prototype.keys) {
      Map.prototype.keys = function() {
        var keys = [];
        this.forEach(function(item, key) {
          keys.push(key);
        });
        return keys;
      };
    }
  }

  function Multimap(iterable) {
    var self = this;

    self._map = mapCtor;

    if (Multimap.Map) {
      self._map = Multimap.Map;
    }

    self._ = self._map ? new self._map() : {};

    if (iterable) {
      iterable.forEach(function(i) {
        self.set(i[0], i[1]);
      });
    }
  }

  /**
   * @param {Object} key
   * @return {Array} An array of values, undefined if no such a key;
   */
  Multimap.prototype.get = function(key) {
    return this._map ? this._.get(key) : this._[key];
  };

  /**
   * @param {Object} key
   * @param {Object} val...
   */
  Multimap.prototype.set = function(key, val) {
    var args = Array.prototype.slice.call(arguments);

    key = args.shift();

    var entry = this.get(key);
    if (!entry) {
      entry = [];
      if (this._map)
        this._.set(key, entry);
      else
        this._[key] = entry;
    }

    Array.prototype.push.apply(entry, args);
    return this;
  };

  /**
   * @param {Object} key
   * @param {Object=} val
   * @return {boolean} true if any thing changed
   */
  Multimap.prototype.delete = function(key, val) {
    if (!this.has(key))
      return false;

    if (arguments.length == 1) {
      this._map ? (this._.delete(key)) : (delete this._[key]);
      return true;
    } else {
      var entry = this.get(key);
      var idx = entry.indexOf(val);
      if (idx != -1) {
        entry.splice(idx, 1);
        return true;
      }
    }

    return false;
  };

  /**
   * @param {Object} key
   * @param {Object=} val
   * @return {boolean} whether the map contains 'key' or 'key=>val' pair
   */
  Multimap.prototype.has = function(key, val) {
    var hasKey = this._map ? this._.has(key) : this._.hasOwnProperty(key);

    if (arguments.length == 1 || !hasKey)
      return hasKey;

    var entry = this.get(key) || [];
    return entry.indexOf(val) != -1;
  };


  /**
   * @return {Array} all the keys in the map
   */
  Multimap.prototype.keys = function() {
    if (this._map)
      return makeIterator(this._.keys());

    return makeIterator(Object.keys(this._));
  };

  /**
   * @return {Array} all the values in the map
   */
  Multimap.prototype.values = function() {
    var vals = [];
    this.forEachEntry(function(entry) {
      Array.prototype.push.apply(vals, entry);
    });

    return makeIterator(vals);
  };

  /**
   *
   */
  Multimap.prototype.forEachEntry = function(iter) {
    mapEach(this, iter);
  };

  Multimap.prototype.forEach = function(iter) {
    var self = this;
    self.forEachEntry(function(entry, key) {
      entry.forEach(function(item) {
        iter(item, key, self);
      });
    });
  };


  Multimap.prototype.clear = function() {
    if (this._map) {
      this._.clear();
    } else {
      this._ = {};
    }
  };

  Object.defineProperty(
    Multimap.prototype,
    "size", {
      configurable: false,
      enumerable: true,
      get: function() {
        var total = 0;

        mapEach(this, function(value){
          total += value.length;
        });

        return total;
      }
    });

  var safariNext;

  try{
    safariNext = new Function('iterator', 'makeIterator', 'var keysArray = []; for(var key of iterator){keysArray.push(key);} return makeIterator(keysArray).next;');
  }catch(error){
    // for of not implemented;
  }

  function makeIterator(iterator){
    if(Array.isArray(iterator)){
      var nextIndex = 0;

      return {
        next: function(){
          return nextIndex < iterator.length ?
            {value: iterator[nextIndex++], done: false} :
          {done: true};
        }
      };
    }

    // Only an issue in safari
    if(!iterator.next && safariNext){
      iterator.next = safariNext(iterator, makeIterator);
    }

    return iterator;
  }

  return Multimap;
})();


if(typeof exports === 'object' && module && module.exports)
  module.exports = Multimap;
else if(typeof define === 'function' && define.amd)
  define(function() { return Multimap; });

},{}],32:[function(require,module,exports){
var supportedTypes = ['text', 'search', 'tel', 'url', 'password'];

module.exports = function(element){
    return !!(element.setSelectionRange && ~supportedTypes.indexOf(element.type));
};

},{}],33:[function(require,module,exports){
'use strict';
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function ToObject(val) {
	if (val == null) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function ownEnumerableKeys(obj) {
	var keys = Object.getOwnPropertyNames(obj);

	if (Object.getOwnPropertySymbols) {
		keys = keys.concat(Object.getOwnPropertySymbols(obj));
	}

	return keys.filter(function (key) {
		return propIsEnumerable.call(obj, key);
	});
}

module.exports = Object.assign || function (target, source) {
	var from;
	var keys;
	var to = ToObject(target);

	for (var s = 1; s < arguments.length; s++) {
		from = arguments[s];
		keys = ownEnumerableKeys(Object(from));

		for (var i = 0; i < keys.length; i++) {
			to[keys[i]] = from[keys[i]];
		}
	}

	return to;
};

},{}],34:[function(require,module,exports){
(function (global){
'use strict';

function doEval(self, __pseudoworker_script) {
  /* jshint unused:false */
  (function () {
    /* jshint evil:true */
    eval(__pseudoworker_script);
  }).call(global);
}

function PseudoWorker(path) {
  var messageListeners = [];
  var errorListeners = [];
  var workerMessageListeners = [];
  var workerErrorListeners = [];
  var postMessageListeners = [];
  var terminated = false;
  var script;
  var workerSelf;

  var api = this;

  // because IE8 support
  function forEach(arr, fun) {
    var i = -1;
    var len = arr.length;
    while (++i < len) {
      fun(arr[i]);
    }
  }

  function callErrorListener(err) {
    return function (listener) {
      listener({
        type: 'error',
        error: err,
        message: err.message
      });
    };
  }

  function addEventListener(type, fun) {
    /* istanbul ignore else */
    if (type === 'message') {
      messageListeners.push(fun);
    } else if (type === 'error') {
      errorListeners.push(fun);
    }
  }

  function postError(err) {
    var callFun = callErrorListener(err);
    if (typeof api.onerror === 'function') {
      callFun(api.onerror);
    }
    if (workerSelf && typeof workerSelf.onerror === 'function') {
      callFun(workerSelf.onerror);
    }
    forEach(errorListeners, callFun);
    forEach(workerErrorListeners, callFun);
  }

  function runPostMessage(msg) {
    function callFun(listener) {
      try {
        listener({data: msg});
      } catch (err) {
        postError(err);
      }
    }

    if (workerSelf && typeof workerSelf.onmessage === 'function') {
      callFun(workerSelf.onmessage);
    }
    forEach(workerMessageListeners, callFun);
  }

  function postMessage(msg) {
    if (typeof msg === 'undefined') {
      throw new Error('postMessage() requires an argument');
    }
    if (terminated) {
      return;
    }
    if (!script) {
      postMessageListeners.push(msg);
      return;
    }
    runPostMessage(msg);
  }

  function terminate() {
    terminated = true;
  }

  function workerPostMessage(msg) {
    function callFun(listener) {
      listener({
        data: msg
      });
    }
    if (typeof api.onmessage === 'function') {
      callFun(api.onmessage);
    }
    forEach(messageListeners, callFun);
  }

  function workerAddEventListener(type, fun) {
    /* istanbul ignore else */
    if (type === 'message') {
      workerMessageListeners.push(fun);
    } else if (type === 'error') {
      workerErrorListeners.push(fun);
    }
  }

  var xhr = new XMLHttpRequest();

  xhr.open('GET', path);
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4) {
      if (xhr.status >= 200 && xhr.status < 400) {
        script = xhr.responseText;
        workerSelf = {
          postMessage: workerPostMessage,
          addEventListener: workerAddEventListener,
        };
        doEval(workerSelf, script);
        while (postMessageListeners.length) {
          runPostMessage(postMessageListeners.pop());
        }
      } else {
        postError(new Error('cannot find script ' + path));
      }
    }
  };

  xhr.send();

  api.postMessage = postMessage;
  api.addEventListener = addEventListener;
  api.terminate = terminate;

  return api;
}

module.exports = PseudoWorker;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],35:[function(require,module,exports){
(function (global){
'use strict';

if (typeof Worker === 'undefined') {
  global.Worker = require('./');
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./":34}],36:[function(require,module,exports){
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
},{}],37:[function(require,module,exports){
var naturalSelection = require('natural-selection');

module.exports = function(element, value){
    var canSet = naturalSelection(element) && element === document.activeElement;

    if (canSet) {
        var start = element.selectionStart,
            end = element.selectionEnd;

        element.value = value;
        element.setSelectionRange(start, end);
    } else {
        element.value = value;
    }
};

},{"natural-selection":32}],38:[function(require,module,exports){
module.exports = Object.setPrototypeOf || ({__proto__:[]} instanceof Array ? setProtoOf : mixinProperties);

function setProtoOf(obj, proto) {
	obj.__proto__ = proto;
}

function mixinProperties(obj, proto) {
	for (var prop in proto) {
		obj[prop] = proto[prop];
	}
}

},{}],39:[function(require,module,exports){
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
},{}],40:[function(require,module,exports){
var clone = require('clone'),
    deepEqual = require('deep-equal');

function keysAreDifferent(keys1, keys2){
    if(keys1 === keys2){
        return;
    }
    if(!keys1 || !keys2 || keys1.length !== keys2.length){
        return true;
    }
    for(var i = 0; i < keys1.length; i++){
        if(!~keys2.indexOf(keys1[i])){
            return true;
        }
    }
}

function getKeys(value){
    if(!value || typeof value !== 'object'){
        return;
    }

    return Object.keys(value);
}

function WhatChanged(value, changesToTrack){
    this._changesToTrack = {};

    if(changesToTrack == null){
        changesToTrack = 'value type keys structure reference';
    }

    if(typeof changesToTrack !== 'string'){
        throw 'changesToTrack must be of type string';
    }

    changesToTrack = changesToTrack.split(' ');

    for (var i = 0; i < changesToTrack.length; i++) {
        this._changesToTrack[changesToTrack[i]] = true;
    };

    this.update(value);
}
WhatChanged.prototype.update = function(value){
    var result = {},
        changesToTrack = this._changesToTrack,
        newKeys = getKeys(value);

    if('value' in changesToTrack && value+'' !== this._lastReference+''){
        result.value = true;
    }
    if(
        'type' in changesToTrack && typeof value !== typeof this._lastValue ||
        (value === null || this._lastValue === null) && this.value !== this._lastValue // typeof null === 'object'
    ){
        result.type = true;
    }
    if('keys' in changesToTrack && keysAreDifferent(this._lastKeys, getKeys(value))){
        result.keys = true;
    }

    if(value !== null && typeof value === 'object' || typeof value === 'function'){
        var lastValue = this._lastValue;

        if('shallowStructure' in changesToTrack && (!lastValue || typeof lastValue !== 'object' || Object.keys(value).some(function(key, index){
            return value[key] !== lastValue[key];
        }))){
            result.shallowStructure = true;
        }
        if('structure' in changesToTrack && !deepEqual(value, lastValue)){
            result.structure = true;
        }
        if('reference' in changesToTrack && value !== this._lastReference){
            result.reference = true;
        }
    }

    this._lastValue = 'structure' in changesToTrack ? clone(value) : 'shallowStructure' in changesToTrack ? clone(value, true, 1): value;
    this._lastReference = value;
    this._lastKeys = newKeys;

    return result;
};

module.exports = WhatChanged;
},{"clone":12,"deep-equal":41}],41:[function(require,module,exports){
var pSlice = Array.prototype.slice;
var objectKeys = require('./lib/keys.js');
var isArguments = require('./lib/is_arguments.js');

var deepEqual = module.exports = function (actual, expected, opts) {
  if (!opts) opts = {};
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (typeof actual != 'object' && typeof expected != 'object') {
    return opts.strict ? actual === expected : actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected, opts);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isBuffer (x) {
  if (!x || typeof x !== 'object' || typeof x.length !== 'number') return false;
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== 'number') return false;
  return true;
}

function objEquiv(a, b, opts) {
  var i, key;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b, opts);
  }
  if (isBuffer(a)) {
    if (!isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b);
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], opts)) return false;
  }
  return typeof a === typeof b;
}

},{"./lib/is_arguments.js":42,"./lib/keys.js":43}],42:[function(require,module,exports){
var supportsArgumentsClass = (function(){
  return Object.prototype.toString.call(arguments)
})() == '[object Arguments]';

exports = module.exports = supportsArgumentsClass ? supported : unsupported;

exports.supported = supported;
function supported(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
};

exports.unsupported = unsupported;
function unsupported(object){
  return object &&
    typeof object == 'object' &&
    typeof object.length == 'number' &&
    Object.prototype.hasOwnProperty.call(object, 'callee') &&
    !Object.prototype.propertyIsEnumerable.call(object, 'callee') ||
    false;
};

},{}],43:[function(require,module,exports){
exports = module.exports = typeof Object.keys === 'function'
  ? Object.keys : shim;

exports.shim = shim;
function shim (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}

},{}],44:[function(require,module,exports){
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

},{"is-instance":45,"same-value":46}],45:[function(require,module,exports){
arguments[4][30][0].apply(exports,arguments)
},{"dup":30}],46:[function(require,module,exports){
arguments[4][36][0].apply(exports,arguments)
},{"dup":36}]},{},[6])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92NS4zLjAvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y1LjMuMC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIi4uLy4uLy5udm0vdmVyc2lvbnMvbm9kZS92NS4zLjAvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwiLi4vLi4vLm52bS92ZXJzaW9ucy9ub2RlL3Y1LjMuMC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9idWZmZXIvbm9kZV9tb2R1bGVzL2lzYXJyYXkvaW5kZXguanMiLCIuLi8uLi8ubnZtL3ZlcnNpb25zL25vZGUvdjUuMy4wL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2V2ZW50cy9ldmVudHMuanMiLCIuLi8uLi8ubnZtL3ZlcnNpb25zL25vZGUvdjUuMy4wL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJmYXN0bkV4YW1wbGUvaW5kZXguanMiLCJmYXN0bkV4YW1wbGUvdWkvYXBwLmpzIiwiZmFzdG5FeGFtcGxlL3VpL2Zhc3RuLmpzIiwiZmFzdG5FeGFtcGxlL3VpL2luZGV4LmpzIiwiaW5kZXguanMiLCJub2RlX21vZHVsZXMvY2xhc3Npc3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY2xvbmUvY2xvbmUuanMiLCJub2RlX21vZHVsZXMvY3JlbC9jcmVsLmpzIiwibm9kZV9tb2R1bGVzL2VudGkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZmFzdG4vYmFzZUNvbXBvbmVudC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9iaW5kaW5nLmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL2NvbnRhaW5lckNvbXBvbmVudC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9mYW5jeVByb3BzLmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL2Zpcm1lci5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9mdW5jdGlvbkVtaXR0ZXIuanMiLCJub2RlX21vZHVsZXMvZmFzdG4vZ2VuZXJpY0NvbXBvbmVudC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9pcy5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi9saXN0Q29tcG9uZW50LmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL3Byb3BlcnR5LmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL3NjaGVkdWxlLmpzIiwibm9kZV9tb2R1bGVzL2Zhc3RuL3RlbXBsYXRlckNvbXBvbmVudC5qcyIsIm5vZGVfbW9kdWxlcy9mYXN0bi90ZXh0Q29tcG9uZW50LmpzIiwibm9kZV9tb2R1bGVzL2ZsYXQtbWVyZ2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaXMtaW5zdGFuY2UvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbXVsdGltYXAvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbmF0dXJhbC1zZWxlY3Rpb24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvb2JqZWN0LWFzc2lnbi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wc2V1ZG8td29ya2VyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3BzZXVkby13b3JrZXIvcG9seWZpbGwuanMiLCJub2RlX21vZHVsZXMvc2FtZS12YWx1ZS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9zZXRpZnkvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc2V0cHJvdG90eXBlb2YvaW5kZXguanMiLCJub2RlX21vZHVsZXMvc2h1di9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy93aGF0LWNoYW5nZWQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvd2hhdC1jaGFuZ2VkL25vZGVfbW9kdWxlcy9kZWVwLWVxdWFsL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3doYXQtY2hhbmdlZC9ub2RlX21vZHVsZXMvZGVlcC1lcXVhbC9saWIvaXNfYXJndW1lbnRzLmpzIiwibm9kZV9tb2R1bGVzL3doYXQtY2hhbmdlZC9ub2RlX21vZHVsZXMvZGVlcC1lcXVhbC9saWIva2V5cy5qcyIsIi4uL3Zpc2NvdXMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN0SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDOTZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDNUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNsbUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDek9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeE5BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNsSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcbiAgJ3VzZSBzdHJpY3QnXG5cbiAgdmFyIGxvb2t1cCA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJ1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuICB2YXIgUExVUyA9ICcrJy5jaGFyQ29kZUF0KDApXG4gIHZhciBTTEFTSCA9ICcvJy5jaGFyQ29kZUF0KDApXG4gIHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuICB2YXIgTE9XRVIgPSAnYScuY2hhckNvZGVBdCgwKVxuICB2YXIgVVBQRVIgPSAnQScuY2hhckNvZGVBdCgwKVxuICB2YXIgUExVU19VUkxfU0FGRSA9ICctJy5jaGFyQ29kZUF0KDApXG4gIHZhciBTTEFTSF9VUkxfU0FGRSA9ICdfJy5jaGFyQ29kZUF0KDApXG5cbiAgZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcbiAgICB2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG4gICAgaWYgKGNvZGUgPT09IFBMVVMgfHwgY29kZSA9PT0gUExVU19VUkxfU0FGRSkgcmV0dXJuIDYyIC8vICcrJ1xuICAgIGlmIChjb2RlID09PSBTTEFTSCB8fCBjb2RlID09PSBTTEFTSF9VUkxfU0FGRSkgcmV0dXJuIDYzIC8vICcvJ1xuICAgIGlmIChjb2RlIDwgTlVNQkVSKSByZXR1cm4gLTEgLy8gbm8gbWF0Y2hcbiAgICBpZiAoY29kZSA8IE5VTUJFUiArIDEwKSByZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcbiAgICBpZiAoY29kZSA8IFVQUEVSICsgMjYpIHJldHVybiBjb2RlIC0gVVBQRVJcbiAgICBpZiAoY29kZSA8IExPV0VSICsgMjYpIHJldHVybiBjb2RlIC0gTE9XRVIgKyAyNlxuICB9XG5cbiAgZnVuY3Rpb24gYjY0VG9CeXRlQXJyYXkgKGI2NCkge1xuICAgIHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG5cbiAgICBpZiAoYjY0Lmxlbmd0aCAlIDQgPiAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuICAgIH1cblxuICAgIC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG4gICAgLy8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuICAgIC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuICAgIC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuICAgIC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2VcbiAgICB2YXIgbGVuID0gYjY0Lmxlbmd0aFxuICAgIHBsYWNlSG9sZGVycyA9IGI2NC5jaGFyQXQobGVuIC0gMikgPT09ICc9JyA/IDIgOiBiNjQuY2hhckF0KGxlbiAtIDEpID09PSAnPScgPyAxIDogMFxuXG4gICAgLy8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG4gICAgYXJyID0gbmV3IEFycihiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cbiAgICAvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG4gICAgbCA9IHBsYWNlSG9sZGVycyA+IDAgPyBiNjQubGVuZ3RoIC0gNCA6IGI2NC5sZW5ndGhcblxuICAgIHZhciBMID0gMFxuXG4gICAgZnVuY3Rpb24gcHVzaCAodikge1xuICAgICAgYXJyW0wrK10gPSB2XG4gICAgfVxuXG4gICAgZm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuICAgICAgdG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxOCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCAxMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA8PCA2KSB8IGRlY29kZShiNjQuY2hhckF0KGkgKyAzKSlcbiAgICAgIHB1c2goKHRtcCAmIDB4RkYwMDAwKSA+PiAxNilcbiAgICAgIHB1c2goKHRtcCAmIDB4RkYwMCkgPj4gOClcbiAgICAgIHB1c2godG1wICYgMHhGRilcbiAgICB9XG5cbiAgICBpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG4gICAgICB0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPj4gNClcbiAgICAgIHB1c2godG1wICYgMHhGRilcbiAgICB9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuICAgICAgdG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxMCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCA0KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpID4+IDIpXG4gICAgICBwdXNoKCh0bXAgPj4gOCkgJiAweEZGKVxuICAgICAgcHVzaCh0bXAgJiAweEZGKVxuICAgIH1cblxuICAgIHJldHVybiBhcnJcbiAgfVxuXG4gIGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQgKHVpbnQ4KSB7XG4gICAgdmFyIGlcbiAgICB2YXIgZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcbiAgICB2YXIgb3V0cHV0ID0gJydcbiAgICB2YXIgdGVtcCwgbGVuZ3RoXG5cbiAgICBmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuICAgICAgcmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG4gICAgICByZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcbiAgICB9XG5cbiAgICAvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG4gICAgZm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG4gICAgICB0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuICAgICAgb3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuICAgIH1cblxuICAgIC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcbiAgICBzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgdGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG4gICAgICAgIG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuICAgICAgICBvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcbiAgICAgICAgb3V0cHV0ICs9ICc9PSdcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgdGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcbiAgICAgICAgb3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuICAgICAgICBvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcbiAgICAgICAgb3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG4gICAgICAgIG91dHB1dCArPSAnPSdcbiAgICAgICAgYnJlYWtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgcmV0dXJuIG91dHB1dFxuICB9XG5cbiAgZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG4gIGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxudmFyIHJvb3RQYXJlbnQgPSB7fVxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBEdWUgdG8gdmFyaW91cyBicm93c2VyIGJ1Z3MsIHNvbWV0aW1lcyB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uIHdpbGwgYmUgdXNlZCBldmVuXG4gKiB3aGVuIHRoZSBicm93c2VyIHN1cHBvcnRzIHR5cGVkIGFycmF5cy5cbiAqXG4gKiBOb3RlOlxuICpcbiAqICAgLSBGaXJlZm94IDQtMjkgbGFja3Mgc3VwcG9ydCBmb3IgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMsXG4gKiAgICAgU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzguXG4gKlxuICogICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogICAtIElFMTAgaGFzIGEgYnJva2VuIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhcnJheXMgb2ZcbiAqICAgICBpbmNvcnJlY3QgbGVuZ3RoIGluIHNvbWUgc2l0dWF0aW9ucy5cblxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXlcbiAqIGdldCB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uLCB3aGljaCBpcyBzbG93ZXIgYnV0IGJlaGF2ZXMgY29ycmVjdGx5LlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUICE9PSB1bmRlZmluZWRcbiAgPyBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVFxuICA6IHR5cGVkQXJyYXlTdXBwb3J0KClcblxuZnVuY3Rpb24gdHlwZWRBcnJheVN1cHBvcnQgKCkge1xuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDIgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgYXJyLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbmZ1bmN0aW9uIGtNYXhMZW5ndGggKCkge1xuICByZXR1cm4gQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgICA/IDB4N2ZmZmZmZmZcbiAgICA6IDB4M2ZmZmZmZmZcbn1cblxuLyoqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGhhdmUgdGhlaXJcbiAqIHByb3RvdHlwZSBjaGFuZ2VkIHRvIGBCdWZmZXIucHJvdG90eXBlYC4gRnVydGhlcm1vcmUsIGBCdWZmZXJgIGlzIGEgc3ViY2xhc3Mgb2ZcbiAqIGBVaW50OEFycmF5YCwgc28gdGhlIHJldHVybmVkIGluc3RhbmNlcyB3aWxsIGhhdmUgYWxsIHRoZSBub2RlIGBCdWZmZXJgIG1ldGhvZHNcbiAqIGFuZCB0aGUgYFVpbnQ4QXJyYXlgIG1ldGhvZHMuIFNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0XG4gKiByZXR1cm5zIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIFRoZSBgVWludDhBcnJheWAgcHJvdG90eXBlIHJlbWFpbnMgdW5tb2RpZmllZC5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChhcmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICAvLyBBdm9pZCBnb2luZyB0aHJvdWdoIGFuIEFyZ3VtZW50c0FkYXB0b3JUcmFtcG9saW5lIGluIHRoZSBjb21tb24gY2FzZS5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHJldHVybiBuZXcgQnVmZmVyKGFyZywgYXJndW1lbnRzWzFdKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKGFyZylcbiAgfVxuXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzLmxlbmd0aCA9IDBcbiAgICB0aGlzLnBhcmVudCA9IHVuZGVmaW5lZFxuICB9XG5cbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiBmcm9tTnVtYmVyKHRoaXMsIGFyZylcbiAgfVxuXG4gIC8vIFNsaWdodGx5IGxlc3MgY29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHRoaXMsIGFyZywgYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBhcmd1bWVudHNbMV0gOiAndXRmOCcpXG4gIH1cblxuICAvLyBVbnVzdWFsLlxuICByZXR1cm4gZnJvbU9iamVjdCh0aGlzLCBhcmcpXG59XG5cbi8vIFRPRE86IExlZ2FjeSwgbm90IG5lZWRlZCBhbnltb3JlLiBSZW1vdmUgaW4gbmV4dCBtYWpvciB2ZXJzaW9uLlxuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIGZyb21OdW1iZXIgKHRoYXQsIGxlbmd0aCkge1xuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGxlbmd0aCkgfCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdGhhdFtpXSA9IDBcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAodGhhdCwgc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgLy8gQXNzdW1wdGlvbjogYnl0ZUxlbmd0aCgpIHJldHVybiB2YWx1ZSBpcyBhbHdheXMgPCBrTWF4TGVuZ3RoLlxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICB0aGF0LndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iamVjdCkpIHJldHVybiBmcm9tQnVmZmVyKHRoYXQsIG9iamVjdClcblxuICBpZiAoaXNBcnJheShvYmplY3QpKSByZXR1cm4gZnJvbUFycmF5KHRoYXQsIG9iamVjdClcblxuICBpZiAob2JqZWN0ID09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtdXN0IHN0YXJ0IHdpdGggbnVtYmVyLCBidWZmZXIsIGFycmF5IG9yIHN0cmluZycpXG4gIH1cblxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChvYmplY3QuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBmcm9tVHlwZWRBcnJheSh0aGF0LCBvYmplY3QpXG4gICAgfVxuICAgIGlmIChvYmplY3QgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih0aGF0LCBvYmplY3QpXG4gICAgfVxuICB9XG5cbiAgaWYgKG9iamVjdC5sZW5ndGgpIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iamVjdClcblxuICByZXR1cm4gZnJvbUpzb25PYmplY3QodGhhdCwgb2JqZWN0KVxufVxuXG5mdW5jdGlvbiBmcm9tQnVmZmVyICh0aGF0LCBidWZmZXIpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYnVmZmVyLmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGJ1ZmZlci5jb3B5KHRoYXQsIDAsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRHVwbGljYXRlIG9mIGZyb21BcnJheSgpIHRvIGtlZXAgZnJvbUFycmF5KCkgbW9ub21vcnBoaWMuXG5mdW5jdGlvbiBmcm9tVHlwZWRBcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgLy8gVHJ1bmNhdGluZyB0aGUgZWxlbWVudHMgaXMgcHJvYmFibHkgbm90IHdoYXQgcGVvcGxlIGV4cGVjdCBmcm9tIHR5cGVkXG4gIC8vIGFycmF5cyB3aXRoIEJZVEVTX1BFUl9FTEVNRU5UID4gMSBidXQgaXQncyBjb21wYXRpYmxlIHdpdGggdGhlIGJlaGF2aW9yXG4gIC8vIG9mIHRoZSBvbGQgQnVmZmVyIGNvbnN0cnVjdG9yLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5QnVmZmVyICh0aGF0LCBhcnJheSkge1xuICBhcnJheS5ieXRlTGVuZ3RoIC8vIHRoaXMgdGhyb3dzIGlmIGBhcnJheWAgaXMgbm90IGEgdmFsaWQgQXJyYXlCdWZmZXJcblxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQgPSBmcm9tVHlwZWRBcnJheSh0aGF0LCBuZXcgVWludDhBcnJheShhcnJheSkpXG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5TGlrZSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIERlc2VyaWFsaXplIHsgdHlwZTogJ0J1ZmZlcicsIGRhdGE6IFsxLDIsMywuLi5dIH0gaW50byBhIEJ1ZmZlciBvYmplY3QuXG4vLyBSZXR1cm5zIGEgemVyby1sZW5ndGggYnVmZmVyIGZvciBpbnB1dHMgdGhhdCBkb24ndCBjb25mb3JtIHRvIHRoZSBzcGVjLlxuZnVuY3Rpb24gZnJvbUpzb25PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICB2YXIgYXJyYXlcbiAgdmFyIGxlbmd0aCA9IDBcblxuICBpZiAob2JqZWN0LnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkob2JqZWN0LmRhdGEpKSB7XG4gICAgYXJyYXkgPSBvYmplY3QuZGF0YVxuICAgIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgfVxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5pZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuICBCdWZmZXIuX19wcm90b19fID0gVWludDhBcnJheVxufSBlbHNlIHtcbiAgLy8gcHJlLXNldCBmb3IgdmFsdWVzIHRoYXQgbWF5IGV4aXN0IGluIHRoZSBmdXR1cmVcbiAgQnVmZmVyLnByb3RvdHlwZS5sZW5ndGggPSB1bmRlZmluZWRcbiAgQnVmZmVyLnByb3RvdHlwZS5wYXJlbnQgPSB1bmRlZmluZWRcbn1cblxuZnVuY3Rpb24gYWxsb2NhdGUgKHRoYXQsIGxlbmd0aCkge1xuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0Lmxlbmd0aCA9IGxlbmd0aFxuICB9XG5cbiAgdmFyIGZyb21Qb29sID0gbGVuZ3RoICE9PSAwICYmIGxlbmd0aCA8PSBCdWZmZXIucG9vbFNpemUgPj4+IDFcbiAgaWYgKGZyb21Qb29sKSB0aGF0LnBhcmVudCA9IHJvb3RQYXJlbnRcblxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBjaGVja2VkIChsZW5ndGgpIHtcbiAgLy8gTm90ZTogY2Fubm90IHVzZSBgbGVuZ3RoIDwga01heExlbmd0aGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBrTWF4TGVuZ3RoKCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsga01heExlbmd0aCgpLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTbG93QnVmZmVyKSkgcmV0dXJuIG5ldyBTbG93QnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuICBkZWxldGUgYnVmLnBhcmVudFxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIGlzQnVmZmVyIChiKSB7XG4gIHJldHVybiAhIShiICE9IG51bGwgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIH1cblxuICBpZiAoYSA9PT0gYikgcmV0dXJuIDBcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcblxuICB2YXIgaSA9IDBcbiAgdmFyIGxlbiA9IE1hdGgubWluKHgsIHkpXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIGJyZWFrXG5cbiAgICArK2lcbiAgfVxuXG4gIGlmIChpICE9PSBsZW4pIHtcbiAgICB4ID0gYVtpXVxuICAgIHkgPSBiW2ldXG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gaXNFbmNvZGluZyAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiBjb25jYXQgKGxpc3QsIGxlbmd0aCkge1xuICBpZiAoIWlzQXJyYXkobGlzdCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3QgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzLicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSBzdHJpbmcgPSAnJyArIHN0cmluZ1xuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgLy8gRGVwcmVjYXRlZFxuICAgICAgY2FzZSAncmF3JzpcbiAgICAgIGNhc2UgJ3Jhd3MnOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIHN0YXJ0ID0gc3RhcnQgfCAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA9PT0gSW5maW5pdHkgPyB0aGlzLmxlbmd0aCA6IGVuZCB8IDBcblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoZW5kIDw9IHN0YXJ0KSByZXR1cm4gJydcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuLy8gVGhlIHByb3BlcnR5IGlzIHVzZWQgYnkgYEJ1ZmZlci5pc0J1ZmZlcmAgYW5kIGBpcy1idWZmZXJgIChpbiBTYWZhcmkgNS03KSB0byBkZXRlY3Rcbi8vIEJ1ZmZlciBpbnN0YW5jZXMuXG5CdWZmZXIucHJvdG90eXBlLl9pc0J1ZmZlciA9IHRydWVcblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoIHwgMFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIDBcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCkge1xuICBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIGJ5dGVPZmZzZXQgPSAweDdmZmZmZmZmXG4gIGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkgYnl0ZU9mZnNldCA9IC0weDgwMDAwMDAwXG4gIGJ5dGVPZmZzZXQgPj49IDBcblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVybiAtMVxuICBpZiAoYnl0ZU9mZnNldCA+PSB0aGlzLmxlbmd0aCkgcmV0dXJuIC0xXG5cbiAgLy8gTmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBNYXRoLm1heCh0aGlzLmxlbmd0aCArIGJ5dGVPZmZzZXQsIDApXG5cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHJldHVybiAtMSAvLyBzcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZyBhbHdheXMgZmFpbHNcbiAgICByZXR1cm4gU3RyaW5nLnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCBbIHZhbCBdLCBieXRlT2Zmc2V0KVxuICB9XG5cbiAgZnVuY3Rpb24gYXJyYXlJbmRleE9mIChhcnIsIHZhbCwgYnl0ZU9mZnNldCkge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKHZhciBpID0gMDsgYnl0ZU9mZnNldCArIGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhcnJbYnl0ZU9mZnNldCArIGldID09PSB2YWxbZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXhdKSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgZm91bmRJbmRleCA9IGlcbiAgICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsLmxlbmd0aCkgcmV0dXJuIGJ5dGVPZmZzZXQgKyBmb3VuZEluZGV4XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3VuZEluZGV4ID0gLTFcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKGlzTmFOKHBhcnNlZCkpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoIHwgMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIC8vIGxlZ2FjeSB3cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aCkgLSByZW1vdmUgaW4gdjAuMTNcbiAgfSBlbHNlIHtcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGggfCAwXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICAvLyBXYXJuaW5nOiBtYXhMZW5ndGggbm90IHRha2VuIGludG8gYWNjb3VudCBpbiBiYXNlNjRXcml0ZVxuICAgICAgICByZXR1cm4gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHVjczJXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG4gIHZhciByZXMgPSBbXVxuXG4gIHZhciBpID0gc3RhcnRcbiAgd2hpbGUgKGkgPCBlbmQpIHtcbiAgICB2YXIgZmlyc3RCeXRlID0gYnVmW2ldXG4gICAgdmFyIGNvZGVQb2ludCA9IG51bGxcbiAgICB2YXIgYnl0ZXNQZXJTZXF1ZW5jZSA9IChmaXJzdEJ5dGUgPiAweEVGKSA/IDRcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4REYpID8gM1xuICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICA6IDFcblxuICAgIGlmIChpICsgYnl0ZXNQZXJTZXF1ZW5jZSA8PSBlbmQpIHtcbiAgICAgIHZhciBzZWNvbmRCeXRlLCB0aGlyZEJ5dGUsIGZvdXJ0aEJ5dGUsIHRlbXBDb2RlUG9pbnRcblxuICAgICAgc3dpdGNoIChieXRlc1BlclNlcXVlbmNlKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiAoZmlyc3RCeXRlIDwgMHg4MCkge1xuICAgICAgICAgICAgY29kZVBvaW50ID0gZmlyc3RCeXRlXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4MUYpIDw8IDB4NiB8IChzZWNvbmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3Rikge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweEMgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4NiB8ICh0aGlyZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGRiAmJiAodGVtcENvZGVQb2ludCA8IDB4RDgwMCB8fCB0ZW1wQ29kZVBvaW50ID4gMHhERkZGKSkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBmb3VydGhCeXRlID0gYnVmW2kgKyAzXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAoZm91cnRoQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHgxMiB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHhDIHwgKHRoaXJkQnl0ZSAmIDB4M0YpIDw8IDB4NiB8IChmb3VydGhCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHhGRkZGICYmIHRlbXBDb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPT09IG51bGwpIHtcbiAgICAgIC8vIHdlIGRpZCBub3QgZ2VuZXJhdGUgYSB2YWxpZCBjb2RlUG9pbnQgc28gaW5zZXJ0IGFcbiAgICAgIC8vIHJlcGxhY2VtZW50IGNoYXIgKFUrRkZGRCkgYW5kIGFkdmFuY2Ugb25seSAxIGJ5dGVcbiAgICAgIGNvZGVQb2ludCA9IDB4RkZGRFxuICAgICAgYnl0ZXNQZXJTZXF1ZW5jZSA9IDFcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA+IDB4RkZGRikge1xuICAgICAgLy8gZW5jb2RlIHRvIHV0ZjE2IChzdXJyb2dhdGUgcGFpciBkYW5jZSlcbiAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwXG4gICAgICByZXMucHVzaChjb2RlUG9pbnQgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApXG4gICAgICBjb2RlUG9pbnQgPSAweERDMDAgfCBjb2RlUG9pbnQgJiAweDNGRlxuICAgIH1cblxuICAgIHJlcy5wdXNoKGNvZGVQb2ludClcbiAgICBpICs9IGJ5dGVzUGVyU2VxdWVuY2VcbiAgfVxuXG4gIHJldHVybiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkocmVzKVxufVxuXG4vLyBCYXNlZCBvbiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMjc0NzI3Mi82ODA3NDIsIHRoZSBicm93c2VyIHdpdGhcbi8vIHRoZSBsb3dlc3QgbGltaXQgaXMgQ2hyb21lLCB3aXRoIDB4MTAwMDAgYXJncy5cbi8vIFdlIGdvIDEgbWFnbml0dWRlIGxlc3MsIGZvciBzYWZldHlcbnZhciBNQVhfQVJHVU1FTlRTX0xFTkdUSCA9IDB4MTAwMFxuXG5mdW5jdGlvbiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkgKGNvZGVQb2ludHMpIHtcbiAgdmFyIGxlbiA9IGNvZGVQb2ludHMubGVuZ3RoXG4gIGlmIChsZW4gPD0gTUFYX0FSR1VNRU5UU19MRU5HVEgpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNvZGVQb2ludHMpIC8vIGF2b2lkIGV4dHJhIHNsaWNlKClcbiAgfVxuXG4gIC8vIERlY29kZSBpbiBjaHVua3MgdG8gYXZvaWQgXCJjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWRcIi5cbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgU3RyaW5nLFxuICAgICAgY29kZVBvaW50cy5zbGljZShpLCBpICs9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKVxuICAgIClcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldICYgMHg3RilcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGJpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZlxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBuZXdCdWYgPSB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpXG4gICAgbmV3QnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZClcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfVxuXG4gIGlmIChuZXdCdWYubGVuZ3RoKSBuZXdCdWYucGFyZW50ID0gdGhpcy5wYXJlbnQgfHwgdGhpc1xuXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG4gIH1cblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdXG4gIHZhciBtdWwgPSAxXG4gIHdoaWxlIChieXRlTGVuZ3RoID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiByZWFkVUludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludEJFID0gZnVuY3Rpb24gcmVhZEludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiByZWFkRmxvYXRMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gcmVhZERvdWJsZUJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignYnVmZmVyIG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludExFID0gZnVuY3Rpb24gd3JpdGVVSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IDBcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gdmFsdWUgPCAwID8gMSA6IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAob2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gd3JpdGVGbG9hdExFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiBjb3B5ICh0YXJnZXQsIHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXRTdGFydCA+PSB0YXJnZXQubGVuZ3RoKSB0YXJnZXRTdGFydCA9IHRhcmdldC5sZW5ndGhcbiAgaWYgKCF0YXJnZXRTdGFydCkgdGFyZ2V0U3RhcnQgPSAwXG4gIGlmIChlbmQgPiAwICYmIGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuIDBcbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgdGhpcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAodGFyZ2V0U3RhcnQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICB9XG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0IDwgZW5kIC0gc3RhcnQpIHtcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgKyBzdGFydFxuICB9XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG4gIHZhciBpXG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCAmJiBzdGFydCA8IHRhcmdldFN0YXJ0ICYmIHRhcmdldFN0YXJ0IDwgZW5kKSB7XG4gICAgLy8gZGVzY2VuZGluZyBjb3B5IGZyb20gZW5kXG4gICAgZm9yIChpID0gbGVuIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2UgaWYgKGxlbiA8IDEwMDAgfHwgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gYXNjZW5kaW5nIGNvcHkgZnJvbSBzdGFydFxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksXG4gICAgICB0YXJnZXRTdGFydFxuICAgIClcbiAgfVxuXG4gIHJldHVybiBsZW5cbn1cblxuLy8gZmlsbCh2YWx1ZSwgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiBmaWxsICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGlmIChlbmQgPCBzdGFydCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCA8IHN0YXJ0JylcblxuICAvLyBGaWxsIDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDAgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gdmFsdWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gdXRmOFRvQnl0ZXModmFsdWUudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS1aYS16LV9dL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGNvbnZlcnRzIHN0cmluZ3Mgd2l0aCBsZW5ndGggPCAyIHRvICcnXG4gIGlmIChzdHIubGVuZ3RoIDwgMikgcmV0dXJuICcnXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cmluZywgdW5pdHMpIHtcbiAgdW5pdHMgPSB1bml0cyB8fCBJbmZpbml0eVxuICB2YXIgY29kZVBvaW50XG4gIHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoXG4gIHZhciBsZWFkU3Vycm9nYXRlID0gbnVsbFxuICB2YXIgYnl0ZXMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCFsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG4gICAgICAgIGlmIChjb2RlUG9pbnQgPiAweERCRkYpIHtcbiAgICAgICAgICAvLyB1bmV4cGVjdGVkIHRyYWlsXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIGlmIChpICsgMSA9PT0gbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdW5wYWlyZWQgbGVhZFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcblxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyAyIGxlYWRzIGluIGEgcm93XG4gICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIHZhbGlkIHN1cnJvZ2F0ZSBwYWlyXG4gICAgICBjb2RlUG9pbnQgPSAobGVhZFN1cnJvZ2F0ZSAtIDB4RDgwMCA8PCAxMCB8IGNvZGVQb2ludCAtIDB4REMwMCkgKyAweDEwMDAwXG4gICAgfSBlbHNlIGlmIChsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAvLyB2YWxpZCBibXAgY2hhciwgYnV0IGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICB9XG5cbiAgICBsZWFkU3Vycm9nYXRlID0gbnVsbFxuXG4gICAgLy8gZW5jb2RlIHV0ZjhcbiAgICBpZiAoY29kZVBvaW50IDwgMHg4MCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAxKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKGNvZGVQb2ludClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4ODAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgfCAweEMwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAzKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDIHwgMHhFMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gNCkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4MTIgfCAweEYwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvZGUgcG9pbnQnKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBieXRlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyLCB1bml0cykge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuXG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoYmFzZTY0Y2xlYW4oc3RyKSlcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cbiIsInZhciB0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbChhcnIpID09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwiZXhwb3J0cy5yZWFkID0gZnVuY3Rpb24gKGJ1ZmZlciwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG1cbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gZSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIG0gPSBlICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIGUgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IG1MZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgbSA9IG0gKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBpZiAoZSA9PT0gMCkge1xuICAgIGUgPSAxIC0gZUJpYXNcbiAgfSBlbHNlIGlmIChlID09PSBlTWF4KSB7XG4gICAgcmV0dXJuIG0gPyBOYU4gOiAoKHMgPyAtMSA6IDEpICogSW5maW5pdHkpXG4gIH0gZWxzZSB7XG4gICAgbSA9IG0gKyBNYXRoLnBvdygyLCBtTGVuKVxuICAgIGUgPSBlIC0gZUJpYXNcbiAgfVxuICByZXR1cm4gKHMgPyAtMSA6IDEpICogbSAqIE1hdGgucG93KDIsIGUgLSBtTGVuKVxufVxuXG5leHBvcnRzLndyaXRlID0gZnVuY3Rpb24gKGJ1ZmZlciwgdmFsdWUsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtLCBjXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAodmFsdWUgKiBjIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IGUgKyBlQmlhc1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gdmFsdWUgKiBNYXRoLnBvdygyLCBlQmlhcyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSAwXG4gICAgfVxuICB9XG5cbiAgZm9yICg7IG1MZW4gPj0gODsgYnVmZmVyW29mZnNldCArIGldID0gbSAmIDB4ZmYsIGkgKz0gZCwgbSAvPSAyNTYsIG1MZW4gLT0gOCkge31cblxuICBlID0gKGUgPDwgbUxlbikgfCBtXG4gIGVMZW4gKz0gbUxlblxuICBmb3IgKDsgZUxlbiA+IDA7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IGUgJiAweGZmLCBpICs9IGQsIGUgLz0gMjU2LCBlTGVuIC09IDgpIHt9XG5cbiAgYnVmZmVyW29mZnNldCArIGkgLSBkXSB8PSBzICogMTI4XG59XG4iLCJyZXF1aXJlKCdwc2V1ZG8td29ya2VyL3BvbHlmaWxsJyk7XG5cbnZhciBteVdvcmtlciA9IG5ldyBXb3JrZXIoJ2FwcC9hcHAuYnJvd3Nlci5qcycpLFxuICAgIHVpID0gcmVxdWlyZSgnLi91aScpKG15V29ya2VyKTtcbiIsInZhciBmYXN0biA9IHJlcXVpcmUoJy4vZmFzdG4nKSxcbiAgICBMZW56ZSA9IHJlcXVpcmUoJy4uLy4uLycpLFxuICAgIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50cycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHdvcmtlcil7XG4gICAgdmFyIGFwcCA9IG5ldyBFdmVudEVtaXR0ZXIoKSxcbiAgICAgICAgbGVuemUgPSBMZW56ZS5yZXBsaWNhbnQoYXBwLCB7XG4gICAgICAgICAgICByZWNlaXZlOiBmdW5jdGlvbihjYWxsYmFjayl7XG4gICAgICAgICAgICAgICAgd29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbihtZXNzYWdlKXtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2sobWVzc2FnZS5kYXRhKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzZW5kOiBmdW5jdGlvbihkYXRhKXtcbiAgICAgICAgICAgICAgICB3b3JrZXIucG9zdE1lc3NhZ2UoZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgbGVuemUub24oJ2NoYW5nZScsIGZ1bmN0aW9uKGNoYW5nZXMpe1xuICAgICAgICBmb3IodmFyIGkgPSAxOyBpIDwgY2hhbmdlcy5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICB2YXIgY2hhbmdlID0gbGVuemUuZ2V0Q2hhbmdlSW5mbyhjaGFuZ2VzW2ldKTtcblxuICAgICAgICAgICAgZmFzdG4uTW9kZWwuZW1pdChjaGFuZ2UudGFyZ2V0LCBjaGFuZ2Uua2V5LCBjaGFuZ2UudmFsdWUpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gYXBwO1xufTsiLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJ2Zhc3RuJykoe1xuICAgIF9nZW5lcmljOiByZXF1aXJlKCdmYXN0bi9nZW5lcmljQ29tcG9uZW50JyksXG4gICAgbGlzdDogcmVxdWlyZSgnZmFzdG4vbGlzdENvbXBvbmVudCcpLFxuICAgIHRleHQ6IHJlcXVpcmUoJ2Zhc3RuL3RleHRDb21wb25lbnQnKSxcbiAgICB0ZW1wbGF0ZXI6IHJlcXVpcmUoJ2Zhc3RuL3RlbXBsYXRlckNvbXBvbmVudCcpLFxufSwgdHJ1ZSk7XG4iLCJ2YXIgZmFzdG4gPSByZXF1aXJlKCcuL2Zhc3RuJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24od29ya2VyKXtcbiAgICB2YXIgYXBwID0gcmVxdWlyZSgnLi9hcHAnKSh3b3JrZXIpO1xuXG4gICAgZnVuY3Rpb24gcmVuZGVyVXNlcigpe1xuICAgICAgICByZXR1cm4gZmFzdG4oJ2RpdicsIHtjbGFzczogJ3VzZXInfSxcbiAgICAgICAgICAgICdOYW1lOiAnLCBmYXN0bi5iaW5kaW5nKCduYW1lJyksXG4gICAgICAgICAgICAnIC0gJyxcbiAgICAgICAgICAgICdBZ2U6ICcsIGZhc3RuLmJpbmRpbmcoJ2RvYicsIGZ1bmN0aW9uKGRvYil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0WWVhcigpIC0gZG9iLmdldFllYXIoKTtcbiAgICAgICAgICAgIH0pXG4gICAgICAgIClcbiAgICAgICAgLmJpbmRpbmcoJ2l0ZW0nKVxuICAgIH07XG5cbiAgICB2YXIgdWkgPSBmYXN0bignZGl2JyxcbiAgICAgICAgICAgIGZhc3RuKCdkaXYnLCB7Y2xhc3M6ICdzZWFyY2gnfSxcbiAgICAgICAgICAgICAgICAnU2VhcmNoOiAnLFxuICAgICAgICAgICAgICAgIGZhc3RuKCdpbnB1dCcpXG4gICAgICAgICAgICAgICAgLm9uKCdrZXl1cCcsIGZ1bmN0aW9uKGV2ZW50LCBzY29wZSl7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLmdldCgnLicpLnNldFNlYXJjaChldmVudC50YXJnZXQudmFsdWUpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApLFxuICAgICAgICAgICAgZmFzdG4oJ3RlbXBsYXRlcicsIHtcbiAgICAgICAgICAgICAgICBkYXRhOiBmYXN0bi5iaW5kaW5nKCdzZWxlY3RlZFVzZXInKSxcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZTogZnVuY3Rpb24obW9kZWwpe1xuICAgICAgICAgICAgICAgICAgICBpZihtb2RlbC5nZXQoJ2l0ZW0nKSl7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFzdG4oJ2RpdicsIHtjbGFzczogJ3NlbGVjdGVkVXNlcid9LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdTZWxlY3RlZFVzZXI6ICcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFzdG4oJ2lucHV0Jywge3ZhbHVlOiBmYXN0bi5iaW5kaW5nKCduYW1lJyl9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5vbigna2V5dXAnLCBmdW5jdGlvbihldmVudCwgc2NvcGUpe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZS5nZXQoJy4nKS5zZXROYW1lKGV2ZW50LnRhcmdldC52YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5iaW5kaW5nKCdpdGVtJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIGZhc3RuKCdoMicsICdBbGwgdXNlcnM6JyksXG4gICAgICAgICAgICBmYXN0bignbGlzdCcsIHtcbiAgICAgICAgICAgICAgICBjbGFzczogJ3VzZXJzJyxcbiAgICAgICAgICAgICAgICBpdGVtczogZmFzdG4uYmluZGluZygndmlzaWJsZVVzZXJzfConKSxcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZTogZnVuY3Rpb24oKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlbmRlclVzZXIoKS5vbignY2xpY2snLCBmdW5jdGlvbihldmVudCwgc2NvcGUpe1xuICAgICAgICAgICAgICAgICAgICAgICAgYXBwLnNldFNlbGVjdGVkVXNlcihzY29wZS5nZXQoJy4nKSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICkuYXR0YWNoKGFwcCk7XG5cbiAgICB3aW5kb3cub25sb2FkID0gZnVuY3Rpb24oKXtcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh1aS5yZW5kZXIoKS5lbGVtZW50KTtcbiAgICB9XG59OyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKSxcbiAgICB2aXNjb3VzID0gcmVxdWlyZSgndmlzY291cycpLFxuICAgIGlzSW5zdGFuY2UgPSByZXF1aXJlKCdpcy1pbnN0YW5jZScpLFxuICAgIHNodXYgPSByZXF1aXJlKCdzaHV2Jyk7XG5cbnZhciBJTlZPS0UgPSAnaSc7XG52YXIgQ0hBTkdFUyA9ICdjJztcbnZhciBDT05ORUNUID0gJ28nO1xudmFyIFNUQVRFID0gJ3MnO1xudmFyIFJFU1VMVCA9ICdyJztcbnZhciBMRU5aRV9GVU5DVElPTiA9IFN0cmluZy5mcm9tQ2hhckNvZGUoMHgxOTIpO1xuXG5mdW5jdGlvbiBjcmVhdGVDaGFuZ2VzKHNjb3BlLCBjaGFuZ2VzKXtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoY2hhbmdlcyk7XG59XG5cbmZ1bmN0aW9uIGluZmxhdGVDaGFuZ2VzKHNjb3BlLCBkYXRhKXtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShkYXRhKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VNZXNzYWdlKGRhdGEpe1xuICAgIHZhciBtZXNzYWdlID0gZGF0YS5tYXRjaCgvXihcXHcrPylcXDooLiopLyk7XG5cbiAgICBpZihtZXNzYWdlKXtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHR5cGU6IG1lc3NhZ2VbMV0sXG4gICAgICAgICAgICBkYXRhOiBtZXNzYWdlWzJdXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlY2VpdmUoc2NvcGUsIGRhdGEpe1xuICAgIHZhciBtZXNzYWdlID0gcGFyc2VNZXNzYWdlKGRhdGEpO1xuXG4gICAgaWYoIW1lc3NhZ2Upe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYobWVzc2FnZS50eXBlID09PSBJTlZPS0Upe1xuICAgICAgICBzY29wZS5oYW5kbGVGdW5jdGlvbi5hcHBseShudWxsLCBKU09OLnBhcnNlKG1lc3NhZ2UuZGF0YSkpO1xuICAgIH1cblxuICAgIGlmKG1lc3NhZ2UudHlwZSA9PT0gQ09OTkVDVCl7XG4gICAgICAgIHNjb3BlLnNlbmQoQ09OTkVDVCwgc2NvcGUudmlzY291cy5zdGF0ZSgpKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZSgpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG4gICAgdmFyIG5vdyA9IERhdGUubm93KCk7XG5cbiAgICBpZihcbiAgICAgICAgbm93IC0gc2NvcGUubGFzdFVwZGF0ZSA8IHNjb3BlLm1heEludGVydmFsICYmXG4gICAgICAgIG5vdyAtIHNjb3BlLmxhc3RDaGFuZ2UgPiBzY29wZS5kb3plVGltZVxuICAgICl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzY29wZS5sYXN0VXBkYXRlID0gbm93O1xuXG4gICAgdmFyIGNoYW5nZXMgPSBzY29wZS52aXNjb3VzLmNoYW5nZXMoKTtcblxuICAgIGlmKGNoYW5nZXMubGVuZ3RoID4gMSB8fCBjaGFuZ2VzWzBdLmxlbmd0aCA+IDEpe1xuICAgICAgICBzY29wZS5sYXN0Q2hhbmdlID0gbm93O1xuXG4gICAgICAgIHNjb3BlLmxlbnplLmVtaXQoJ2NoYW5nZScsIGNoYW5nZXMpO1xuXG4gICAgICAgIGlmKHNjb3BlLnNlbmQpe1xuICAgICAgICAgICAgc2NvcGUuc2VuZChDSEFOR0VTLCBjaGFuZ2VzKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlRnVuY3Rpb24oc2NvcGUsIGlkLCB0aW1lU3RhbXAsIGFyZ3Mpe1xuICAgIHNjb3BlLmxhc3RDaGFuZ2UgPSBEYXRlLm5vdygpO1xuICAgIHZhciB0YXJnZXRGdW5jdGlvbiA9IHNjb3BlLnZpc2NvdXMuZ2V0SW5zdGFuY2UoaWQpO1xuXG4gICAgaWYodHlwZW9mIHRhcmdldEZ1bmN0aW9uICE9PSAnZnVuY3Rpb24nKXtcbiAgICAgICByZXR1cm4gc2NvcGUucmVzdWx0KGlkLCB0aW1lU3RhbXAsIHt0eXBlOiAnZXJyb3InLCBtZXNzYWdlOiAnVGFyZ2V0IHdhcyBub3QgYSBmdW5jdGlvbid9KTtcbiAgICB9XG5cbiAgICBzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKGlkKS5hcHBseSh0aGlzLCBzY29wZS52aXNjb3VzLmluZmxhdGUoYXJncykpO1xuICAgIHNjb3BlLmxlbnplLnVwZGF0ZSgpO1xuICAgIHNjb3BlLnJlc3VsdChpZCwgdGltZVN0YW1wLCBudWxsKTtcbn1cblxuZnVuY3Rpb24gc2VuZChzY29wZSwgc2VuZCwgdHlwZSwgZGF0YSl7XG4gICAgaWYodHlwZSA9PT0gQ0hBTkdFUyB8fCB0eXBlID09PSBDT05ORUNUKXtcbiAgICAgICAgc2VuZCh0eXBlICsgJzonICsgY3JlYXRlQ2hhbmdlcyhzY29wZSwgZGF0YSkpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc2VuZEludm9rZShzY29wZSwgc2VuZCwgaWQsIHRpbWVTdGFtcCwgYXJncyl7XG4gICAgc2VuZChJTlZPS0UgKyAnOicgKyBKU09OLnN0cmluZ2lmeShbaWQsIHRpbWVTdGFtcCwgYXJnc10pKTtcbn1cblxuZnVuY3Rpb24gc2VuZFJlc3VsdChzY29wZSwgc2VuZCwgaWQsIHRpbWVTdGFtcCwgcmVzdWx0KXtcbiAgICBzZW5kKFJFU1VMVCArICc6JyArIEpTT04uc3RyaW5naWZ5KFtpZCwgdGltZVN0YW1wLCByZXN1bHRdKSk7XG59XG5cbmZ1bmN0aW9uIGdldENoYW5nZUluZm8oc2NvcGUsIGNoYW5nZSl7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgdGFyZ2V0OiBzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKGNoYW5nZVswXSksXG4gICAgICAgIGtleTogY2hhbmdlWzFdLFxuICAgICAgICB0eXBlOiBjaGFuZ2VbMl0sXG4gICAgICAgIHZhbHVlOiBBcnJheS5pc0FycmF5KGNoYW5nZVszXSkgPyBzY29wZS52aXNjb3VzLmdldEluc3RhbmNlKGNoYW5nZVszXSkgOiBjaGFuZ2VbM11cbiAgICB9O1xufVxuXG5mdW5jdGlvbiBoYW5kbGVSZXN1bHQoc2NvcGUsIGRhdGEpe1xuICAgIGRhdGEgPSBKU09OLnBhcnNlKGRhdGEpO1xuICAgIHZhciBmbklkID0gZGF0YVswXSxcbiAgICAgICAgdGltZVN0YW1wID0gZGF0YVsxXSxcbiAgICAgICAgZXJyb3IgPSBkYXRhWzJdLFxuICAgICAgICBzdGFjayA9IHNjb3BlLmludm9rZXNbZGF0YVswXV1bZGF0YVsxXV07XG5cbiAgICBkZWxldGUgc2NvcGUuaW52b2tlc1tkYXRhWzBdXVtkYXRhWzFdXTtcblxuICAgIGlmKCFlcnJvcil7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBlcnJvciA9IG5ldyBFcnJvcihlcnJvci5tZXNzYWdlKTtcbiAgICBlcnJvci5zdGFjayA9IHN0YWNrO1xuICAgIHRocm93IGVycm9yO1xufVxuXG5mdW5jdGlvbiBzZXJpYWxpc2UodmFsdWUpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBpZih0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpe1xuICAgICAgICB2YXIgcmVzdWx0ID0ge1xuICAgICAgICAgICAgbmFtZTogdmFsdWUubmFtZVxuICAgICAgICB9O1xuXG4gICAgICAgIGZvcih2YXIga2V5IGluIHZhbHVlKXtcbiAgICAgICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWVba2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBbcmVzdWx0LCBMRU5aRV9GVU5DVElPTl07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVDYWxsZXIoc2NvcGUsIGNvbmZpZyl7XG4gICAgdmFyIHJlc3VsdCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKGFyZ3VtZW50cywgZnVuY3Rpb24oYXJnKXtcbiAgICAgICAgICAgIGlmKGlzSW5zdGFuY2UoYXJnKSl7XG4gICAgICAgICAgICAgICAgaWYoYXJnIGluc3RhbmNlb2YgRXZlbnQpe1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJMZW56ZSBkb2VzIG5vdCBzdXBwb3J0IHRoZSB0cmFuc21pc3Npb24gb2YgYnJvd3NlciBFdmVudHNcIik7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gYXJnO1xuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgc3RhY2sgPSBuZXcgRXJyb3IoKS5zdGFjayxcbiAgICAgICAgICAgIGZuSWQgPSBzY29wZS52aXNjb3VzLmdldElkKHJlc3VsdCksXG4gICAgICAgICAgICB0aW1lU3RhbXAgPSBEYXRlLm5vdygpO1xuXG4gICAgICAgIHNjb3BlLmludm9rZXNbZm5JZF0gPSBzY29wZS5pbnZva2VzW2ZuSWRdIHx8IHt9O1xuICAgICAgICBzY29wZS5pbnZva2VzW2ZuSWRdW3RpbWVTdGFtcF0gPSBzdGFjaztcbiAgICAgICAgc2NvcGUuaW52b2tlLmNhbGwobnVsbCwgc2NvcGUudmlzY291cy5nZXRJZChyZXN1bHQpLCB0aW1lU3RhbXAsIHNjb3BlLnZpc2NvdXMuZGVzY3JpYmUoYXJncykpO1xuICAgIH07XG4gICAgcmVzdWx0Lm5hbWUgPSBjb25maWcubmFtZTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGRlc2VyaWFsaXNlKGRlZmluaXRpb24pe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBpZihkZWZpbml0aW9uWzFdID09PSBMRU5aRV9GVU5DVElPTil7XG4gICAgICAgIHZhciB2YWx1ZSA9IGRlZmluaXRpb25bMF0sXG4gICAgICAgICAgICByZXN1bHQgPSBjcmVhdGVDYWxsZXIoc2NvcGUsIHZhbHVlKTtcblxuICAgICAgICBmb3IodmFyIGtleSBpbiB2YWx1ZSl7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IHZhbHVlW2tleV07XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaW5pdFNjb3BlKHN0YXRlKXtcbiAgICB2YXIgc3RhdGUgPSBzdGF0ZSB8fCB7fTtcblxuICAgIHZhciBzY29wZSA9IHt9O1xuXG4gICAgc2NvcGUubGVuemUgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG4gICAgc2NvcGUudmlzY291cyA9IHZpc2NvdXMoc3RhdGUsIHtcbiAgICAgICAgc2VyaWFsaXNlcjogc2VyaWFsaXNlLmJpbmQoc2NvcGUpLFxuICAgICAgICBkZXNlcmlhbGlzZXI6IGRlc2VyaWFsaXNlLmJpbmQoc2NvcGUpXG4gICAgfSk7XG5cbiAgICBzY29wZS5sZW56ZS51cGRhdGUgPSB1cGRhdGUuYmluZChzY29wZSk7XG4gICAgc2NvcGUubGVuemUuZ2V0Q2hhbmdlSW5mbyA9IHNodXYoZ2V0Q2hhbmdlSW5mbywgc2NvcGUpO1xuICAgIHNjb3BlLmxlbnplLnN0YXRlID0gc3RhdGU7XG5cbiAgICByZXR1cm4gc2NvcGU7XG59XG5cbmZ1bmN0aW9uIGluaXQoc3RhdGUsIHNldHRpbmdzKXtcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoIDwgMil7XG4gICAgICAgIHNldHRpbmdzID0gc3RhdGU7XG4gICAgICAgIHN0YXRlID0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgc2NvcGUgPSBpbml0U2NvcGUoc3RhdGUpO1xuXG4gICAgc2NvcGUuaGFuZGxlRnVuY3Rpb24gPSBzaHV2KGhhbmRsZUZ1bmN0aW9uLCBzY29wZSk7XG4gICAgc2NvcGUuc2VuZCA9IHNodXYoc2VuZCwgc2NvcGUsIHNldHRpbmdzLnNlbmQpO1xuICAgIHNjb3BlLnJlc3VsdCA9IHNodXYoc2VuZFJlc3VsdCwgc2NvcGUsIHNldHRpbmdzLnNlbmQpO1xuICAgIHNldHRpbmdzLnJlY2VpdmUoc2h1dihyZWNlaXZlLCBzY29wZSkpO1xuXG4gICAgc2NvcGUubWluSW50ZXJ2YWwgPSBzZXR0aW5ncy5taW5JbnRlcnZhbCB8fCAzMDsgLy8gQWJvdXQgdHdvIGZyYW1lc1xuICAgIHNjb3BlLm1heEludGVydmFsID0gc2V0dGluZ3MubWF4SW50ZXJ2YWwgfHwgMzAwOyAvLyBBYm91dCB3aGF0IGh1bWFucyBmaW5kIFwicXVpY2tcIlxuICAgIHNjb3BlLmRvemVUaW1lID0gc2V0dGluZ3MuZG96ZVRpbWUgfHwgMTAwMDsgLy8gQWJvdXQgaG93IGxvbmcgYmV0d2VlbiBsaW5rZWQgaHVtYW4gYWN0aW9uc1xuXG4gICAgc2V0SW50ZXJ2YWwoc2NvcGUubGVuemUudXBkYXRlLCBzY29wZS5taW5JbnRlcnZhbCk7XG5cbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICAgIC8vIExldCBhbGwgcmVwbGljYW50cyBrbm93IGluaXRpYWwgc3RhdGUuXG4gICAgICAgIHNjb3BlLnNlbmQoQ09OTkVDVCwgc2NvcGUudmlzY291cy5zdGF0ZSgpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBzY29wZS5sZW56ZTtcbn1cblxuZnVuY3Rpb24gcmVwbGljYW50KHN0YXRlLCBzZXR0aW5ncyl7XG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA8IDIpe1xuICAgICAgICBzZXR0aW5ncyA9IHN0YXRlO1xuICAgICAgICBzdGF0ZSA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHNjb3BlID0gaW5pdFNjb3BlKHN0YXRlKTtcblxuICAgIHNjb3BlLmludm9rZXMgPSB7fTtcbiAgICBzY29wZS5pbnN0YW5jZUhhc2ggPSB7fTtcblxuICAgIHNldHRpbmdzLnJlY2VpdmUoZnVuY3Rpb24oZGF0YSl7XG5cbiAgICAgICAgdmFyIG1lc3NhZ2UgPSBwYXJzZU1lc3NhZ2UoZGF0YSk7XG5cbiAgICAgICAgaWYoIW1lc3NhZ2Upe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoIXNjb3BlLnJlYWR5ICYmIG1lc3NhZ2UudHlwZSAhPT0gQ09OTkVDVCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdHlwZSA9IG1lc3NhZ2UudHlwZTtcblxuICAgICAgICBpZihcbiAgICAgICAgICAgIHR5cGUgPT09IENIQU5HRVMgfHxcbiAgICAgICAgICAgIHR5cGUgPT09IFNUQVRFIHx8XG4gICAgICAgICAgICB0eXBlID09PSBDT05ORUNUXG4gICAgICAgICl7XG4gICAgICAgICAgICBzY29wZS52aXNjb3VzLmFwcGx5KGluZmxhdGVDaGFuZ2VzKHNjb3BlLCBtZXNzYWdlLmRhdGEpKTtcbiAgICAgICAgICAgIHNjb3BlLmxlbnplLnVwZGF0ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodHlwZSA9PT0gUkVTVUxUKXtcbiAgICAgICAgICAgIGhhbmRsZVJlc3VsdChzY29wZSwgbWVzc2FnZS5kYXRhKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCFzY29wZS5yZWFkeSl7XG4gICAgICAgICAgICBzY29wZS5yZWFkeSA9IHRydWU7XG4gICAgICAgICAgICBzY29wZS5sZW56ZS5lbWl0KCdyZWFkeScpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBzY29wZS5pbnZva2UgPSBzaHV2KHNlbmRJbnZva2UsIHNjb3BlLCBzZXR0aW5ncy5zZW5kKTtcblxuICAgIHNldHRpbmdzLnNlbmQoQ09OTkVDVCArICc6Jyk7XG5cbiAgICByZXR1cm4gc2NvcGUubGVuemVcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbml0O1xubW9kdWxlLmV4cG9ydHMucmVwbGljYW50ID0gcmVwbGljYW50O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihlbGVtZW50KXtcbiAgICB2YXIgbGFzdENsYXNzZXMgPSBbXTtcblxuICAgIHJldHVybiBmdW5jdGlvbihjbGFzc2VzKXtcblxuICAgICAgICBpZighYXJndW1lbnRzLmxlbmd0aCl7XG4gICAgICAgICAgICByZXR1cm4gbGFzdENsYXNzZXMuam9pbignICcpO1xuICAgICAgICB9XG5cbiAgICAgICAgZnVuY3Rpb24gY2xlYW5DbGFzc05hbWUocmVzdWx0LCBjbGFzc05hbWUpe1xuICAgICAgICAgICAgaWYodHlwZW9mIGNsYXNzTmFtZSA9PT0gJ3N0cmluZycgJiYgY2xhc3NOYW1lLm1hdGNoKC9cXHMvKSl7XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lID0gY2xhc3NOYW1lLnNwbGl0KCcgJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKEFycmF5LmlzQXJyYXkoY2xhc3NOYW1lKSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdC5jb25jYXQoY2xhc3NOYW1lLnJlZHVjZShjbGVhbkNsYXNzTmFtZSwgW10pKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYoY2xhc3NOYW1lICE9IG51bGwgJiYgY2xhc3NOYW1lICE9PSAnJyAmJiB0eXBlb2YgY2xhc3NOYW1lICE9PSAnYm9vbGVhbicpe1xuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKFN0cmluZyhjbGFzc05hbWUpLnRyaW0oKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbmV3Q2xhc3NlcyA9IGNsZWFuQ2xhc3NOYW1lKFtdLCBjbGFzc2VzKSxcbiAgICAgICAgICAgIGN1cnJlbnRDbGFzc2VzID0gZWxlbWVudC5jbGFzc05hbWUgPyBlbGVtZW50LmNsYXNzTmFtZS5zcGxpdCgnICcpIDogW107XG5cbiAgICAgICAgbGFzdENsYXNzZXMubWFwKGZ1bmN0aW9uKGNsYXNzTmFtZSl7XG4gICAgICAgICAgICBpZighY2xhc3NOYW1lKXtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBpbmRleCA9IGN1cnJlbnRDbGFzc2VzLmluZGV4T2YoY2xhc3NOYW1lKTtcblxuICAgICAgICAgICAgaWYofmluZGV4KXtcbiAgICAgICAgICAgICAgICBjdXJyZW50Q2xhc3Nlcy5zcGxpY2UoaW5kZXgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBjdXJyZW50Q2xhc3NlcyA9IGN1cnJlbnRDbGFzc2VzLmNvbmNhdChuZXdDbGFzc2VzKTtcbiAgICAgICAgbGFzdENsYXNzZXMgPSBuZXdDbGFzc2VzO1xuXG4gICAgICAgIGVsZW1lbnQuY2xhc3NOYW1lID0gY3VycmVudENsYXNzZXMuam9pbignICcpO1xuICAgIH07XG59O1xuIiwidmFyIGNsb25lID0gKGZ1bmN0aW9uKCkge1xuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIENsb25lcyAoY29waWVzKSBhbiBPYmplY3QgdXNpbmcgZGVlcCBjb3B5aW5nLlxuICpcbiAqIFRoaXMgZnVuY3Rpb24gc3VwcG9ydHMgY2lyY3VsYXIgcmVmZXJlbmNlcyBieSBkZWZhdWx0LCBidXQgaWYgeW91IGFyZSBjZXJ0YWluXG4gKiB0aGVyZSBhcmUgbm8gY2lyY3VsYXIgcmVmZXJlbmNlcyBpbiB5b3VyIG9iamVjdCwgeW91IGNhbiBzYXZlIHNvbWUgQ1BVIHRpbWVcbiAqIGJ5IGNhbGxpbmcgY2xvbmUob2JqLCBmYWxzZSkuXG4gKlxuICogQ2F1dGlvbjogaWYgYGNpcmN1bGFyYCBpcyBmYWxzZSBhbmQgYHBhcmVudGAgY29udGFpbnMgY2lyY3VsYXIgcmVmZXJlbmNlcyxcbiAqIHlvdXIgcHJvZ3JhbSBtYXkgZW50ZXIgYW4gaW5maW5pdGUgbG9vcCBhbmQgY3Jhc2guXG4gKlxuICogQHBhcmFtIGBwYXJlbnRgIC0gdGhlIG9iamVjdCB0byBiZSBjbG9uZWRcbiAqIEBwYXJhbSBgY2lyY3VsYXJgIC0gc2V0IHRvIHRydWUgaWYgdGhlIG9iamVjdCB0byBiZSBjbG9uZWQgbWF5IGNvbnRhaW5cbiAqICAgIGNpcmN1bGFyIHJlZmVyZW5jZXMuIChvcHRpb25hbCAtIHRydWUgYnkgZGVmYXVsdClcbiAqIEBwYXJhbSBgZGVwdGhgIC0gc2V0IHRvIGEgbnVtYmVyIGlmIHRoZSBvYmplY3QgaXMgb25seSB0byBiZSBjbG9uZWQgdG9cbiAqICAgIGEgcGFydGljdWxhciBkZXB0aC4gKG9wdGlvbmFsIC0gZGVmYXVsdHMgdG8gSW5maW5pdHkpXG4gKiBAcGFyYW0gYHByb3RvdHlwZWAgLSBzZXRzIHRoZSBwcm90b3R5cGUgdG8gYmUgdXNlZCB3aGVuIGNsb25pbmcgYW4gb2JqZWN0LlxuICogICAgKG9wdGlvbmFsIC0gZGVmYXVsdHMgdG8gcGFyZW50IHByb3RvdHlwZSkuXG4qL1xuZnVuY3Rpb24gY2xvbmUocGFyZW50LCBjaXJjdWxhciwgZGVwdGgsIHByb3RvdHlwZSkge1xuICB2YXIgZmlsdGVyO1xuICBpZiAodHlwZW9mIGNpcmN1bGFyID09PSAnb2JqZWN0Jykge1xuICAgIGRlcHRoID0gY2lyY3VsYXIuZGVwdGg7XG4gICAgcHJvdG90eXBlID0gY2lyY3VsYXIucHJvdG90eXBlO1xuICAgIGZpbHRlciA9IGNpcmN1bGFyLmZpbHRlcjtcbiAgICBjaXJjdWxhciA9IGNpcmN1bGFyLmNpcmN1bGFyXG4gIH1cbiAgLy8gbWFpbnRhaW4gdHdvIGFycmF5cyBmb3IgY2lyY3VsYXIgcmVmZXJlbmNlcywgd2hlcmUgY29ycmVzcG9uZGluZyBwYXJlbnRzXG4gIC8vIGFuZCBjaGlsZHJlbiBoYXZlIHRoZSBzYW1lIGluZGV4XG4gIHZhciBhbGxQYXJlbnRzID0gW107XG4gIHZhciBhbGxDaGlsZHJlbiA9IFtdO1xuXG4gIHZhciB1c2VCdWZmZXIgPSB0eXBlb2YgQnVmZmVyICE9ICd1bmRlZmluZWQnO1xuXG4gIGlmICh0eXBlb2YgY2lyY3VsYXIgPT0gJ3VuZGVmaW5lZCcpXG4gICAgY2lyY3VsYXIgPSB0cnVlO1xuXG4gIGlmICh0eXBlb2YgZGVwdGggPT0gJ3VuZGVmaW5lZCcpXG4gICAgZGVwdGggPSBJbmZpbml0eTtcblxuICAvLyByZWN1cnNlIHRoaXMgZnVuY3Rpb24gc28gd2UgZG9uJ3QgcmVzZXQgYWxsUGFyZW50cyBhbmQgYWxsQ2hpbGRyZW5cbiAgZnVuY3Rpb24gX2Nsb25lKHBhcmVudCwgZGVwdGgpIHtcbiAgICAvLyBjbG9uaW5nIG51bGwgYWx3YXlzIHJldHVybnMgbnVsbFxuICAgIGlmIChwYXJlbnQgPT09IG51bGwpXG4gICAgICByZXR1cm4gbnVsbDtcblxuICAgIGlmIChkZXB0aCA9PSAwKVxuICAgICAgcmV0dXJuIHBhcmVudDtcblxuICAgIHZhciBjaGlsZDtcbiAgICB2YXIgcHJvdG87XG4gICAgaWYgKHR5cGVvZiBwYXJlbnQgIT0gJ29iamVjdCcpIHtcbiAgICAgIHJldHVybiBwYXJlbnQ7XG4gICAgfVxuXG4gICAgaWYgKGNsb25lLl9faXNBcnJheShwYXJlbnQpKSB7XG4gICAgICBjaGlsZCA9IFtdO1xuICAgIH0gZWxzZSBpZiAoY2xvbmUuX19pc1JlZ0V4cChwYXJlbnQpKSB7XG4gICAgICBjaGlsZCA9IG5ldyBSZWdFeHAocGFyZW50LnNvdXJjZSwgX19nZXRSZWdFeHBGbGFncyhwYXJlbnQpKTtcbiAgICAgIGlmIChwYXJlbnQubGFzdEluZGV4KSBjaGlsZC5sYXN0SW5kZXggPSBwYXJlbnQubGFzdEluZGV4O1xuICAgIH0gZWxzZSBpZiAoY2xvbmUuX19pc0RhdGUocGFyZW50KSkge1xuICAgICAgY2hpbGQgPSBuZXcgRGF0ZShwYXJlbnQuZ2V0VGltZSgpKTtcbiAgICB9IGVsc2UgaWYgKHVzZUJ1ZmZlciAmJiBCdWZmZXIuaXNCdWZmZXIocGFyZW50KSkge1xuICAgICAgY2hpbGQgPSBuZXcgQnVmZmVyKHBhcmVudC5sZW5ndGgpO1xuICAgICAgcGFyZW50LmNvcHkoY2hpbGQpO1xuICAgICAgcmV0dXJuIGNoaWxkO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodHlwZW9mIHByb3RvdHlwZSA9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBwcm90byA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihwYXJlbnQpO1xuICAgICAgICBjaGlsZCA9IE9iamVjdC5jcmVhdGUocHJvdG8pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGNoaWxkID0gT2JqZWN0LmNyZWF0ZShwcm90b3R5cGUpO1xuICAgICAgICBwcm90byA9IHByb3RvdHlwZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY2lyY3VsYXIpIHtcbiAgICAgIHZhciBpbmRleCA9IGFsbFBhcmVudHMuaW5kZXhPZihwYXJlbnQpO1xuXG4gICAgICBpZiAoaW5kZXggIT0gLTEpIHtcbiAgICAgICAgcmV0dXJuIGFsbENoaWxkcmVuW2luZGV4XTtcbiAgICAgIH1cbiAgICAgIGFsbFBhcmVudHMucHVzaChwYXJlbnQpO1xuICAgICAgYWxsQ2hpbGRyZW4ucHVzaChjaGlsZCk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSBpbiBwYXJlbnQpIHtcbiAgICAgIHZhciBhdHRycztcbiAgICAgIGlmIChwcm90bykge1xuICAgICAgICBhdHRycyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IocHJvdG8sIGkpO1xuICAgICAgfVxuXG4gICAgICBpZiAoYXR0cnMgJiYgYXR0cnMuc2V0ID09IG51bGwpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBjaGlsZFtpXSA9IF9jbG9uZShwYXJlbnRbaV0sIGRlcHRoIC0gMSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNoaWxkO1xuICB9XG5cbiAgcmV0dXJuIF9jbG9uZShwYXJlbnQsIGRlcHRoKTtcbn1cblxuLyoqXG4gKiBTaW1wbGUgZmxhdCBjbG9uZSB1c2luZyBwcm90b3R5cGUsIGFjY2VwdHMgb25seSBvYmplY3RzLCB1c2VmdWxsIGZvciBwcm9wZXJ0eVxuICogb3ZlcnJpZGUgb24gRkxBVCBjb25maWd1cmF0aW9uIG9iamVjdCAobm8gbmVzdGVkIHByb3BzKS5cbiAqXG4gKiBVU0UgV0lUSCBDQVVUSU9OISBUaGlzIG1heSBub3QgYmVoYXZlIGFzIHlvdSB3aXNoIGlmIHlvdSBkbyBub3Qga25vdyBob3cgdGhpc1xuICogd29ya3MuXG4gKi9cbmNsb25lLmNsb25lUHJvdG90eXBlID0gZnVuY3Rpb24gY2xvbmVQcm90b3R5cGUocGFyZW50KSB7XG4gIGlmIChwYXJlbnQgPT09IG51bGwpXG4gICAgcmV0dXJuIG51bGw7XG5cbiAgdmFyIGMgPSBmdW5jdGlvbiAoKSB7fTtcbiAgYy5wcm90b3R5cGUgPSBwYXJlbnQ7XG4gIHJldHVybiBuZXcgYygpO1xufTtcblxuLy8gcHJpdmF0ZSB1dGlsaXR5IGZ1bmN0aW9uc1xuXG5mdW5jdGlvbiBfX29ialRvU3RyKG8pIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKTtcbn07XG5jbG9uZS5fX29ialRvU3RyID0gX19vYmpUb1N0cjtcblxuZnVuY3Rpb24gX19pc0RhdGUobykge1xuICByZXR1cm4gdHlwZW9mIG8gPT09ICdvYmplY3QnICYmIF9fb2JqVG9TdHIobykgPT09ICdbb2JqZWN0IERhdGVdJztcbn07XG5jbG9uZS5fX2lzRGF0ZSA9IF9faXNEYXRlO1xuXG5mdW5jdGlvbiBfX2lzQXJyYXkobykge1xuICByZXR1cm4gdHlwZW9mIG8gPT09ICdvYmplY3QnICYmIF9fb2JqVG9TdHIobykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuY2xvbmUuX19pc0FycmF5ID0gX19pc0FycmF5O1xuXG5mdW5jdGlvbiBfX2lzUmVnRXhwKG8pIHtcbiAgcmV0dXJuIHR5cGVvZiBvID09PSAnb2JqZWN0JyAmJiBfX29ialRvU3RyKG8pID09PSAnW29iamVjdCBSZWdFeHBdJztcbn07XG5jbG9uZS5fX2lzUmVnRXhwID0gX19pc1JlZ0V4cDtcblxuZnVuY3Rpb24gX19nZXRSZWdFeHBGbGFncyhyZSkge1xuICB2YXIgZmxhZ3MgPSAnJztcbiAgaWYgKHJlLmdsb2JhbCkgZmxhZ3MgKz0gJ2cnO1xuICBpZiAocmUuaWdub3JlQ2FzZSkgZmxhZ3MgKz0gJ2knO1xuICBpZiAocmUubXVsdGlsaW5lKSBmbGFncyArPSAnbSc7XG4gIHJldHVybiBmbGFncztcbn07XG5jbG9uZS5fX2dldFJlZ0V4cEZsYWdzID0gX19nZXRSZWdFeHBGbGFncztcblxucmV0dXJuIGNsb25lO1xufSkoKTtcblxuaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gY2xvbmU7XG59XG4iLCIvL0NvcHlyaWdodCAoQykgMjAxMiBLb3J5IE51bm5cclxuXHJcbi8vUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGEgY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZSBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmcgd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLCBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0IHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgY29uZGl0aW9uczpcclxuXHJcbi8vVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWQgaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXHJcblxyXG4vL1RIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1MgT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLCBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1IgT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRSBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxyXG5cclxuLypcclxuXHJcbiAgICBUaGlzIGNvZGUgaXMgbm90IGZvcm1hdHRlZCBmb3IgcmVhZGFiaWxpdHksIGJ1dCByYXRoZXIgcnVuLXNwZWVkIGFuZCB0byBhc3Npc3QgY29tcGlsZXJzLlxyXG5cclxuICAgIEhvd2V2ZXIsIHRoZSBjb2RlJ3MgaW50ZW50aW9uIHNob3VsZCBiZSB0cmFuc3BhcmVudC5cclxuXHJcbiAgICAqKiogSUUgU1VQUE9SVCAqKipcclxuXHJcbiAgICBJZiB5b3UgcmVxdWlyZSB0aGlzIGxpYnJhcnkgdG8gd29yayBpbiBJRTcsIGFkZCB0aGUgZm9sbG93aW5nIGFmdGVyIGRlY2xhcmluZyBjcmVsLlxyXG5cclxuICAgIHZhciB0ZXN0RGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JyksXHJcbiAgICAgICAgdGVzdExhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGFiZWwnKTtcclxuXHJcbiAgICB0ZXN0RGl2LnNldEF0dHJpYnV0ZSgnY2xhc3MnLCAnYScpO1xyXG4gICAgdGVzdERpdlsnY2xhc3NOYW1lJ10gIT09ICdhJyA/IGNyZWwuYXR0ck1hcFsnY2xhc3MnXSA9ICdjbGFzc05hbWUnOnVuZGVmaW5lZDtcclxuICAgIHRlc3REaXYuc2V0QXR0cmlidXRlKCduYW1lJywnYScpO1xyXG4gICAgdGVzdERpdlsnbmFtZSddICE9PSAnYScgPyBjcmVsLmF0dHJNYXBbJ25hbWUnXSA9IGZ1bmN0aW9uKGVsZW1lbnQsIHZhbHVlKXtcclxuICAgICAgICBlbGVtZW50LmlkID0gdmFsdWU7XHJcbiAgICB9OnVuZGVmaW5lZDtcclxuXHJcblxyXG4gICAgdGVzdExhYmVsLnNldEF0dHJpYnV0ZSgnZm9yJywgJ2EnKTtcclxuICAgIHRlc3RMYWJlbFsnaHRtbEZvciddICE9PSAnYScgPyBjcmVsLmF0dHJNYXBbJ2ZvciddID0gJ2h0bWxGb3InOnVuZGVmaW5lZDtcclxuXHJcblxyXG5cclxuKi9cclxuXHJcbihmdW5jdGlvbiAocm9vdCwgZmFjdG9yeSkge1xyXG4gICAgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpO1xyXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcclxuICAgICAgICBkZWZpbmUoZmFjdG9yeSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJvb3QuY3JlbCA9IGZhY3RvcnkoKTtcclxuICAgIH1cclxufSh0aGlzLCBmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgZm4gPSAnZnVuY3Rpb24nLFxyXG4gICAgICAgIG9iaiA9ICdvYmplY3QnLFxyXG4gICAgICAgIG5vZGVUeXBlID0gJ25vZGVUeXBlJyxcclxuICAgICAgICB0ZXh0Q29udGVudCA9ICd0ZXh0Q29udGVudCcsXHJcbiAgICAgICAgc2V0QXR0cmlidXRlID0gJ3NldEF0dHJpYnV0ZScsXHJcbiAgICAgICAgYXR0ck1hcFN0cmluZyA9ICdhdHRyTWFwJyxcclxuICAgICAgICBpc05vZGVTdHJpbmcgPSAnaXNOb2RlJyxcclxuICAgICAgICBpc0VsZW1lbnRTdHJpbmcgPSAnaXNFbGVtZW50JyxcclxuICAgICAgICBkID0gdHlwZW9mIGRvY3VtZW50ID09PSBvYmogPyBkb2N1bWVudCA6IHt9LFxyXG4gICAgICAgIGlzVHlwZSA9IGZ1bmN0aW9uKGEsIHR5cGUpe1xyXG4gICAgICAgICAgICByZXR1cm4gdHlwZW9mIGEgPT09IHR5cGU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc05vZGUgPSB0eXBlb2YgTm9kZSA9PT0gZm4gPyBmdW5jdGlvbiAob2JqZWN0KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBvYmplY3QgaW5zdGFuY2VvZiBOb2RlO1xyXG4gICAgICAgIH0gOlxyXG4gICAgICAgIC8vIGluIElFIDw9IDggTm9kZSBpcyBhbiBvYmplY3QsIG9idmlvdXNseS4uXHJcbiAgICAgICAgZnVuY3Rpb24ob2JqZWN0KXtcclxuICAgICAgICAgICAgcmV0dXJuIG9iamVjdCAmJlxyXG4gICAgICAgICAgICAgICAgaXNUeXBlKG9iamVjdCwgb2JqKSAmJlxyXG4gICAgICAgICAgICAgICAgKG5vZGVUeXBlIGluIG9iamVjdCkgJiZcclxuICAgICAgICAgICAgICAgIGlzVHlwZShvYmplY3Qub3duZXJEb2N1bWVudCxvYmopO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNFbGVtZW50ID0gZnVuY3Rpb24gKG9iamVjdCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY3JlbFtpc05vZGVTdHJpbmddKG9iamVjdCkgJiYgb2JqZWN0W25vZGVUeXBlXSA9PT0gMTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzQXJyYXkgPSBmdW5jdGlvbihhKXtcclxuICAgICAgICAgICAgcmV0dXJuIGEgaW5zdGFuY2VvZiBBcnJheTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFwcGVuZENoaWxkID0gZnVuY3Rpb24oZWxlbWVudCwgY2hpbGQpIHtcclxuICAgICAgICAgIGlmKCFjcmVsW2lzTm9kZVN0cmluZ10oY2hpbGQpKXtcclxuICAgICAgICAgICAgICBjaGlsZCA9IGQuY3JlYXRlVGV4dE5vZGUoY2hpbGQpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgZWxlbWVudC5hcHBlbmRDaGlsZChjaGlsZCk7XHJcbiAgICAgICAgfTtcclxuXHJcblxyXG4gICAgZnVuY3Rpb24gY3JlbCgpe1xyXG4gICAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzLCAvL05vdGU6IGFzc2lnbmVkIHRvIGEgdmFyaWFibGUgdG8gYXNzaXN0IGNvbXBpbGVycy4gU2F2ZXMgYWJvdXQgNDAgYnl0ZXMgaW4gY2xvc3VyZSBjb21waWxlci4gSGFzIG5lZ2xpZ2FibGUgZWZmZWN0IG9uIHBlcmZvcm1hbmNlLlxyXG4gICAgICAgICAgICBlbGVtZW50ID0gYXJnc1swXSxcclxuICAgICAgICAgICAgY2hpbGQsXHJcbiAgICAgICAgICAgIHNldHRpbmdzID0gYXJnc1sxXSxcclxuICAgICAgICAgICAgY2hpbGRJbmRleCA9IDIsXHJcbiAgICAgICAgICAgIGFyZ3VtZW50c0xlbmd0aCA9IGFyZ3MubGVuZ3RoLFxyXG4gICAgICAgICAgICBhdHRyaWJ1dGVNYXAgPSBjcmVsW2F0dHJNYXBTdHJpbmddO1xyXG5cclxuICAgICAgICBlbGVtZW50ID0gY3JlbFtpc0VsZW1lbnRTdHJpbmddKGVsZW1lbnQpID8gZWxlbWVudCA6IGQuY3JlYXRlRWxlbWVudChlbGVtZW50KTtcclxuICAgICAgICAvLyBzaG9ydGN1dFxyXG4gICAgICAgIGlmKGFyZ3VtZW50c0xlbmd0aCA9PT0gMSl7XHJcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYoIWlzVHlwZShzZXR0aW5ncyxvYmopIHx8IGNyZWxbaXNOb2RlU3RyaW5nXShzZXR0aW5ncykgfHwgaXNBcnJheShzZXR0aW5ncykpIHtcclxuICAgICAgICAgICAgLS1jaGlsZEluZGV4O1xyXG4gICAgICAgICAgICBzZXR0aW5ncyA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBzaG9ydGN1dCBpZiB0aGVyZSBpcyBvbmx5IG9uZSBjaGlsZCB0aGF0IGlzIGEgc3RyaW5nXHJcbiAgICAgICAgaWYoKGFyZ3VtZW50c0xlbmd0aCAtIGNoaWxkSW5kZXgpID09PSAxICYmIGlzVHlwZShhcmdzW2NoaWxkSW5kZXhdLCAnc3RyaW5nJykgJiYgZWxlbWVudFt0ZXh0Q29udGVudF0gIT09IHVuZGVmaW5lZCl7XHJcbiAgICAgICAgICAgIGVsZW1lbnRbdGV4dENvbnRlbnRdID0gYXJnc1tjaGlsZEluZGV4XTtcclxuICAgICAgICB9ZWxzZXtcclxuICAgICAgICAgICAgZm9yKDsgY2hpbGRJbmRleCA8IGFyZ3VtZW50c0xlbmd0aDsgKytjaGlsZEluZGV4KXtcclxuICAgICAgICAgICAgICAgIGNoaWxkID0gYXJnc1tjaGlsZEluZGV4XTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZihjaGlsZCA9PSBudWxsKXtcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoaXNBcnJheShjaGlsZCkpIHtcclxuICAgICAgICAgICAgICAgICAgZm9yICh2YXIgaT0wOyBpIDwgY2hpbGQubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICBhcHBlbmRDaGlsZChlbGVtZW50LCBjaGlsZFtpXSk7XHJcbiAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgIGFwcGVuZENoaWxkKGVsZW1lbnQsIGNoaWxkKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gc2V0dGluZ3Mpe1xyXG4gICAgICAgICAgICBpZighYXR0cmlidXRlTWFwW2tleV0pe1xyXG4gICAgICAgICAgICAgICAgZWxlbWVudFtzZXRBdHRyaWJ1dGVdKGtleSwgc2V0dGluZ3Nba2V5XSk7XHJcbiAgICAgICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICAgICAgdmFyIGF0dHIgPSBhdHRyaWJ1dGVNYXBba2V5XTtcclxuICAgICAgICAgICAgICAgIGlmKHR5cGVvZiBhdHRyID09PSBmbil7XHJcbiAgICAgICAgICAgICAgICAgICAgYXR0cihlbGVtZW50LCBzZXR0aW5nc1trZXldKTtcclxuICAgICAgICAgICAgICAgIH1lbHNle1xyXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnRbc2V0QXR0cmlidXRlXShhdHRyLCBzZXR0aW5nc1trZXldKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGVsZW1lbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gVXNlZCBmb3IgbWFwcGluZyBvbmUga2luZCBvZiBhdHRyaWJ1dGUgdG8gdGhlIHN1cHBvcnRlZCB2ZXJzaW9uIG9mIHRoYXQgaW4gYmFkIGJyb3dzZXJzLlxyXG4gICAgY3JlbFthdHRyTWFwU3RyaW5nXSA9IHt9O1xyXG5cclxuICAgIGNyZWxbaXNFbGVtZW50U3RyaW5nXSA9IGlzRWxlbWVudDtcclxuXHJcbiAgICBjcmVsW2lzTm9kZVN0cmluZ10gPSBpc05vZGU7XHJcblxyXG4gICAgaWYodHlwZW9mIFByb3h5ICE9PSAndW5kZWZpbmVkJyl7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm94eShjcmVsLCB7XHJcbiAgICAgICAgICAgIGdldDogZnVuY3Rpb24odGFyZ2V0LCBrZXkpe1xyXG4gICAgICAgICAgICAgICAgIShrZXkgaW4gY3JlbCkgJiYgKGNyZWxba2V5XSA9IGNyZWwuYmluZChudWxsLCBrZXkpKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjcmVsW2tleV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gY3JlbDtcclxufSkpO1xyXG4iLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyO1xuXG5mdW5jdGlvbiB0b0FycmF5KGl0ZW1zKXtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoaXRlbXMpO1xufVxuXG52YXIgZGVlcFJlZ2V4ID0gL1t8Ll0vaTtcblxuZnVuY3Rpb24gbWF0Y2hEZWVwKHBhdGgpe1xuICAgIHJldHVybiAocGF0aCArICcnKS5tYXRjaChkZWVwUmVnZXgpO1xufVxuXG5mdW5jdGlvbiBpc1dpbGRjYXJkUGF0aChwYXRoKXtcbiAgICB2YXIgc3RyaW5nUGF0aCA9IChwYXRoICsgJycpO1xuICAgIHJldHVybiB+c3RyaW5nUGF0aC5pbmRleE9mKCcqJyk7XG59XG5cbmZ1bmN0aW9uIGdldFRhcmdldEtleShwYXRoKXtcbiAgICB2YXIgc3RyaW5nUGF0aCA9IChwYXRoICsgJycpO1xuICAgIHJldHVybiBzdHJpbmdQYXRoLnNwbGl0KCd8Jykuc2hpZnQoKTtcbn1cblxudmFyIGV2ZW50U3lzdGVtVmVyc2lvbiA9IDEsXG4gICAgZ2xvYmFsS2V5ID0gJ19lbnRpRXZlbnRTdGF0ZScgKyBldmVudFN5c3RlbVZlcnNpb25cbiAgICBnbG9iYWxTdGF0ZSA9IGdsb2JhbFtnbG9iYWxLZXldID0gZ2xvYmFsW2dsb2JhbEtleV0gfHwge1xuICAgICAgICBpbnN0YW5jZXM6IFtdXG4gICAgfTtcblxudmFyIG1vZGlmaWVkRW50aWVzID0gZ2xvYmFsU3RhdGUubW9kaWZpZWRFbnRpZXMgPSBnbG9iYWxTdGF0ZS5tb2RpZmllZEVudGllcyB8fCBuZXcgU2V0KCksXG4gICAgdHJhY2tlZE9iamVjdHMgPSBnbG9iYWxTdGF0ZS50cmFja2VkT2JqZWN0cyA9IGdsb2JhbFN0YXRlLnRyYWNrZWRPYmplY3RzIHx8IG5ldyBXZWFrTWFwKCk7XG5cbmZ1bmN0aW9uIGxlZnRBbmRSZXN0KHBhdGgpe1xuICAgIHZhciBzdHJpbmdQYXRoID0gKHBhdGggKyAnJyk7XG5cbiAgICAvLyBTcGVjaWFsIGNhc2Ugd2hlbiB5b3Ugd2FudCB0byBmaWx0ZXIgb24gc2VsZiAoLilcbiAgICBpZihzdHJpbmdQYXRoLnNsaWNlKDAsMikgPT09ICcufCcpe1xuICAgICAgICByZXR1cm4gWycuJywgc3RyaW5nUGF0aC5zbGljZSgyKV07XG4gICAgfVxuXG4gICAgdmFyIG1hdGNoID0gbWF0Y2hEZWVwKHN0cmluZ1BhdGgpO1xuICAgIGlmKG1hdGNoKXtcbiAgICAgICAgcmV0dXJuIFtzdHJpbmdQYXRoLnNsaWNlKDAsIG1hdGNoLmluZGV4KSwgc3RyaW5nUGF0aC5zbGljZShtYXRjaC5pbmRleCsxKV07XG4gICAgfVxuICAgIHJldHVybiBzdHJpbmdQYXRoO1xufVxuXG5mdW5jdGlvbiBpc1dpbGRjYXJkS2V5KGtleSl7XG4gICAgcmV0dXJuIGtleS5jaGFyQXQoMCkgPT09ICcqJztcbn1cblxuZnVuY3Rpb24gaXNGZXJhbGNhcmRLZXkoa2V5KXtcbiAgICByZXR1cm4ga2V5ID09PSAnKionO1xufVxuXG5mdW5jdGlvbiBhZGRIYW5kbGVyKG9iamVjdCwga2V5LCBoYW5kbGVyKXtcbiAgICB2YXIgdHJhY2tlZEtleXMgPSB0cmFja2VkT2JqZWN0cy5nZXQob2JqZWN0KTtcblxuICAgIGlmKHRyYWNrZWRLZXlzID09IG51bGwpe1xuICAgICAgICB0cmFja2VkS2V5cyA9IHt9O1xuICAgICAgICB0cmFja2VkT2JqZWN0cy5zZXQob2JqZWN0LCB0cmFja2VkS2V5cyk7XG4gICAgfVxuXG4gICAgdmFyIGhhbmRsZXJzID0gdHJhY2tlZEtleXNba2V5XTtcblxuICAgIGlmKCFoYW5kbGVycyl7XG4gICAgICAgIGhhbmRsZXJzID0gbmV3IFNldCgpO1xuICAgICAgICB0cmFja2VkS2V5c1trZXldID0gaGFuZGxlcnM7XG4gICAgfVxuXG4gICAgaGFuZGxlcnMuYWRkKGhhbmRsZXIpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVIYW5kbGVyKG9iamVjdCwga2V5LCBoYW5kbGVyKXtcbiAgICB2YXIgdHJhY2tlZEtleXMgPSB0cmFja2VkT2JqZWN0cy5nZXQob2JqZWN0KTtcblxuICAgIGlmKHRyYWNrZWRLZXlzID09IG51bGwpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGhhbmRsZXJzID0gdHJhY2tlZEtleXNba2V5XTtcblxuICAgIGlmKCFoYW5kbGVycyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBoYW5kbGVycy5kZWxldGUoaGFuZGxlcik7XG59XG5cbmZ1bmN0aW9uIHRyYWNrT2JqZWN0cyhldmVudE5hbWUsIHRyYWNrZWQsIGhhbmRsZXIsIG9iamVjdCwga2V5LCBwYXRoKXtcbiAgICBpZighb2JqZWN0IHx8IHR5cGVvZiBvYmplY3QgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBldmVudEtleSA9IGtleSA9PT0gJyoqJyA/ICcqJyA6IGtleSxcbiAgICAgICAgdGFyZ2V0ID0gb2JqZWN0W2tleV0sXG4gICAgICAgIHRhcmdldElzT2JqZWN0ID0gdGFyZ2V0ICYmIHR5cGVvZiB0YXJnZXQgPT09ICdvYmplY3QnO1xuXG4gICAgaWYodGFyZ2V0SXNPYmplY3QgJiYgdHJhY2tlZC5oYXModGFyZ2V0KSl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgaGFuZGxlID0gZnVuY3Rpb24odmFsdWUsIGV2ZW50LCBlbWl0S2V5KXtcbiAgICAgICAgaWYoZXZlbnRLZXkgIT09ICcqJyAmJiB0eXBlb2Ygb2JqZWN0W2V2ZW50S2V5XSA9PT0gJ29iamVjdCcgJiYgb2JqZWN0W2V2ZW50S2V5XSAhPT0gdGFyZ2V0KXtcbiAgICAgICAgICAgIGlmKHRhcmdldElzT2JqZWN0KXtcbiAgICAgICAgICAgICAgICB0cmFja2VkLmRlbGV0ZSh0YXJnZXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVtb3ZlSGFuZGxlcihvYmplY3QsIGV2ZW50S2V5LCBoYW5kbGUpO1xuICAgICAgICAgICAgdHJhY2tPYmplY3RzKGV2ZW50TmFtZSwgdHJhY2tlZCwgaGFuZGxlciwgb2JqZWN0LCBrZXksIHBhdGgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoZXZlbnRLZXkgPT09ICcqJyl7XG4gICAgICAgICAgICB0cmFja0tleXMob2JqZWN0LCBrZXksIHBhdGgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoIXRyYWNrZWQuaGFzKG9iamVjdCkpe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoa2V5ICE9PSAnKionIHx8ICFwYXRoKXtcbiAgICAgICAgICAgIGhhbmRsZXIodmFsdWUsIGV2ZW50LCBlbWl0S2V5KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRyYWNrS2V5cyh0YXJnZXQsIHJvb3QsIHJlc3Qpe1xuICAgICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHRhcmdldCk7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIGlmKGlzRmVyYWxjYXJkS2V5KHJvb3QpKXtcbiAgICAgICAgICAgICAgICB0cmFja09iamVjdHMoZXZlbnROYW1lLCB0cmFja2VkLCBoYW5kbGVyLCB0YXJnZXQsIGtleXNbaV0sICcqKicgKyAocmVzdCA/ICcuJyA6ICcnKSArIChyZXN0IHx8ICcnKSk7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICB0cmFja09iamVjdHMoZXZlbnROYW1lLCB0cmFja2VkLCBoYW5kbGVyLCB0YXJnZXQsIGtleXNbaV0sIHJlc3QpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkSGFuZGxlcihvYmplY3QsIGV2ZW50S2V5LCBoYW5kbGUpO1xuXG4gICAgaWYoIXRhcmdldElzT2JqZWN0KXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFRoaXMgd291bGQgb2J2aW91c2x5IGJlIGJldHRlciBpbXBsZW1lbnRlZCB3aXRoIGEgV2Vha1NldCxcbiAgICAvLyBCdXQgSSdtIHRyeWluZyB0byBrZWVwIGZpbGVzaXplIGRvd24sIGFuZCBJIGRvbid0IHJlYWxseSB3YW50IGFub3RoZXJcbiAgICAvLyBwb2x5ZmlsbCB3aGVuIFdlYWtNYXAgd29ya3Mgd2VsbCBlbm91Z2ggZm9yIHRoZSB0YXNrLlxuICAgIHRyYWNrZWQuYWRkKHRhcmdldCk7XG5cbiAgICBpZighcGF0aCl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgcm9vdEFuZFJlc3QgPSBsZWZ0QW5kUmVzdChwYXRoKSxcbiAgICAgICAgcm9vdCxcbiAgICAgICAgcmVzdDtcblxuICAgIGlmKCFBcnJheS5pc0FycmF5KHJvb3RBbmRSZXN0KSl7XG4gICAgICAgIHJvb3QgPSByb290QW5kUmVzdDtcbiAgICB9ZWxzZXtcbiAgICAgICAgcm9vdCA9IHJvb3RBbmRSZXN0WzBdO1xuICAgICAgICByZXN0ID0gcm9vdEFuZFJlc3RbMV07XG5cbiAgICAgICAgLy8gSWYgdGhlIHJvb3QgaXMgJy4nLCB3YXRjaCBmb3IgZXZlbnRzIG9uICpcbiAgICAgICAgaWYocm9vdCA9PT0gJy4nKXtcbiAgICAgICAgICAgIHJvb3QgPSAnKic7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZih0YXJnZXRJc09iamVjdCAmJiBpc1dpbGRjYXJkS2V5KHJvb3QpKXtcbiAgICAgICAgdHJhY2tLZXlzKHRhcmdldCwgcm9vdCwgcmVzdCk7XG4gICAgfVxuXG4gICAgdHJhY2tPYmplY3RzKGV2ZW50TmFtZSwgdHJhY2tlZCwgaGFuZGxlciwgdGFyZ2V0LCByb290LCByZXN0KTtcbn1cblxudmFyIHRyYWNrZWRFdmVudHMgPSBuZXcgV2Vha01hcCgpO1xuZnVuY3Rpb24gY3JlYXRlSGFuZGxlcihlbnRpLCB0cmFja2VkT2JqZWN0UGF0aHMsIHRyYWNrZWRQYXRocywgZXZlbnROYW1lKXtcbiAgICB2YXIgb2xkTW9kZWwgPSBlbnRpLl9tb2RlbDtcbiAgICByZXR1cm4gZnVuY3Rpb24oZXZlbnQsIGVtaXRLZXkpe1xuICAgICAgICB0cmFja2VkUGF0aHMuZW50aXMuZm9yRWFjaChmdW5jdGlvbihlbnRpKXtcbiAgICAgICAgICAgIGlmKGVudGkuX2VtaXR0ZWRFdmVudHNbZXZlbnROYW1lXSA9PT0gZW1pdEtleSl7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihlbnRpLl9tb2RlbCAhPT0gb2xkTW9kZWwpe1xuICAgICAgICAgICAgICAgIHRyYWNrZWRQYXRocy5lbnRpcy5kZWxldGUoZW50aSk7XG4gICAgICAgICAgICAgICAgaWYodHJhY2tlZFBhdGhzLmVudGlzLnNpemUgPT09IDApe1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgdHJhY2tlZE9iamVjdFBhdGhzW2V2ZW50TmFtZV07XG4gICAgICAgICAgICAgICAgICAgIGlmKCFPYmplY3Qua2V5cyh0cmFja2VkT2JqZWN0UGF0aHMpLmxlbmd0aCl7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmFja2VkRXZlbnRzLmRlbGV0ZShvbGRNb2RlbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBlbnRpLl9lbWl0dGVkRXZlbnRzW2V2ZW50TmFtZV0gPSBlbWl0S2V5O1xuXG4gICAgICAgICAgICB2YXIgdGFyZ2V0S2V5ID0gZ2V0VGFyZ2V0S2V5KGV2ZW50TmFtZSksXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBpc1dpbGRjYXJkUGF0aCh0YXJnZXRLZXkpID8gdW5kZWZpbmVkIDogZW50aS5nZXQodGFyZ2V0S2V5KTtcblxuICAgICAgICAgICAgZW50aS5lbWl0KGV2ZW50TmFtZSwgdmFsdWUsIGV2ZW50KTtcbiAgICAgICAgfSk7XG4gICAgfTtcbn1cblxuZnVuY3Rpb24gdHJhY2tQYXRoKGVudGksIGV2ZW50TmFtZSl7XG4gICAgdmFyIG9iamVjdCA9IGVudGkuX21vZGVsLFxuICAgICAgICB0cmFja2VkT2JqZWN0UGF0aHMgPSB0cmFja2VkRXZlbnRzLmdldChvYmplY3QpO1xuXG4gICAgaWYoIXRyYWNrZWRPYmplY3RQYXRocyl7XG4gICAgICAgIHRyYWNrZWRPYmplY3RQYXRocyA9IHt9O1xuICAgICAgICB0cmFja2VkRXZlbnRzLnNldChvYmplY3QsIHRyYWNrZWRPYmplY3RQYXRocyk7XG4gICAgfVxuXG4gICAgdmFyIHRyYWNrZWRQYXRocyA9IHRyYWNrZWRPYmplY3RQYXRoc1tldmVudE5hbWVdO1xuXG4gICAgaWYoIXRyYWNrZWRQYXRocyl7XG4gICAgICAgIHRyYWNrZWRQYXRocyA9IHtcbiAgICAgICAgICAgIGVudGlzOiBuZXcgU2V0KCksXG4gICAgICAgICAgICB0cmFja2VkT2JqZWN0czogbmV3IFdlYWtTZXQoKVxuICAgICAgICB9O1xuICAgICAgICB0cmFja2VkT2JqZWN0UGF0aHNbZXZlbnROYW1lXSA9IHRyYWNrZWRQYXRocztcbiAgICB9ZWxzZSBpZih0cmFja2VkUGF0aHMuZW50aXMuaGFzKGVudGkpKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRyYWNrZWRQYXRocy5lbnRpcy5hZGQoZW50aSk7XG5cbiAgICB2YXIgaGFuZGxlciA9IGNyZWF0ZUhhbmRsZXIoZW50aSwgdHJhY2tlZE9iamVjdFBhdGhzLCB0cmFja2VkUGF0aHMsIGV2ZW50TmFtZSk7XG5cbiAgICB0cmFja09iamVjdHMoZXZlbnROYW1lLCB0cmFja2VkUGF0aHMudHJhY2tlZE9iamVjdHMsIGhhbmRsZXIsIHttb2RlbDpvYmplY3R9LCAnbW9kZWwnLCBldmVudE5hbWUpO1xufVxuXG5mdW5jdGlvbiB0cmFja1BhdGhzKGVudGkpe1xuICAgIGlmKCFlbnRpLl9ldmVudHMgfHwgIWVudGkuX21vZGVsKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGZvcih2YXIga2V5IGluIGVudGkuX2V2ZW50cyl7XG4gICAgICAgIHRyYWNrUGF0aChlbnRpLCBrZXkpO1xuICAgIH1cbiAgICBtb2RpZmllZEVudGllcy5kZWxldGUoZW50aSk7XG59XG5cbmZ1bmN0aW9uIGVtaXRFdmVudChvYmplY3QsIGtleSwgdmFsdWUsIGVtaXRLZXkpe1xuXG4gICAgbW9kaWZpZWRFbnRpZXMuZm9yRWFjaCh0cmFja1BhdGhzKTtcblxuICAgIHZhciB0cmFja2VkS2V5cyA9IHRyYWNrZWRPYmplY3RzLmdldChvYmplY3QpO1xuXG4gICAgaWYoIXRyYWNrZWRLZXlzKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBldmVudCA9IHtcbiAgICAgICAgdmFsdWU6IHZhbHVlLFxuICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgb2JqZWN0OiBvYmplY3RcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gZW1pdEZvcktleShoYW5kbGVyKXtcbiAgICAgICAgaGFuZGxlcihldmVudCwgZW1pdEtleSk7XG4gICAgfVxuXG4gICAgaWYodHJhY2tlZEtleXNba2V5XSl7XG4gICAgICAgIHRyYWNrZWRLZXlzW2tleV0uZm9yRWFjaChlbWl0Rm9yS2V5KTtcbiAgICB9XG5cbiAgICBpZih0cmFja2VkS2V5c1snKiddKXtcbiAgICAgICAgdHJhY2tlZEtleXNbJyonXS5mb3JFYWNoKGVtaXRGb3JLZXkpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZW1pdChldmVudHMpe1xuICAgIHZhciBlbWl0S2V5ID0ge307XG4gICAgZXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgICBlbWl0RXZlbnQoZXZlbnRbMF0sIGV2ZW50WzFdLCBldmVudFsyXSwgZW1pdEtleSk7XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIEVudGkobW9kZWwpe1xuICAgIHZhciBkZXRhY2hlZCA9IG1vZGVsID09PSBmYWxzZTtcblxuICAgIGlmKCFtb2RlbCB8fCAodHlwZW9mIG1vZGVsICE9PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kZWwgIT09ICdmdW5jdGlvbicpKXtcbiAgICAgICAgbW9kZWwgPSB7fTtcbiAgICB9XG5cbiAgICB0aGlzLl9lbWl0dGVkRXZlbnRzID0ge307XG4gICAgaWYoZGV0YWNoZWQpe1xuICAgICAgICB0aGlzLl9tb2RlbCA9IHt9O1xuICAgIH1lbHNle1xuICAgICAgICB0aGlzLmF0dGFjaChtb2RlbCk7XG4gICAgfVxuXG4gICAgdGhpcy5vbignbmV3TGlzdGVuZXInLCBmdW5jdGlvbigpe1xuICAgICAgICBtb2RpZmllZEVudGllcy5hZGQodGhpcyk7XG4gICAgfSk7XG59XG5FbnRpLmVtaXQgPSBmdW5jdGlvbihtb2RlbCwga2V5LCB2YWx1ZSl7XG4gICAgaWYoISh0eXBlb2YgbW9kZWwgPT09ICdvYmplY3QnIHx8IHR5cGVvZiBtb2RlbCA9PT0gJ2Z1bmN0aW9uJykpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgZW1pdChbW21vZGVsLCBrZXksIHZhbHVlXV0pO1xufTtcbkVudGkuZ2V0ID0gZnVuY3Rpb24obW9kZWwsIGtleSl7XG4gICAgaWYoIW1vZGVsIHx8IHR5cGVvZiBtb2RlbCAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAga2V5ID0gZ2V0VGFyZ2V0S2V5KGtleSk7XG5cbiAgICBpZihrZXkgPT09ICcuJyl7XG4gICAgICAgIHJldHVybiBtb2RlbDtcbiAgICB9XG5cblxuICAgIHZhciBwYXRoID0gbGVmdEFuZFJlc3Qoa2V5KTtcbiAgICBpZihBcnJheS5pc0FycmF5KHBhdGgpKXtcbiAgICAgICAgcmV0dXJuIEVudGkuZ2V0KG1vZGVsW3BhdGhbMF1dLCBwYXRoWzFdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbW9kZWxba2V5XTtcbn07XG5FbnRpLnNldCA9IGZ1bmN0aW9uKG1vZGVsLCBrZXksIHZhbHVlKXtcbiAgICBpZighbW9kZWwgfHwgdHlwZW9mIG1vZGVsICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBrZXkgPSBnZXRUYXJnZXRLZXkoa2V5KTtcblxuICAgIHZhciBwYXRoID0gbGVmdEFuZFJlc3Qoa2V5KTtcbiAgICBpZihBcnJheS5pc0FycmF5KHBhdGgpKXtcbiAgICAgICAgcmV0dXJuIEVudGkuc2V0KG1vZGVsW3BhdGhbMF1dLCBwYXRoWzFdLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgdmFyIG9yaWdpbmFsID0gbW9kZWxba2V5XTtcblxuICAgIGlmKHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcgJiYgdmFsdWUgPT09IG9yaWdpbmFsKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBrZXlzQ2hhbmdlZCA9ICEoa2V5IGluIG1vZGVsKTtcblxuICAgIG1vZGVsW2tleV0gPSB2YWx1ZTtcblxuICAgIHZhciBldmVudHMgPSBbW21vZGVsLCBrZXksIHZhbHVlXV07XG5cbiAgICBpZihrZXlzQ2hhbmdlZCl7XG4gICAgICAgIGlmKEFycmF5LmlzQXJyYXkobW9kZWwpKXtcbiAgICAgICAgICAgIGV2ZW50cy5wdXNoKFttb2RlbCwgJ2xlbmd0aCcsIG1vZGVsLmxlbmd0aF0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZW1pdChldmVudHMpO1xufTtcbkVudGkucHVzaCA9IGZ1bmN0aW9uKG1vZGVsLCBrZXksIHZhbHVlKXtcbiAgICBpZighbW9kZWwgfHwgdHlwZW9mIG1vZGVsICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgdGFyZ2V0O1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPCAzKXtcbiAgICAgICAgdmFsdWUgPSBrZXk7XG4gICAgICAgIGtleSA9ICcuJztcbiAgICAgICAgdGFyZ2V0ID0gbW9kZWw7XG4gICAgfWVsc2V7XG4gICAgICAgIHZhciBwYXRoID0gbGVmdEFuZFJlc3Qoa2V5KTtcbiAgICAgICAgaWYoQXJyYXkuaXNBcnJheShwYXRoKSl7XG4gICAgICAgICAgICByZXR1cm4gRW50aS5wdXNoKG1vZGVsW3BhdGhbMF1dLCBwYXRoWzFdLCB2YWx1ZSk7XG4gICAgICAgIH1cblxuICAgICAgICB0YXJnZXQgPSBtb2RlbFtrZXldO1xuICAgIH1cblxuICAgIGlmKCFBcnJheS5pc0FycmF5KHRhcmdldCkpe1xuICAgICAgICB0aHJvdyAnVGhlIHRhcmdldCBpcyBub3QgYW4gYXJyYXkuJztcbiAgICB9XG5cbiAgICB0YXJnZXQucHVzaCh2YWx1ZSk7XG5cbiAgICB2YXIgZXZlbnRzID0gW1xuICAgICAgICBbdGFyZ2V0LCB0YXJnZXQubGVuZ3RoLTEsIHZhbHVlXSxcbiAgICAgICAgW3RhcmdldCwgJ2xlbmd0aCcsIHRhcmdldC5sZW5ndGhdXG4gICAgXTtcblxuICAgIGVtaXQoZXZlbnRzKTtcbn07XG5FbnRpLmluc2VydCA9IGZ1bmN0aW9uKG1vZGVsLCBrZXksIHZhbHVlLCBpbmRleCl7XG4gICAgaWYoIW1vZGVsIHx8IHR5cGVvZiBtb2RlbCAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG5cbiAgICB2YXIgdGFyZ2V0O1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPCA0KXtcbiAgICAgICAgaW5kZXggPSB2YWx1ZTtcbiAgICAgICAgdmFsdWUgPSBrZXk7XG4gICAgICAgIGtleSA9ICcuJztcbiAgICAgICAgdGFyZ2V0ID0gbW9kZWw7XG4gICAgfWVsc2V7XG4gICAgICAgIHZhciBwYXRoID0gbGVmdEFuZFJlc3Qoa2V5KTtcbiAgICAgICAgaWYoQXJyYXkuaXNBcnJheShwYXRoKSl7XG4gICAgICAgICAgICByZXR1cm4gRW50aS5pbnNlcnQobW9kZWxbcGF0aFswXV0sIHBhdGhbMV0sIHZhbHVlLCBpbmRleCk7XG4gICAgICAgIH1cblxuICAgICAgICB0YXJnZXQgPSBtb2RlbFtrZXldO1xuICAgIH1cblxuICAgIGlmKCFBcnJheS5pc0FycmF5KHRhcmdldCkpe1xuICAgICAgICB0aHJvdyAnVGhlIHRhcmdldCBpcyBub3QgYW4gYXJyYXkuJztcbiAgICB9XG5cbiAgICB0YXJnZXQuc3BsaWNlKGluZGV4LCAwLCB2YWx1ZSk7XG5cbiAgICB2YXIgZXZlbnRzID0gW1xuICAgICAgICBbdGFyZ2V0LCBpbmRleCwgdmFsdWVdLFxuICAgICAgICBbdGFyZ2V0LCAnbGVuZ3RoJywgdGFyZ2V0Lmxlbmd0aF1cbiAgICBdO1xuXG4gICAgZW1pdChldmVudHMpO1xufTtcbkVudGkucmVtb3ZlID0gZnVuY3Rpb24obW9kZWwsIGtleSwgc3ViS2V5KXtcbiAgICBpZighbW9kZWwgfHwgdHlwZW9mIG1vZGVsICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgcGF0aCA9IGxlZnRBbmRSZXN0KGtleSk7XG4gICAgaWYoQXJyYXkuaXNBcnJheShwYXRoKSl7XG4gICAgICAgIHJldHVybiBFbnRpLnJlbW92ZShtb2RlbFtwYXRoWzBdXSwgcGF0aFsxXSwgc3ViS2V5KTtcbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgYSBrZXkgb2ZmIG9mIGFuIG9iamVjdCBhdCAna2V5J1xuICAgIGlmKHN1YktleSAhPSBudWxsKXtcbiAgICAgICAgRW50aS5yZW1vdmUobW9kZWxba2V5XSwgc3ViS2V5KTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmKGtleSA9PT0gJy4nKXtcbiAgICAgICAgdGhyb3cgJy4gKHNlbGYpIGlzIG5vdCBhIHZhbGlkIGtleSB0byByZW1vdmUnO1xuICAgIH1cblxuICAgIHZhciBldmVudHMgPSBbXTtcblxuICAgIGlmKEFycmF5LmlzQXJyYXkobW9kZWwpKXtcbiAgICAgICAgbW9kZWwuc3BsaWNlKGtleSwgMSk7XG4gICAgICAgIGV2ZW50cy5wdXNoKFttb2RlbCwgJ2xlbmd0aCcsIG1vZGVsLmxlbmd0aF0pO1xuICAgIH1lbHNle1xuICAgICAgICBkZWxldGUgbW9kZWxba2V5XTtcbiAgICAgICAgZXZlbnRzLnB1c2goW21vZGVsLCBrZXldKTtcbiAgICB9XG5cbiAgICBlbWl0KGV2ZW50cyk7XG59O1xuRW50aS5tb3ZlID0gZnVuY3Rpb24obW9kZWwsIGtleSwgaW5kZXgpe1xuICAgIGlmKCFtb2RlbCB8fCB0eXBlb2YgbW9kZWwgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBwYXRoID0gbGVmdEFuZFJlc3Qoa2V5KTtcbiAgICBpZihBcnJheS5pc0FycmF5KHBhdGgpKXtcbiAgICAgICAgcmV0dXJuIEVudGkubW92ZShtb2RlbFtwYXRoWzBdXSwgcGF0aFsxXSwgaW5kZXgpO1xuICAgIH1cblxuICAgIGlmKGtleSA9PT0gaW5kZXgpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYoIUFycmF5LmlzQXJyYXkobW9kZWwpKXtcbiAgICAgICAgdGhyb3cgJ1RoZSBtb2RlbCBpcyBub3QgYW4gYXJyYXkuJztcbiAgICB9XG5cbiAgICB2YXIgaXRlbSA9IG1vZGVsW2tleV07XG5cbiAgICBtb2RlbC5zcGxpY2Uoa2V5LCAxKTtcblxuICAgIG1vZGVsLnNwbGljZShpbmRleCAtIChpbmRleCA+IGtleSA/IDAgOiAxKSwgMCwgaXRlbSk7XG5cbiAgICBlbWl0KFtbbW9kZWwsIGluZGV4LCBpdGVtXV0pO1xufTtcbkVudGkudXBkYXRlID0gZnVuY3Rpb24obW9kZWwsIGtleSwgdmFsdWUpe1xuICAgIGlmKCFtb2RlbCB8fCB0eXBlb2YgbW9kZWwgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciB0YXJnZXQsXG4gICAgICAgIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5KHZhbHVlKTtcblxuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPCAzKXtcbiAgICAgICAgdmFsdWUgPSBrZXk7XG4gICAgICAgIGtleSA9ICcuJztcbiAgICAgICAgdGFyZ2V0ID0gbW9kZWw7XG4gICAgfWVsc2V7XG4gICAgICAgIHZhciBwYXRoID0gbGVmdEFuZFJlc3Qoa2V5KTtcbiAgICAgICAgaWYoQXJyYXkuaXNBcnJheShwYXRoKSl7XG4gICAgICAgICAgICByZXR1cm4gRW50aS51cGRhdGUobW9kZWxbcGF0aFswXV0sIHBhdGhbMV0sIHZhbHVlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRhcmdldCA9IG1vZGVsW2tleV07XG5cbiAgICAgICAgaWYodGFyZ2V0ID09IG51bGwpe1xuICAgICAgICAgICAgbW9kZWxba2V5XSA9IGlzQXJyYXkgPyBbXSA6IHt9O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYodHlwZW9mIHZhbHVlICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIHRocm93ICdUaGUgdmFsdWUgaXMgbm90IGFuIG9iamVjdC4nO1xuICAgIH1cblxuICAgIGlmKHR5cGVvZiB0YXJnZXQgIT09ICdvYmplY3QnKXtcbiAgICAgICAgdGhyb3cgJ1RoZSB0YXJnZXQgaXMgbm90IGFuIG9iamVjdC4nO1xuICAgIH1cblxuICAgIHZhciBldmVudHMgPSBbXSxcbiAgICAgICAgdXBkYXRlZE9iamVjdHMgPSBuZXcgV2Vha1NldCgpO1xuXG4gICAgZnVuY3Rpb24gdXBkYXRlVGFyZ2V0KHRhcmdldCwgdmFsdWUpe1xuICAgICAgICBmb3IodmFyIGtleSBpbiB2YWx1ZSl7XG4gICAgICAgICAgICB2YXIgY3VycmVudFZhbHVlID0gdGFyZ2V0W2tleV07XG4gICAgICAgICAgICBpZihjdXJyZW50VmFsdWUgaW5zdGFuY2VvZiBPYmplY3QgJiYgIXVwZGF0ZWRPYmplY3RzLmhhcyhjdXJyZW50VmFsdWUpICYmICEoY3VycmVudFZhbHVlIGluc3RhbmNlb2YgRGF0ZSkpe1xuICAgICAgICAgICAgICAgIHVwZGF0ZWRPYmplY3RzLmFkZChjdXJyZW50VmFsdWUpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZVRhcmdldChjdXJyZW50VmFsdWUsIHZhbHVlW2tleV0pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSB2YWx1ZVtrZXldO1xuICAgICAgICAgICAgZXZlbnRzLnB1c2goW3RhcmdldCwga2V5LCB2YWx1ZVtrZXldXSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihBcnJheS5pc0FycmF5KHRhcmdldCkpe1xuICAgICAgICAgICAgZXZlbnRzLnB1c2goW3RhcmdldCwgJ2xlbmd0aCcsIHRhcmdldC5sZW5ndGhdKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHVwZGF0ZVRhcmdldCh0YXJnZXQsIHZhbHVlKTtcblxuICAgIGVtaXQoZXZlbnRzKTtcbn07XG5FbnRpLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoRXZlbnRFbWl0dGVyLnByb3RvdHlwZSk7XG5FbnRpLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gMTAwO1xuRW50aS5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBFbnRpO1xuRW50aS5wcm90b3R5cGUuYXR0YWNoID0gZnVuY3Rpb24obW9kZWwpe1xuICAgIGlmKHRoaXMuX21vZGVsICE9PSBtb2RlbCl7XG4gICAgICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgfVxuXG4gICAgbW9kaWZpZWRFbnRpZXMuYWRkKHRoaXMpO1xuICAgIHRoaXMuX2F0dGFjaGVkID0gdHJ1ZTtcbiAgICB0aGlzLl9tb2RlbCA9IG1vZGVsO1xuICAgIHRoaXMuZW1pdCgnYXR0YWNoJywgbW9kZWwpO1xufTtcbkVudGkucHJvdG90eXBlLmRldGFjaCA9IGZ1bmN0aW9uKCl7XG4gICAgbW9kaWZpZWRFbnRpZXMuZGVsZXRlKHRoaXMpO1xuXG4gICAgdGhpcy5fZW1pdHRlZEV2ZW50cyA9IHt9O1xuICAgIHRoaXMuX21vZGVsID0ge307XG4gICAgdGhpcy5fYXR0YWNoZWQgPSBmYWxzZTtcbiAgICB0aGlzLmVtaXQoJ2RldGFjaCcpO1xufTtcbkVudGkucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpe1xuICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgdGhpcy5fZXZlbnRzID0gbnVsbDtcbiAgICB0aGlzLmVtaXQoJ2Rlc3Ryb3knKTtcbn07XG5FbnRpLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbihrZXkpe1xuICAgIHJldHVybiBFbnRpLmdldCh0aGlzLl9tb2RlbCwga2V5KTtcbn07XG5cbkVudGkucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uKGtleSwgdmFsdWUpe1xuICAgIHJldHVybiBFbnRpLnNldCh0aGlzLl9tb2RlbCwga2V5LCB2YWx1ZSk7XG59O1xuXG5FbnRpLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSl7XG4gICAgcmV0dXJuIEVudGkucHVzaC5hcHBseShudWxsLCBbdGhpcy5fbW9kZWxdLmNvbmNhdCh0b0FycmF5KGFyZ3VtZW50cykpKTtcbn07XG5cbkVudGkucHJvdG90eXBlLmluc2VydCA9IGZ1bmN0aW9uKGtleSwgdmFsdWUsIGluZGV4KXtcbiAgICByZXR1cm4gRW50aS5pbnNlcnQuYXBwbHkobnVsbCwgW3RoaXMuX21vZGVsXS5jb25jYXQodG9BcnJheShhcmd1bWVudHMpKSk7XG59O1xuXG5FbnRpLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbihrZXksIHN1YktleSl7XG4gICAgcmV0dXJuIEVudGkucmVtb3ZlLmFwcGx5KG51bGwsIFt0aGlzLl9tb2RlbF0uY29uY2F0KHRvQXJyYXkoYXJndW1lbnRzKSkpO1xufTtcblxuRW50aS5wcm90b3R5cGUubW92ZSA9IGZ1bmN0aW9uKGtleSwgaW5kZXgpe1xuICAgIHJldHVybiBFbnRpLm1vdmUuYXBwbHkobnVsbCwgW3RoaXMuX21vZGVsXS5jb25jYXQodG9BcnJheShhcmd1bWVudHMpKSk7XG59O1xuXG5FbnRpLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbihrZXksIGluZGV4KXtcbiAgICByZXR1cm4gRW50aS51cGRhdGUuYXBwbHkobnVsbCwgW3RoaXMuX21vZGVsXS5jb25jYXQodG9BcnJheShhcmd1bWVudHMpKSk7XG59O1xuRW50aS5wcm90b3R5cGUuaXNBdHRhY2hlZCA9IGZ1bmN0aW9uKCl7XG4gICAgcmV0dXJuIHRoaXMuX2F0dGFjaGVkO1xufTtcbkVudGkucHJvdG90eXBlLmF0dGFjaGVkQ291bnQgPSBmdW5jdGlvbigpe1xuICAgIHJldHVybiBtb2RpZmllZEVudGllcy5zaXplO1xufTtcblxuRW50aS5pc0VudGkgPSBmdW5jdGlvbih0YXJnZXQpe1xuICAgIHJldHVybiB0YXJnZXQgJiYgISF+Z2xvYmFsU3RhdGUuaW5zdGFuY2VzLmluZGV4T2YodGFyZ2V0LmNvbnN0cnVjdG9yKTtcbn07XG5cbkVudGkuc3RvcmUgPSBmdW5jdGlvbih0YXJnZXQsIGtleSwgdmFsdWUpe1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPCAyKXtcbiAgICAgICAgcmV0dXJuIEVudGkuZ2V0KHRhcmdldCwga2V5KTtcbiAgICB9XG5cbiAgICBFbnRpLnNldCh0YXJnZXQsIGtleSwgdmFsdWUpO1xufTtcblxuZ2xvYmFsU3RhdGUuaW5zdGFuY2VzLnB1c2goRW50aSk7XG5cbm1vZHVsZS5leHBvcnRzID0gRW50aTtcbiIsInZhciBpcyA9IHJlcXVpcmUoJy4vaXMnKSxcbiAgICBHRU5FUklDID0gJ19nZW5lcmljJyxcbiAgICBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudHMnKS5FdmVudEVtaXR0ZXIsXG4gICAgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbmZ1bmN0aW9uIGZsYXR0ZW4oaXRlbSl7XG4gICAgcmV0dXJuIEFycmF5LmlzQXJyYXkoaXRlbSkgPyBpdGVtLnJlZHVjZShmdW5jdGlvbihyZXN1bHQsIGVsZW1lbnQpe1xuICAgICAgICBpZihlbGVtZW50ID09IG51bGwpe1xuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0LmNvbmNhdChmbGF0dGVuKGVsZW1lbnQpKTtcbiAgICB9LFtdKSA6IGl0ZW07XG59XG5cbmZ1bmN0aW9uIGF0dGFjaFByb3BlcnRpZXMob2JqZWN0LCBmaXJtKXtcbiAgICBmb3IodmFyIGtleSBpbiB0aGlzLl9wcm9wZXJ0aWVzKXtcbiAgICAgICAgdGhpcy5fcHJvcGVydGllc1trZXldLmF0dGFjaChvYmplY3QsIGZpcm0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gb25SZW5kZXIoKXtcblxuICAgIC8vIEVuc3VyZSBhbGwgYmluZGluZ3MgYXJlIHNvbWV3aGF0IGF0dGFjaGVkIGp1c3QgYmVmb3JlIHJlbmRlcmluZ1xuICAgIHRoaXMuYXR0YWNoKHVuZGVmaW5lZCwgMCk7XG5cbiAgICBmb3IodmFyIGtleSBpbiB0aGlzLl9wcm9wZXJ0aWVzKXtcbiAgICAgICAgdGhpcy5fcHJvcGVydGllc1trZXldLnVwZGF0ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZGV0YWNoUHJvcGVydGllcyhmaXJtKXtcbiAgICBmb3IodmFyIGtleSBpbiB0aGlzLl9wcm9wZXJ0aWVzKXtcbiAgICAgICAgdGhpcy5fcHJvcGVydGllc1trZXldLmRldGFjaChmaXJtKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRlc3Ryb3lQcm9wZXJ0aWVzKCl7XG4gICAgZm9yKHZhciBrZXkgaW4gdGhpcy5fcHJvcGVydGllcyl7XG4gICAgICAgIHRoaXMuX3Byb3BlcnRpZXNba2V5XS5kZXN0cm95KCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjbG9uZSgpe1xuICAgIHJldHVybiB0aGlzLmZhc3RuKHRoaXMuY29tcG9uZW50Ll90eXBlLCB0aGlzLmNvbXBvbmVudC5fc2V0dGluZ3MsIHRoaXMuY29tcG9uZW50Ll9jaGlsZHJlbi5maWx0ZXIoZnVuY3Rpb24oY2hpbGQpe1xuICAgICAgICAgICAgcmV0dXJuICFjaGlsZC5fdGVtcGxhdGVkO1xuICAgICAgICB9KS5tYXAoZnVuY3Rpb24oY2hpbGQpe1xuICAgICAgICAgICAgcmV0dXJuIGNoaWxkLmNsb25lKCk7XG4gICAgICAgIH0pXG4gICAgKTtcbn1cblxuZnVuY3Rpb24gZ2V0U2V0QmluZGluZyhuZXdCaW5kaW5nKXtcbiAgICBpZighYXJndW1lbnRzLmxlbmd0aCl7XG4gICAgICAgIHJldHVybiB0aGlzLmJpbmRpbmc7XG4gICAgfVxuXG4gICAgaWYoIWlzLmJpbmRpbmcobmV3QmluZGluZykpe1xuICAgICAgICBuZXdCaW5kaW5nID0gdGhpcy5mYXN0bi5iaW5kaW5nKG5ld0JpbmRpbmcpO1xuICAgIH1cblxuICAgIGlmKHRoaXMuYmluZGluZyAmJiB0aGlzLmJpbmRpbmcgIT09IG5ld0JpbmRpbmcpe1xuICAgICAgICB0aGlzLmJpbmRpbmcucmVtb3ZlTGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMuZW1pdEF0dGFjaCk7XG4gICAgICAgIG5ld0JpbmRpbmcuYXR0YWNoKHRoaXMuYmluZGluZy5fbW9kZWwsIHRoaXMuYmluZGluZy5fZmlybSk7XG4gICAgfVxuXG4gICAgdGhpcy5iaW5kaW5nID0gbmV3QmluZGluZztcblxuICAgIHRoaXMuYmluZGluZy5vbignY2hhbmdlJywgdGhpcy5lbWl0QXR0YWNoKTtcbiAgICB0aGlzLmJpbmRpbmcub24oJ2RldGFjaCcsIHRoaXMuZW1pdERldGFjaCk7XG5cbiAgICB0aGlzLmVtaXRBdHRhY2goKTtcblxuICAgIHJldHVybiB0aGlzLmNvbXBvbmVudDtcbn07XG5cbmZ1bmN0aW9uIGVtaXRBdHRhY2goKXtcbiAgICB2YXIgbmV3Qm91bmQgPSB0aGlzLmJpbmRpbmcoKTtcbiAgICBpZihuZXdCb3VuZCAhPT0gdGhpcy5sYXN0Qm91bmQpe1xuICAgICAgICB0aGlzLmxhc3RCb3VuZCA9IG5ld0JvdW5kO1xuICAgICAgICB0aGlzLnNjb3BlLmF0dGFjaCh0aGlzLmxhc3RCb3VuZCk7XG4gICAgICAgIHRoaXMuY29tcG9uZW50LmVtaXQoJ2F0dGFjaCcsIHRoaXMuc2NvcGUsIDEpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZW1pdERldGFjaCgpe1xuICAgIHRoaXMuY29tcG9uZW50LmVtaXQoJ2RldGFjaCcsIDEpO1xufVxuXG5mdW5jdGlvbiBnZXRTY29wZSgpe1xuICAgIHJldHVybiB0aGlzLnNjb3BlO1xufVxuXG5mdW5jdGlvbiBkZXN0cm95KCl7XG4gICAgaWYodGhpcy5kZXN0cm95ZWQpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuZGVzdHJveWVkID0gdHJ1ZTtcblxuICAgIHRoaXMuY29tcG9uZW50XG4gICAgICAgIC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbmRlcicpXG4gICAgICAgIC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2F0dGFjaCcpO1xuXG4gICAgdGhpcy5jb21wb25lbnQuZW1pdCgnZGVzdHJveScpO1xuICAgIHRoaXMuY29tcG9uZW50LmVsZW1lbnQgPSBudWxsO1xuICAgIHRoaXMuc2NvcGUuZGVzdHJveSgpO1xuICAgIHRoaXMuYmluZGluZy5kZXN0cm95KCk7XG5cbiAgICByZXR1cm4gdGhpcy5jb21wb25lbnQ7XG59XG5cbmZ1bmN0aW9uIGF0dGFjaENvbXBvbmVudChvYmplY3QsIGZpcm0pe1xuICAgIHRoaXMuYmluZGluZy5hdHRhY2gob2JqZWN0LCBmaXJtKTtcbiAgICByZXR1cm4gdGhpcy5jb21wb25lbnQ7XG59XG5cbmZ1bmN0aW9uIGRldGFjaENvbXBvbmVudChmaXJtKXtcbiAgICB0aGlzLmJpbmRpbmcuZGV0YWNoKGZpcm0pO1xuICAgIHJldHVybiB0aGlzLmNvbXBvbmVudDtcbn1cblxuZnVuY3Rpb24gaXNEZXN0cm95ZWQoKXtcbiAgICByZXR1cm4gdGhpcy5kZXN0cm95ZWQ7XG59XG5cbmZ1bmN0aW9uIHNldFByb3BlcnR5KGtleSwgcHJvcGVydHkpe1xuXG4gICAgLy8gQWRkIGEgZGVmYXVsdCBwcm9wZXJ0eSBvciB1c2UgdGhlIG9uZSBhbHJlYWR5IHRoZXJlXG4gICAgaWYoIXByb3BlcnR5KXtcbiAgICAgICAgcHJvcGVydHkgPSB0aGlzLmNvbXBvbmVudFtrZXldIHx8IHRoaXMuZmFzdG4ucHJvcGVydHkoKTtcbiAgICB9XG5cbiAgICB0aGlzLmNvbXBvbmVudFtrZXldID0gcHJvcGVydHk7XG4gICAgdGhpcy5jb21wb25lbnQuX3Byb3BlcnRpZXNba2V5XSA9IHByb3BlcnR5O1xuXG4gICAgcmV0dXJuIHRoaXMuY29tcG9uZW50O1xufVxuXG5mdW5jdGlvbiBleHRlbmRDb21wb25lbnQodHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcblxuICAgIGlmKHR5cGUgaW4gdGhpcy50eXBlcyl7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbXBvbmVudDtcbiAgICB9XG5cbiAgICBpZighKHR5cGUgaW4gdGhpcy5mYXN0bi5jb21wb25lbnRzKSl7XG5cbiAgICAgICAgaWYoIShHRU5FUklDIGluIHRoaXMuZmFzdG4uY29tcG9uZW50cykpe1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBjb21wb25lbnQgb2YgdHlwZSBcIicgKyB0eXBlICsgJ1wiIGlzIGxvYWRlZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5mYXN0bi5jb21wb25lbnRzLl9nZW5lcmljKHRoaXMuZmFzdG4sIHRoaXMuY29tcG9uZW50LCB0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pO1xuXG4gICAgICAgIHRoaXMudHlwZXMuX2dlbmVyaWMgPSB0cnVlO1xuICAgIH1lbHNle1xuXG4gICAgICAgIHRoaXMuZmFzdG4uY29tcG9uZW50c1t0eXBlXSh0aGlzLmZhc3RuLCB0aGlzLmNvbXBvbmVudCwgdHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKTtcbiAgICB9XG5cbiAgICB0aGlzLnR5cGVzW3R5cGVdID0gdHJ1ZTtcblxuICAgIHJldHVybiB0aGlzLmNvbXBvbmVudDtcbn07XG5cbmZ1bmN0aW9uIGlzVHlwZSh0eXBlKXtcbiAgICByZXR1cm4gdHlwZSBpbiB0aGlzLnR5cGVzO1xufVxuXG5mdW5jdGlvbiBGYXN0bkNvbXBvbmVudChmYXN0biwgdHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcbiAgICB2YXIgY29tcG9uZW50ID0gdGhpcztcblxuICAgIHZhciBjb21wb25lbnRTY29wZSA9IHtcbiAgICAgICAgdHlwZXM6IHt9LFxuICAgICAgICBmYXN0bjogZmFzdG4sXG4gICAgICAgIGNvbXBvbmVudDogY29tcG9uZW50LFxuICAgICAgICBiaW5kaW5nOiBmYXN0bi5iaW5kaW5nKCcuJyksXG4gICAgICAgIGRlc3Ryb3llZDogZmFsc2UsXG4gICAgICAgIHNjb3BlOiBuZXcgZmFzdG4uTW9kZWwoZmFsc2UpLFxuICAgICAgICBsYXN0Qm91bmQ6IG51bGxcbiAgICB9O1xuXG4gICAgY29tcG9uZW50U2NvcGUuZW1pdEF0dGFjaCA9IGVtaXRBdHRhY2guYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50U2NvcGUuZW1pdERldGFjaCA9IGVtaXREZXRhY2guYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50U2NvcGUuYmluZGluZy5fZGVmYXVsdF9iaW5kaW5nID0gdHJ1ZTtcblxuICAgIGNvbXBvbmVudC5fdHlwZSA9IHR5cGU7XG4gICAgY29tcG9uZW50Ll9wcm9wZXJ0aWVzID0ge307XG4gICAgY29tcG9uZW50Ll9zZXR0aW5ncyA9IHNldHRpbmdzIHx8IHt9O1xuICAgIGNvbXBvbmVudC5fY2hpbGRyZW4gPSBjaGlsZHJlbiA/IGZsYXR0ZW4oY2hpbGRyZW4pIDogW107XG5cbiAgICBjb21wb25lbnQuYXR0YWNoID0gYXR0YWNoQ29tcG9uZW50LmJpbmQoY29tcG9uZW50U2NvcGUpO1xuICAgIGNvbXBvbmVudC5kZXRhY2ggPSBkZXRhY2hDb21wb25lbnQuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LnNjb3BlID0gZ2V0U2NvcGUuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LmRlc3Ryb3kgPSBkZXN0cm95LmJpbmQoY29tcG9uZW50U2NvcGUpO1xuICAgIGNvbXBvbmVudC5kZXN0cm95ZWQgPSBpc0Rlc3Ryb3llZC5iaW5kKGNvbXBvbmVudFNjb3BlKTtcbiAgICBjb21wb25lbnQuYmluZGluZyA9IGdldFNldEJpbmRpbmcuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LnNldFByb3BlcnR5ID0gc2V0UHJvcGVydHkuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LmNsb25lID0gY2xvbmUuYmluZChjb21wb25lbnRTY29wZSk7XG4gICAgY29tcG9uZW50LmNoaWxkcmVuID0gc2xpY2UuYmluZChjb21wb25lbnQuX2NoaWxkcmVuKTtcbiAgICBjb21wb25lbnQuZXh0ZW5kID0gZXh0ZW5kQ29tcG9uZW50LmJpbmQoY29tcG9uZW50U2NvcGUpO1xuICAgIGNvbXBvbmVudC5pcyA9IGlzVHlwZS5iaW5kKGNvbXBvbmVudFNjb3BlKTtcblxuICAgIGNvbXBvbmVudC5iaW5kaW5nKGNvbXBvbmVudFNjb3BlLmJpbmRpbmcpO1xuXG4gICAgY29tcG9uZW50Lm9uKCdhdHRhY2gnLCBhdHRhY2hQcm9wZXJ0aWVzLmJpbmQodGhpcykpO1xuICAgIGNvbXBvbmVudC5vbigncmVuZGVyJywgb25SZW5kZXIuYmluZCh0aGlzKSk7XG4gICAgY29tcG9uZW50Lm9uKCdkZXRhY2gnLCBkZXRhY2hQcm9wZXJ0aWVzLmJpbmQodGhpcykpO1xuICAgIGNvbXBvbmVudC5vbignZGVzdHJveScsIGRlc3Ryb3lQcm9wZXJ0aWVzLmJpbmQodGhpcykpO1xuXG4gICAgaWYoZmFzdG4uZGVidWcpe1xuICAgICAgICBjb21wb25lbnQub24oJ3JlbmRlcicsIGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBpZihjb21wb25lbnQuZWxlbWVudCAmJiB0eXBlb2YgY29tcG9uZW50LmVsZW1lbnQgPT09ICdvYmplY3QnKXtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuZWxlbWVudC5fY29tcG9uZW50ID0gY29tcG9uZW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5GYXN0bkNvbXBvbmVudC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEV2ZW50RW1pdHRlci5wcm90b3R5cGUpO1xuRmFzdG5Db21wb25lbnQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gRmFzdG5Db21wb25lbnQ7XG5GYXN0bkNvbXBvbmVudC5wcm90b3R5cGUuX2Zhc3RuX2NvbXBvbmVudCA9IHRydWU7XG5cbm1vZHVsZS5leHBvcnRzID0gRmFzdG5Db21wb25lbnQ7IiwidmFyIEVudGkgPSByZXF1aXJlKCdlbnRpJyksXG4gICAgaXMgPSByZXF1aXJlKCcuL2lzJyksXG4gICAgZmlybWVyID0gcmVxdWlyZSgnLi9maXJtZXInKSxcbiAgICBmdW5jdGlvbkVtaXR0ZXIgPSByZXF1aXJlKCcuL2Z1bmN0aW9uRW1pdHRlcicpLFxuICAgIHNldFByb3RvdHlwZU9mID0gcmVxdWlyZSgnc2V0cHJvdG90eXBlb2YnKSxcbiAgICBzYW1lID0gcmVxdWlyZSgnc2FtZS12YWx1ZScpO1xuXG5mdW5jdGlvbiBmdXNlQmluZGluZygpe1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgIHZhciBiaW5kaW5ncyA9IGFyZ3Muc2xpY2UoKSxcbiAgICAgICAgdHJhbnNmb3JtID0gYmluZGluZ3MucG9wKCksXG4gICAgICAgIHVwZGF0ZVRyYW5zZm9ybSxcbiAgICAgICAgcmVzdWx0QmluZGluZyA9IGNyZWF0ZUJpbmRpbmcoJ3Jlc3VsdCcpLFxuICAgICAgICBzZWxmQ2hhbmdpbmc7XG5cbiAgICByZXN1bHRCaW5kaW5nLl9hcmd1bWVudHMgPSBhcmdzO1xuXG4gICAgaWYodHlwZW9mIGJpbmRpbmdzW2JpbmRpbmdzLmxlbmd0aC0xXSA9PT0gJ2Z1bmN0aW9uJyAmJiAhaXMuYmluZGluZyhiaW5kaW5nc1tiaW5kaW5ncy5sZW5ndGgtMV0pKXtcbiAgICAgICAgdXBkYXRlVHJhbnNmb3JtID0gdHJhbnNmb3JtO1xuICAgICAgICB0cmFuc2Zvcm0gPSBiaW5kaW5ncy5wb3AoKTtcbiAgICB9XG5cbiAgICByZXN1bHRCaW5kaW5nLl9tb2RlbC5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICByZXN1bHRCaW5kaW5nLl9zZXQgPSBmdW5jdGlvbih2YWx1ZSl7XG4gICAgICAgIGlmKHVwZGF0ZVRyYW5zZm9ybSl7XG4gICAgICAgICAgICBzZWxmQ2hhbmdpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdmFyIG5ld1ZhbHVlID0gdXBkYXRlVHJhbnNmb3JtKHZhbHVlKTtcbiAgICAgICAgICAgIGlmKCFzYW1lKG5ld1ZhbHVlLCBiaW5kaW5nc1swXSgpKSl7XG4gICAgICAgICAgICAgICAgYmluZGluZ3NbMF0obmV3VmFsdWUpO1xuICAgICAgICAgICAgICAgIHJlc3VsdEJpbmRpbmcuX2NoYW5nZShuZXdWYWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzZWxmQ2hhbmdpbmcgPSBmYWxzZTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICByZXN1bHRCaW5kaW5nLl9jaGFuZ2UodmFsdWUpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGNoYW5nZSgpe1xuICAgICAgICBpZihzZWxmQ2hhbmdpbmcpe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdEJpbmRpbmcodHJhbnNmb3JtLmFwcGx5KG51bGwsIGJpbmRpbmdzLm1hcChmdW5jdGlvbihiaW5kaW5nKXtcbiAgICAgICAgICAgIHJldHVybiBiaW5kaW5nKCk7XG4gICAgICAgIH0pKSk7XG4gICAgfVxuXG4gICAgYmluZGluZ3MuZm9yRWFjaChmdW5jdGlvbihiaW5kaW5nLCBpbmRleCl7XG4gICAgICAgIGlmKCFpcy5iaW5kaW5nKGJpbmRpbmcpKXtcbiAgICAgICAgICAgIGJpbmRpbmcgPSBjcmVhdGVCaW5kaW5nKGJpbmRpbmcpO1xuICAgICAgICAgICAgYmluZGluZ3Muc3BsaWNlKGluZGV4LDEsYmluZGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgYmluZGluZy5vbignY2hhbmdlJywgY2hhbmdlKTtcbiAgICAgICAgcmVzdWx0QmluZGluZy5vbignZGV0YWNoJywgYmluZGluZy5kZXRhY2gpO1xuICAgIH0pO1xuXG4gICAgdmFyIGxhc3RBdHRhY2hlZDtcbiAgICByZXN1bHRCaW5kaW5nLm9uKCdhdHRhY2gnLCBmdW5jdGlvbihvYmplY3Qpe1xuICAgICAgICBzZWxmQ2hhbmdpbmcgPSB0cnVlO1xuICAgICAgICBiaW5kaW5ncy5mb3JFYWNoKGZ1bmN0aW9uKGJpbmRpbmcpe1xuICAgICAgICAgICAgYmluZGluZy5hdHRhY2gob2JqZWN0LCAxKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHNlbGZDaGFuZ2luZyA9IGZhbHNlO1xuICAgICAgICBpZihsYXN0QXR0YWNoZWQgIT09IG9iamVjdCl7XG4gICAgICAgICAgICBjaGFuZ2UoKTtcbiAgICAgICAgfVxuICAgICAgICBsYXN0QXR0YWNoZWQgPSBvYmplY3Q7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0QmluZGluZztcbn1cblxuZnVuY3Rpb24gY3JlYXRlVmFsdWVCaW5kaW5nKCl7XG4gICAgdmFyIHZhbHVlQmluZGluZyA9IGNyZWF0ZUJpbmRpbmcoJ3ZhbHVlJyk7XG4gICAgdmFsdWVCaW5kaW5nLmF0dGFjaCA9IGZ1bmN0aW9uKCl7cmV0dXJuIHZhbHVlQmluZGluZzt9O1xuICAgIHZhbHVlQmluZGluZy5kZXRhY2ggPSBmdW5jdGlvbigpe3JldHVybiB2YWx1ZUJpbmRpbmc7fTtcbiAgICByZXR1cm4gdmFsdWVCaW5kaW5nO1xufVxuXG5mdW5jdGlvbiBiaW5kaW5nVGVtcGxhdGUobmV3VmFsdWUpe1xuICAgIGlmKCFhcmd1bWVudHMubGVuZ3RoKXtcbiAgICAgICAgcmV0dXJuIHRoaXMudmFsdWU7XG4gICAgfVxuXG4gICAgaWYodGhpcy5iaW5kaW5nLl9mYXN0bl9iaW5kaW5nID09PSAnLicpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5iaW5kaW5nLl9zZXQobmV3VmFsdWUpO1xuICAgIHJldHVybiB0aGlzLmJpbmRpbmc7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUJpbmRpbmcocGF0aCwgbW9yZSl7XG5cbiAgICBpZihtb3JlKXsgLy8gdXNlZCBpbnN0ZWFkIG9mIGFyZ3VtZW50cy5sZW5ndGggZm9yIHBlcmZvcm1hbmNlXG4gICAgICAgIHJldHVybiBmdXNlQmluZGluZy5hcHBseShudWxsLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIGlmKHBhdGggPT0gbnVsbCl7XG4gICAgICAgIHJldHVybiBjcmVhdGVWYWx1ZUJpbmRpbmcoKTtcbiAgICB9XG5cbiAgICB2YXIgYmluZGluZ1Njb3BlID0ge30sXG4gICAgICAgIGJpbmRpbmcgPSBiaW5kaW5nU2NvcGUuYmluZGluZyA9IGJpbmRpbmdUZW1wbGF0ZS5iaW5kKGJpbmRpbmdTY29wZSksXG4gICAgICAgIGRlc3Ryb3llZDtcblxuICAgIHNldFByb3RvdHlwZU9mKGJpbmRpbmcsIGZ1bmN0aW9uRW1pdHRlcik7XG4gICAgYmluZGluZy5zZXRNYXhMaXN0ZW5lcnMoMTAwMDApO1xuICAgIGJpbmRpbmcuX2FyZ3VtZW50cyA9IFtwYXRoXTtcbiAgICBiaW5kaW5nLl9tb2RlbCA9IG5ldyBFbnRpKGZhbHNlKTtcbiAgICBiaW5kaW5nLl9mYXN0bl9iaW5kaW5nID0gcGF0aDtcbiAgICBiaW5kaW5nLl9maXJtID0gLUluZmluaXR5O1xuXG4gICAgZnVuY3Rpb24gbW9kZWxBdHRhY2hIYW5kbGVyKGRhdGEpe1xuICAgICAgICBiaW5kaW5nLl9tb2RlbC5hdHRhY2goZGF0YSk7XG4gICAgICAgIGJpbmRpbmcuX2NoYW5nZShiaW5kaW5nLl9tb2RlbC5nZXQocGF0aCkpO1xuICAgICAgICBiaW5kaW5nLmVtaXQoJ2F0dGFjaCcsIGRhdGEsIDEpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG1vZGVsRGV0YWNoSGFuZGxlcigpe1xuICAgICAgICBiaW5kaW5nLl9tb2RlbC5kZXRhY2goKTtcbiAgICB9XG5cbiAgICBiaW5kaW5nLmF0dGFjaCA9IGZ1bmN0aW9uKG9iamVjdCwgZmlybSl7XG5cbiAgICAgICAgLy8gSWYgdGhlIGJpbmRpbmcgaXMgYmVpbmcgYXNrZWQgdG8gYXR0YWNoIGxvb3NseSB0byBhbiBvYmplY3QsXG4gICAgICAgIC8vIGJ1dCBpdCBoYXMgYWxyZWFkeSBiZWVuIGRlZmluZWQgYXMgYmVpbmcgZmlybWx5IGF0dGFjaGVkLCBkbyBub3QgYXR0YWNoLlxuICAgICAgICBpZihmaXJtZXIoYmluZGluZywgZmlybSkpe1xuICAgICAgICAgICAgcmV0dXJuIGJpbmRpbmc7XG4gICAgICAgIH1cblxuICAgICAgICBiaW5kaW5nLl9maXJtID0gZmlybTtcblxuICAgICAgICB2YXIgaXNFbnRpID0gRW50aS5pc0VudGkob2JqZWN0KTtcblxuICAgICAgICBpZihpc0VudGkgJiYgYmluZGluZ1Njb3BlLmF0dGFjaGVkTW9kZWwgPT09IG9iamVjdCl7XG4gICAgICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGJpbmRpbmdTY29wZS5hdHRhY2hlZE1vZGVsKXtcbiAgICAgICAgICAgIGJpbmRpbmdTY29wZS5hdHRhY2hlZE1vZGVsLnJlbW92ZUxpc3RlbmVyKCdhdHRhY2gnLCBtb2RlbEF0dGFjaEhhbmRsZXIpO1xuICAgICAgICAgICAgYmluZGluZ1Njb3BlLmF0dGFjaGVkTW9kZWwucmVtb3ZlTGlzdGVuZXIoJ2RldGFjaCcsIG1vZGVsRGV0YWNoSGFuZGxlcik7XG4gICAgICAgICAgICBiaW5kaW5nU2NvcGUuYXR0YWNoZWRNb2RlbCA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZihpc0VudGkpe1xuICAgICAgICAgICAgYmluZGluZ1Njb3BlLmF0dGFjaGVkTW9kZWwgPSBvYmplY3Q7XG4gICAgICAgICAgICBiaW5kaW5nU2NvcGUuYXR0YWNoZWRNb2RlbC5vbignYXR0YWNoJywgbW9kZWxBdHRhY2hIYW5kbGVyKTtcbiAgICAgICAgICAgIGJpbmRpbmdTY29wZS5hdHRhY2hlZE1vZGVsLm9uKCdkZXRhY2gnLCBtb2RlbERldGFjaEhhbmRsZXIpO1xuICAgICAgICAgICAgb2JqZWN0ID0gb2JqZWN0Ll9tb2RlbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKCEob2JqZWN0IGluc3RhbmNlb2YgT2JqZWN0KSl7XG4gICAgICAgICAgICBvYmplY3QgPSB7fTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGJpbmRpbmcuX21vZGVsLl9tb2RlbCA9PT0gb2JqZWN0KXtcbiAgICAgICAgICAgIHJldHVybiBiaW5kaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgbW9kZWxBdHRhY2hIYW5kbGVyKG9iamVjdCk7XG5cbiAgICAgICAgcmV0dXJuIGJpbmRpbmc7XG4gICAgfTtcblxuICAgIGJpbmRpbmcuZGV0YWNoID0gZnVuY3Rpb24oZmlybSl7XG4gICAgICAgIGlmKGZpcm1lcihiaW5kaW5nLCBmaXJtKSl7XG4gICAgICAgICAgICByZXR1cm4gYmluZGluZztcbiAgICAgICAgfVxuXG4gICAgICAgIGJpbmRpbmdTY29wZS52YWx1ZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgaWYoYmluZGluZy5fbW9kZWwuaXNBdHRhY2hlZCgpKXtcbiAgICAgICAgICAgIGJpbmRpbmcuX21vZGVsLmRldGFjaCgpO1xuICAgICAgICB9XG4gICAgICAgIGJpbmRpbmcuZW1pdCgnZGV0YWNoJywgMSk7XG4gICAgICAgIHJldHVybiBiaW5kaW5nO1xuICAgIH07XG4gICAgYmluZGluZy5fc2V0ID0gZnVuY3Rpb24obmV3VmFsdWUpe1xuICAgICAgICBpZihzYW1lKGJpbmRpbmcuX21vZGVsLmdldChwYXRoKSwgbmV3VmFsdWUpKXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZighYmluZGluZy5fbW9kZWwuaXNBdHRhY2hlZCgpKXtcbiAgICAgICAgICAgIGJpbmRpbmcuX21vZGVsLmF0dGFjaChiaW5kaW5nLl9tb2RlbC5nZXQoJy4nKSk7XG4gICAgICAgIH1cbiAgICAgICAgYmluZGluZy5fbW9kZWwuc2V0KHBhdGgsIG5ld1ZhbHVlKTtcbiAgICB9O1xuICAgIGJpbmRpbmcuX2NoYW5nZSA9IGZ1bmN0aW9uKG5ld1ZhbHVlKXtcbiAgICAgICAgYmluZGluZ1Njb3BlLnZhbHVlID0gbmV3VmFsdWU7XG4gICAgICAgIGJpbmRpbmcuZW1pdCgnY2hhbmdlJywgYmluZGluZygpKTtcbiAgICB9O1xuICAgIGJpbmRpbmcuY2xvbmUgPSBmdW5jdGlvbihrZWVwQXR0YWNobWVudCl7XG4gICAgICAgIHZhciBuZXdCaW5kaW5nID0gY3JlYXRlQmluZGluZy5hcHBseShudWxsLCBiaW5kaW5nLl9hcmd1bWVudHMpO1xuXG4gICAgICAgIGlmKGtlZXBBdHRhY2htZW50KXtcbiAgICAgICAgICAgIG5ld0JpbmRpbmcuYXR0YWNoKGJpbmRpbmdTY29wZS5hdHRhY2hlZE1vZGVsIHx8IGJpbmRpbmcuX21vZGVsLl9tb2RlbCwgYmluZGluZy5fZmlybSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbmV3QmluZGluZztcbiAgICB9O1xuICAgIGJpbmRpbmcuZGVzdHJveSA9IGZ1bmN0aW9uKHNvZnQpe1xuICAgICAgICBpZihkZXN0cm95ZWQpe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmKHNvZnQgJiYgYmluZGluZy5saXN0ZW5lcnMoJ2NoYW5nZScpLmxlbmd0aCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgZGVzdHJveWVkID0gdHJ1ZTtcbiAgICAgICAgYmluZGluZy5lbWl0KCdkZXN0cm95Jyk7XG4gICAgICAgIGJpbmRpbmcuZGV0YWNoKCk7XG4gICAgICAgIGJpbmRpbmcuX21vZGVsLmRlc3Ryb3koKTtcbiAgICB9O1xuXG4gICAgYmluZGluZy5kZXN0cm95ZWQgPSBmdW5jdGlvbigpe1xuICAgICAgICByZXR1cm4gZGVzdHJveWVkO1xuICAgIH07XG5cbiAgICBpZihwYXRoICE9PSAnLicpe1xuICAgICAgICBiaW5kaW5nLl9tb2RlbC5vbihwYXRoLCBiaW5kaW5nLl9jaGFuZ2UpO1xuICAgIH1cblxuICAgIHJldHVybiBiaW5kaW5nO1xufVxuXG5mdW5jdGlvbiBmcm9tKHZhbHVlT3JCaW5kaW5nKXtcbiAgICBpZihpcy5iaW5kaW5nKHZhbHVlT3JCaW5kaW5nKSl7XG4gICAgICAgIHJldHVybiB2YWx1ZU9yQmluZGluZztcbiAgICB9XG5cbiAgICByZXR1cm4gY3JlYXRlQmluZGluZygpKHZhbHVlT3JCaW5kaW5nKTtcbn1cblxuY3JlYXRlQmluZGluZy5mcm9tID0gZnJvbTtcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVCaW5kaW5nOyIsImZ1bmN0aW9uIGluc2VydENoaWxkKGZhc3RuLCBjb250YWluZXIsIGNoaWxkLCBpbmRleCl7XG4gICAgaWYoY2hpbGQgPT0gbnVsbCB8fCBjaGlsZCA9PT0gZmFsc2Upe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGN1cnJlbnRJbmRleCA9IGNvbnRhaW5lci5fY2hpbGRyZW4uaW5kZXhPZihjaGlsZCksXG4gICAgICAgIG5ld0NvbXBvbmVudCA9IGZhc3RuLnRvQ29tcG9uZW50KGNoaWxkKTtcblxuICAgIGlmKG5ld0NvbXBvbmVudCAhPT0gY2hpbGQgJiYgfmN1cnJlbnRJbmRleCl7XG4gICAgICAgIGNvbnRhaW5lci5fY2hpbGRyZW4uc3BsaWNlKGN1cnJlbnRJbmRleCwgMSwgbmV3Q29tcG9uZW50KTtcbiAgICB9XG5cbiAgICBpZighfmN1cnJlbnRJbmRleCB8fCBuZXdDb21wb25lbnQgIT09IGNoaWxkKXtcbiAgICAgICAgbmV3Q29tcG9uZW50LmF0dGFjaChjb250YWluZXIuc2NvcGUoKSwgMSk7XG4gICAgfVxuXG4gICAgaWYoY3VycmVudEluZGV4ICE9PSBpbmRleCl7XG4gICAgICAgIGlmKH5jdXJyZW50SW5kZXgpe1xuICAgICAgICAgICAgY29udGFpbmVyLl9jaGlsZHJlbi5zcGxpY2UoY3VycmVudEluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgICBjb250YWluZXIuX2NoaWxkcmVuLnNwbGljZShpbmRleCwgMCwgbmV3Q29tcG9uZW50KTtcbiAgICB9XG5cbiAgICBpZihjb250YWluZXIuZWxlbWVudCl7XG4gICAgICAgIGlmKCFuZXdDb21wb25lbnQuZWxlbWVudCl7XG4gICAgICAgICAgICBuZXdDb21wb25lbnQucmVuZGVyKCk7XG4gICAgICAgIH1cbiAgICAgICAgY29udGFpbmVyLl9pbnNlcnQobmV3Q29tcG9uZW50LmVsZW1lbnQsIGluZGV4KTtcbiAgICAgICAgbmV3Q29tcG9uZW50LmVtaXQoJ2luc2VydCcsIGNvbnRhaW5lcik7XG4gICAgICAgIGNvbnRhaW5lci5lbWl0KCdjaGlsZEluc2VydCcsIG5ld0NvbXBvbmVudCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDb250YWluZXJFbGVtZW50KCl7XG4gICAgcmV0dXJuIHRoaXMuY29udGFpbmVyRWxlbWVudCB8fCB0aGlzLmVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIGluc2VydChjaGlsZCwgaW5kZXgpe1xuICAgIHZhciBjaGlsZENvbXBvbmVudCA9IGNoaWxkLFxuICAgICAgICBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lcixcbiAgICAgICAgZmFzdG4gPSB0aGlzLmZhc3RuO1xuXG4gICAgaWYoaW5kZXggJiYgdHlwZW9mIGluZGV4ID09PSAnb2JqZWN0Jyl7XG4gICAgICAgIGNoaWxkQ29tcG9uZW50ID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgICB9XG5cbiAgICBpZihpc05hTihpbmRleCkpe1xuICAgICAgICBpbmRleCA9IGNvbnRhaW5lci5fY2hpbGRyZW4ubGVuZ3RoO1xuICAgIH1cblxuICAgIGlmKEFycmF5LmlzQXJyYXkoY2hpbGRDb21wb25lbnQpKXtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZENvbXBvbmVudC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29udGFpbmVyLmluc2VydChjaGlsZENvbXBvbmVudFtpXSwgaSArIGluZGV4KTtcbiAgICAgICAgfVxuICAgIH1lbHNle1xuICAgICAgICBpbnNlcnRDaGlsZChmYXN0biwgY29udGFpbmVyLCBjaGlsZENvbXBvbmVudCwgaW5kZXgpO1xuICAgIH1cblxuICAgIHJldHVybiBjb250YWluZXI7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZmFzdG4sIGNvbXBvbmVudCwgdHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcbiAgICBjb21wb25lbnQuaW5zZXJ0ID0gaW5zZXJ0LmJpbmQoe1xuICAgICAgICBjb250YWluZXI6IGNvbXBvbmVudCxcbiAgICAgICAgZmFzdG46IGZhc3RuXG4gICAgfSk7XG5cbiAgICBjb21wb25lbnQuX2luc2VydCA9IGZ1bmN0aW9uKGVsZW1lbnQsIGluZGV4KXtcbiAgICAgICAgdmFyIGNvbnRhaW5lckVsZW1lbnQgPSBjb21wb25lbnQuZ2V0Q29udGFpbmVyRWxlbWVudCgpO1xuICAgICAgICBpZighY29udGFpbmVyRWxlbWVudCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZihjb250YWluZXJFbGVtZW50LmNoaWxkTm9kZXNbaW5kZXhdID09PSBlbGVtZW50KXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRhaW5lckVsZW1lbnQuaW5zZXJ0QmVmb3JlKGVsZW1lbnQsIGNvbnRhaW5lckVsZW1lbnQuY2hpbGROb2Rlc1tpbmRleF0pO1xuICAgIH07XG5cbiAgICBjb21wb25lbnQucmVtb3ZlID0gZnVuY3Rpb24oY2hpbGRDb21wb25lbnQpe1xuICAgICAgICB2YXIgaW5kZXggPSBjb21wb25lbnQuX2NoaWxkcmVuLmluZGV4T2YoY2hpbGRDb21wb25lbnQpO1xuICAgICAgICBpZih+aW5kZXgpe1xuICAgICAgICAgICAgY29tcG9uZW50Ll9jaGlsZHJlbi5zcGxpY2UoaW5kZXgsMSk7XG4gICAgICAgIH1cblxuICAgICAgICBjaGlsZENvbXBvbmVudC5kZXRhY2goMSk7XG5cbiAgICAgICAgaWYoY2hpbGRDb21wb25lbnQuZWxlbWVudCl7XG4gICAgICAgICAgICBjb21wb25lbnQuX3JlbW92ZShjaGlsZENvbXBvbmVudC5lbGVtZW50KTtcbiAgICAgICAgICAgIGNoaWxkQ29tcG9uZW50LmVtaXQoJ3JlbW92ZScsIGNvbXBvbmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgY29tcG9uZW50LmVtaXQoJ2NoaWxkUmVtb3ZlJywgY2hpbGRDb21wb25lbnQpO1xuICAgIH07XG5cbiAgICBjb21wb25lbnQuX3JlbW92ZSA9IGZ1bmN0aW9uKGVsZW1lbnQpe1xuICAgICAgICB2YXIgY29udGFpbmVyRWxlbWVudCA9IGNvbXBvbmVudC5nZXRDb250YWluZXJFbGVtZW50KCk7XG5cbiAgICAgICAgaWYoIWVsZW1lbnQgfHwgIWNvbnRhaW5lckVsZW1lbnQgfHwgZWxlbWVudC5wYXJlbnROb2RlICE9PSBjb250YWluZXJFbGVtZW50KXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRhaW5lckVsZW1lbnQucmVtb3ZlQ2hpbGQoZWxlbWVudCk7XG4gICAgfTtcblxuICAgIGNvbXBvbmVudC5lbXB0eSA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHdoaWxlKGNvbXBvbmVudC5fY2hpbGRyZW4ubGVuZ3RoKXtcbiAgICAgICAgICAgIGNvbXBvbmVudC5yZW1vdmUoY29tcG9uZW50Ll9jaGlsZHJlbi5wb3AoKSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgY29tcG9uZW50LnJlcGxhY2VDaGlsZCA9IGZ1bmN0aW9uKG9sZENoaWxkLCBuZXdDaGlsZCl7XG4gICAgICAgIHZhciBpbmRleCA9IGNvbXBvbmVudC5fY2hpbGRyZW4uaW5kZXhPZihvbGRDaGlsZCk7XG5cbiAgICAgICAgaWYoIX5pbmRleCl7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb21wb25lbnQucmVtb3ZlKG9sZENoaWxkKTtcbiAgICAgICAgY29tcG9uZW50Lmluc2VydChuZXdDaGlsZCwgaW5kZXgpO1xuICAgIH07XG5cbiAgICBjb21wb25lbnQuZ2V0Q29udGFpbmVyRWxlbWVudCA9IGdldENvbnRhaW5lckVsZW1lbnQuYmluZChjb21wb25lbnQpO1xuXG4gICAgY29tcG9uZW50Lm9uKCdyZW5kZXInLCBjb21wb25lbnQuaW5zZXJ0LmJpbmQobnVsbCwgY29tcG9uZW50Ll9jaGlsZHJlbiwgMCkpO1xuXG4gICAgY29tcG9uZW50Lm9uKCdhdHRhY2gnLCBmdW5jdGlvbihtb2RlbCwgZmlybSl7XG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBjb21wb25lbnQuX2NoaWxkcmVuLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgICAgIGlmKGZhc3RuLmlzQ29tcG9uZW50KGNvbXBvbmVudC5fY2hpbGRyZW5baV0pKXtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuX2NoaWxkcmVuW2ldLmF0dGFjaChtb2RlbCwgZmlybSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbXBvbmVudC5vbignZGVzdHJveScsIGZ1bmN0aW9uKGRhdGEsIGZpcm0pe1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgY29tcG9uZW50Ll9jaGlsZHJlbi5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBpZihmYXN0bi5pc0NvbXBvbmVudChjb21wb25lbnQuX2NoaWxkcmVuW2ldKSl7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50Ll9jaGlsZHJlbltpXS5kZXN0cm95KGZpcm0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gY29tcG9uZW50O1xufTsiLCJ2YXIgc2V0aWZ5ID0gcmVxdWlyZSgnc2V0aWZ5JyksXG4gICAgY2xhc3Npc3QgPSByZXF1aXJlKCdjbGFzc2lzdCcpO1xuXG5mdW5jdGlvbiB1cGRhdGVUZXh0UHJvcGVydHkoZ2VuZXJpYywgZWxlbWVudCwgdmFsdWUpe1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpe1xuICAgICAgICByZXR1cm4gZWxlbWVudC50ZXh0Q29udGVudDtcbiAgICB9XG4gICAgZWxlbWVudC50ZXh0Q29udGVudCA9ICh2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIGNsYXNzOiBmdW5jdGlvbihnZW5lcmljLCBlbGVtZW50LCB2YWx1ZSl7XG4gICAgICAgIGlmKCFnZW5lcmljLl9jbGFzc2lzdCl7XG4gICAgICAgICAgICBnZW5lcmljLl9jbGFzc2lzdCA9IGNsYXNzaXN0KGVsZW1lbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYoYXJndW1lbnRzLmxlbmd0aCA8IDMpe1xuICAgICAgICAgICAgcmV0dXJuIGdlbmVyaWMuX2NsYXNzaXN0KCk7XG4gICAgICAgIH1cblxuICAgICAgICBnZW5lcmljLl9jbGFzc2lzdCh2YWx1ZSk7XG4gICAgfSxcbiAgICBkaXNwbGF5OiBmdW5jdGlvbihnZW5lcmljLCBlbGVtZW50LCB2YWx1ZSl7XG4gICAgICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpe1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuc3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnO1xuICAgICAgICB9XG4gICAgICAgIGVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IHZhbHVlID8gbnVsbCA6ICdub25lJztcbiAgICB9LFxuICAgIGRpc2FibGVkOiBmdW5jdGlvbihnZW5lcmljLCBlbGVtZW50LCB2YWx1ZSl7XG4gICAgICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpe1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQuaGFzQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmKHZhbHVlKXtcbiAgICAgICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsICdkaXNhYmxlZCcpO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIGVsZW1lbnQucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICB0ZXh0Q29udGVudDogdXBkYXRlVGV4dFByb3BlcnR5LFxuICAgIGlubmVyVGV4dDogdXBkYXRlVGV4dFByb3BlcnR5LFxuICAgIGlubmVySFRNTDogZnVuY3Rpb24oZ2VuZXJpYywgZWxlbWVudCwgdmFsdWUpe1xuICAgICAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKXtcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50LmlubmVySFRNTDtcbiAgICAgICAgfVxuICAgICAgICBlbGVtZW50LmlubmVySFRNTCA9ICh2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSk7XG4gICAgfSxcbiAgICB2YWx1ZTogZnVuY3Rpb24oZ2VuZXJpYywgZWxlbWVudCwgdmFsdWUpe1xuICAgICAgICB2YXIgaW5wdXRUeXBlID0gZWxlbWVudC50eXBlO1xuXG4gICAgICAgIGlmKGVsZW1lbnQubm9kZU5hbWUgPT09ICdJTlBVVCcgJiYgaW5wdXRUeXBlID09PSAnZGF0ZScpe1xuICAgICAgICAgICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMil7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQudmFsdWUgPyBuZXcgRGF0ZShlbGVtZW50LnZhbHVlLnJlcGxhY2UoLy0vZywnLycpLnJlcGxhY2UoJ1QnLCcgJykpIDogbnVsbDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZSAhPSBudWxsID8gbmV3IERhdGUodmFsdWUpIDogbnVsbDtcblxuICAgICAgICAgICAgaWYoIXZhbHVlIHx8IGlzTmFOKHZhbHVlKSl7XG4gICAgICAgICAgICAgICAgZWxlbWVudC52YWx1ZSA9IG51bGw7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICBlbGVtZW50LnZhbHVlID0gW1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZS5nZXRGdWxsWWVhcigpLFxuICAgICAgICAgICAgICAgICAgICAoJzAnICsgKHZhbHVlLmdldE1vbnRoKCkgKyAxKSkuc2xpY2UoLTIpLFxuICAgICAgICAgICAgICAgICAgICAoJzAnICsgdmFsdWUuZ2V0RGF0ZSgpKS5zbGljZSgtMilcbiAgICAgICAgICAgICAgICBdLmpvaW4oJy0nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpe1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQudmFsdWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYodmFsdWUgPT09IHVuZGVmaW5lZCl7XG4gICAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZihlbGVtZW50Lm5vZGVOYW1lID09PSAnUFJPR1JFU1MnKXtcbiAgICAgICAgICAgIHZhbHVlID0gcGFyc2VGbG9hdCh2YWx1ZSkgfHwgMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHNldGlmeShlbGVtZW50LCB2YWx1ZSk7XG4gICAgfSxcbiAgICBtYXg6IGZ1bmN0aW9uKGdlbmVyaWMsIGVsZW1lbnQsIHZhbHVlKSB7XG4gICAgICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpe1xuICAgICAgICAgICAgcmV0dXJuIGVsZW1lbnQudmFsdWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZihlbGVtZW50Lm5vZGVOYW1lID09PSAnUFJPR1JFU1MnKXtcbiAgICAgICAgICAgIHZhbHVlID0gcGFyc2VGbG9hdCh2YWx1ZSkgfHwgMDtcbiAgICAgICAgfVxuXG4gICAgICAgIGVsZW1lbnQubWF4ID0gdmFsdWU7XG4gICAgfSxcbiAgICBzdHlsZTogZnVuY3Rpb24oZ2VuZXJpYywgZWxlbWVudCwgdmFsdWUpe1xuICAgICAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKXtcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50LnN0eWxlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yKHZhciBrZXkgaW4gdmFsdWUpe1xuICAgICAgICAgICAgZWxlbWVudC5zdHlsZVtrZXldID0gdmFsdWVba2V5XTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgdHlwZTogZnVuY3Rpb24oZ2VuZXJpYywgZWxlbWVudCwgdmFsdWUpe1xuICAgICAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKXtcbiAgICAgICAgICAgIHJldHVybiBlbGVtZW50LnR5cGU7XG4gICAgICAgIH1cbiAgICAgICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCB2YWx1ZSk7XG4gICAgfVxufTsiLCIvLyBJcyB0aGUgZW50aXR5IGZpcm1lciB0aGFuIHRoZSBuZXcgZmlybW5lc3Ncbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZW50aXR5LCBmaXJtKXtcbiAgICBpZihmaXJtICE9IG51bGwgJiYgKGVudGl0eS5fZmlybSA9PT0gdW5kZWZpbmVkIHx8IGZpcm0gPCBlbnRpdHkuX2Zpcm0pKXtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxufTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnRzJykuRXZlbnRFbWl0dGVyLFxuICAgIGZ1bmN0aW9uRW1pdHRlclByb3RvdHlwZSA9IGZ1bmN0aW9uKCl7fTtcblxuZm9yKHZhciBrZXkgaW4gRXZlbnRFbWl0dGVyLnByb3RvdHlwZSl7XG4gICAgZnVuY3Rpb25FbWl0dGVyUHJvdG90eXBlW2tleV0gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlW2tleV07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb25FbWl0dGVyUHJvdG90eXBlOyIsInZhciBjb250YWluZXJDb21wb25lbnQgPSByZXF1aXJlKCcuL2NvbnRhaW5lckNvbXBvbmVudCcpLFxuICAgIHNjaGVkdWxlID0gcmVxdWlyZSgnLi9zY2hlZHVsZScpLFxuICAgIGZhbmN5UHJvcHMgPSByZXF1aXJlKCcuL2ZhbmN5UHJvcHMnKSxcbiAgICBtYXRjaERvbUhhbmRsZXJOYW1lID0gL14oKD86ZWxcXC4pPykoW14uIF0rKSg/OlxcLihjYXB0dXJlKSk/JC8sXG4gICAgR0VORVJJQyA9ICdfZ2VuZXJpYyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZVByb3BlcnRpZXMoZmFzdG4sIGNvbXBvbmVudCwgc2V0dGluZ3Mpe1xuICAgIGZvcih2YXIga2V5IGluIHNldHRpbmdzKXtcbiAgICAgICAgdmFyIHNldHRpbmcgPSBzZXR0aW5nc1trZXldO1xuXG4gICAgICAgIGlmKHR5cGVvZiBzZXR0aW5nID09PSAnZnVuY3Rpb24nICYmICFmYXN0bi5pc1Byb3BlcnR5KHNldHRpbmcpICYmICFmYXN0bi5pc0JpbmRpbmcoc2V0dGluZykpe1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb21wb25lbnQuYWRkRG9tUHJvcGVydHkoa2V5KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGFkZERvbUhhbmRsZXIoY29tcG9uZW50LCBlbGVtZW50LCBoYW5kbGVyTmFtZSwgZXZlbnROYW1lLCBjYXB0dXJlKXtcbiAgICB2YXIgZXZlbnRQYXJ0cyA9IGhhbmRsZXJOYW1lLnNwbGl0KCcuJyk7XG5cbiAgICBpZihldmVudFBhcnRzWzBdID09PSAnb24nKXtcbiAgICAgICAgZXZlbnRQYXJ0cy5zaGlmdCgpO1xuICAgIH1cblxuICAgIHZhciBoYW5kbGVyID0gZnVuY3Rpb24oZXZlbnQpe1xuICAgICAgICAgICAgY29tcG9uZW50LmVtaXQoaGFuZGxlck5hbWUsIGV2ZW50LCBjb21wb25lbnQuc2NvcGUoKSk7XG4gICAgICAgIH07XG5cbiAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBoYW5kbGVyLCBjYXB0dXJlKTtcblxuICAgIGNvbXBvbmVudC5vbignZGVzdHJveScsIGZ1bmN0aW9uKCl7XG4gICAgICAgIGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudE5hbWUsIGhhbmRsZXIsIGNhcHR1cmUpO1xuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBhZGREb21IYW5kbGVycyhjb21wb25lbnQsIGVsZW1lbnQsIGV2ZW50TmFtZXMpe1xuICAgIHZhciBldmVudHMgPSBldmVudE5hbWVzLnNwbGl0KCcgJyk7XG5cbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgZXZlbnRzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgdmFyIGV2ZW50TmFtZSA9IGV2ZW50c1tpXSxcbiAgICAgICAgICAgIG1hdGNoID0gZXZlbnROYW1lLm1hdGNoKG1hdGNoRG9tSGFuZGxlck5hbWUpO1xuXG4gICAgICAgIGlmKCFtYXRjaCl7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKG1hdGNoWzFdIHx8ICdvbicgKyBtYXRjaFsyXSBpbiBlbGVtZW50KXtcbiAgICAgICAgICAgIGFkZERvbUhhbmRsZXIoY29tcG9uZW50LCBlbGVtZW50LCBldmVudE5hbWVzLCBtYXRjaFsyXSwgbWF0Y2hbM10pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhZGRBdXRvSGFuZGxlcihjb21wb25lbnQsIGVsZW1lbnQsIGtleSwgc2V0dGluZ3Mpe1xuICAgIGlmKCFzZXR0aW5nc1trZXldKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBhdXRvRXZlbnQgPSBzZXR0aW5nc1trZXldLnNwbGl0KCc6JyksXG4gICAgICAgIGV2ZW50TmFtZSA9IGtleS5zbGljZSgyKTtcblxuICAgIGRlbGV0ZSBzZXR0aW5nc1trZXldO1xuXG4gICAgdmFyIGhhbmRsZXIgPSBmdW5jdGlvbihldmVudCl7XG4gICAgICAgIHZhciBmYW5jeVByb3AgPSBmYW5jeVByb3BzW2F1dG9FdmVudFsxXV0sXG4gICAgICAgICAgICB2YWx1ZSA9IGZhbmN5UHJvcCA/IGZhbmN5UHJvcChjb21wb25lbnQsIGVsZW1lbnQpIDogZWxlbWVudFthdXRvRXZlbnRbMV1dO1xuXG4gICAgICAgIGNvbXBvbmVudFthdXRvRXZlbnRbMF1dKHZhbHVlKTtcbiAgICB9O1xuXG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50TmFtZSwgaGFuZGxlcik7XG5cbiAgICBjb21wb25lbnQub24oJ2Rlc3Ryb3knLCBmdW5jdGlvbigpe1xuICAgICAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnROYW1lLCBoYW5kbGVyKTtcbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gYWRkRG9tUHJvcGVydHkoZmFzdG4sIGtleSwgcHJvcGVydHkpe1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzO1xuXG4gICAgcHJvcGVydHkgPSBwcm9wZXJ0eSB8fCBjb21wb25lbnRba2V5XSB8fCBmYXN0bi5wcm9wZXJ0eSgpO1xuICAgIGNvbXBvbmVudC5zZXRQcm9wZXJ0eShrZXksIHByb3BlcnR5KTtcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZSgpe1xuICAgICAgICB2YXIgZWxlbWVudCA9IGNvbXBvbmVudC5nZXRQcm9wZXJ0eUVsZW1lbnQoa2V5KSxcbiAgICAgICAgICAgIHZhbHVlID0gcHJvcGVydHkoKTtcblxuICAgICAgICBpZighZWxlbWVudCB8fCBjb21wb25lbnQuZGVzdHJveWVkKCkpe1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGlzUHJvcGVydHkgPSBrZXkgaW4gZWxlbWVudCxcbiAgICAgICAgICAgIGZhbmN5UHJvcCA9IGZhbmN5UHJvcHNba2V5XSxcbiAgICAgICAgICAgIHByZXZpb3VzID0gZmFuY3lQcm9wID8gZmFuY3lQcm9wKGNvbXBvbmVudCwgZWxlbWVudCkgOiBpc1Byb3BlcnR5ID8gZWxlbWVudFtrZXldIDogZWxlbWVudC5nZXRBdHRyaWJ1dGUoa2V5KTtcblxuICAgICAgICBpZighZmFuY3lQcm9wICYmICFpc1Byb3BlcnR5ICYmIHZhbHVlID09IG51bGwpe1xuICAgICAgICAgICAgdmFsdWUgPSAnJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHZhbHVlICE9PSBwcmV2aW91cyl7XG4gICAgICAgICAgICBpZihmYW5jeVByb3Ape1xuICAgICAgICAgICAgICAgIGZhbmN5UHJvcChjb21wb25lbnQsIGVsZW1lbnQsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKGlzUHJvcGVydHkpe1xuICAgICAgICAgICAgICAgIGVsZW1lbnRba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYodHlwZW9mIHZhbHVlICE9PSAnZnVuY3Rpb24nICYmIHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpe1xuICAgICAgICAgICAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKGtleSwgdmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJvcGVydHkudXBkYXRlcih1cGRhdGUpO1xufVxuXG5mdW5jdGlvbiBvblJlbmRlcigpe1xuICAgIHZhciBjb21wb25lbnQgPSB0aGlzLFxuICAgICAgICBlbGVtZW50O1xuXG4gICAgZm9yKHZhciBrZXkgaW4gY29tcG9uZW50Ll9zZXR0aW5ncyl7XG4gICAgICAgIGVsZW1lbnQgPSBjb21wb25lbnQuZ2V0RXZlbnRFbGVtZW50KGtleSk7XG4gICAgICAgIGlmKGtleS5zbGljZSgwLDIpID09PSAnb24nICYmIGtleSBpbiBlbGVtZW50KXtcbiAgICAgICAgICAgIGFkZEF1dG9IYW5kbGVyKGNvbXBvbmVudCwgZWxlbWVudCwga2V5LCBjb21wb25lbnQuX3NldHRpbmdzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvcih2YXIgZXZlbnRLZXkgaW4gY29tcG9uZW50Ll9ldmVudHMpe1xuICAgICAgICBlbGVtZW50ID0gY29tcG9uZW50LmdldEV2ZW50RWxlbWVudChrZXkpO1xuICAgICAgICBhZGREb21IYW5kbGVycyhjb21wb25lbnQsIGVsZW1lbnQsIGV2ZW50S2V5KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbmRlcigpe1xuICAgIHRoaXMuZWxlbWVudCA9IHRoaXMuY3JlYXRlRWxlbWVudCh0aGlzLl9zZXR0aW5ncy50YWdOYW1lIHx8IHRoaXMuX3RhZ05hbWUpO1xuXG4gICAgdGhpcy5lbWl0KCdyZW5kZXInKTtcblxuICAgIHJldHVybiB0aGlzO1xufTtcblxuZnVuY3Rpb24gZ2VuZXJpY0NvbXBvbmVudChmYXN0biwgY29tcG9uZW50LCB0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pe1xuICAgIGlmKGNvbXBvbmVudC5pcyh0eXBlKSl7XG4gICAgICAgIHJldHVybiBjb21wb25lbnQ7XG4gICAgfVxuXG4gICAgaWYodHlwZSA9PT0gR0VORVJJQyl7XG4gICAgICAgIGNvbXBvbmVudC5fdGFnTmFtZSA9IGNvbXBvbmVudC5fdGFnTmFtZSB8fCAnZGl2JztcbiAgICB9ZWxzZXtcbiAgICAgICAgY29tcG9uZW50Ll90YWdOYW1lID0gdHlwZTtcbiAgICB9XG5cbiAgICBpZihjb21wb25lbnQuaXMoR0VORVJJQykpe1xuICAgICAgICByZXR1cm4gY29tcG9uZW50O1xuICAgIH1cblxuICAgIGNvbXBvbmVudC5leHRlbmQoJ19jb250YWluZXInLCBzZXR0aW5ncywgY2hpbGRyZW4pO1xuXG4gICAgY29tcG9uZW50LmFkZERvbVByb3BlcnR5ID0gYWRkRG9tUHJvcGVydHkuYmluZChjb21wb25lbnQsIGZhc3RuKTtcbiAgICBjb21wb25lbnQuZ2V0RXZlbnRFbGVtZW50ID0gY29tcG9uZW50LmdldENvbnRhaW5lckVsZW1lbnQ7XG4gICAgY29tcG9uZW50LmdldFByb3BlcnR5RWxlbWVudCA9IGNvbXBvbmVudC5nZXRDb250YWluZXJFbGVtZW50O1xuICAgIGNvbXBvbmVudC51cGRhdGVQcm9wZXJ0eSA9IGdlbmVyaWNDb21wb25lbnQudXBkYXRlUHJvcGVydHk7XG4gICAgY29tcG9uZW50LmNyZWF0ZUVsZW1lbnQgPSBnZW5lcmljQ29tcG9uZW50LmNyZWF0ZUVsZW1lbnQ7XG5cbiAgICBjcmVhdGVQcm9wZXJ0aWVzKGZhc3RuLCBjb21wb25lbnQsIHNldHRpbmdzKTtcblxuICAgIGNvbXBvbmVudC5yZW5kZXIgPSByZW5kZXIuYmluZChjb21wb25lbnQpO1xuXG4gICAgY29tcG9uZW50Lm9uKCdyZW5kZXInLCBvblJlbmRlcik7XG5cbiAgICByZXR1cm4gY29tcG9uZW50O1xufVxuXG5nZW5lcmljQ29tcG9uZW50LnVwZGF0ZVByb3BlcnR5ID0gZnVuY3Rpb24oY29tcG9uZW50LCBwcm9wZXJ0eSwgdXBkYXRlKXtcbiAgICBpZih0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50LmNvbnRhaW5zKGNvbXBvbmVudC5lbGVtZW50KSl7XG4gICAgICAgIHNjaGVkdWxlKHByb3BlcnR5LCB1cGRhdGUpO1xuICAgIH1lbHNle1xuICAgICAgICB1cGRhdGUoKTtcbiAgICB9XG59O1xuXG5nZW5lcmljQ29tcG9uZW50LmNyZWF0ZUVsZW1lbnQgPSBmdW5jdGlvbih0YWdOYW1lKXtcbiAgICBpZih0YWdOYW1lIGluc3RhbmNlb2YgTm9kZSl7XG4gICAgICAgIHJldHVybiB0YWdOYW1lO1xuICAgIH1cbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZ2VuZXJpY0NvbXBvbmVudDsiLCJ2YXIgY3JlYXRlUHJvcGVydHkgPSByZXF1aXJlKCcuL3Byb3BlcnR5JyksXG4gICAgY3JlYXRlQmluZGluZyA9IHJlcXVpcmUoJy4vYmluZGluZycpLFxuICAgIEJhc2VDb21wb25lbnQgPSByZXF1aXJlKCcuL2Jhc2VDb21wb25lbnQnKSxcbiAgICBjcmVsID0gcmVxdWlyZSgnY3JlbCcpLFxuICAgIEVudGkgPSByZXF1aXJlKCdlbnRpJyksXG4gICAgb2JqZWN0QXNzaWduID0gcmVxdWlyZSgnb2JqZWN0LWFzc2lnbicpLFxuICAgIGlzID0gcmVxdWlyZSgnLi9pcycpO1xuXG5mdW5jdGlvbiBpbmZsYXRlUHJvcGVydGllcyhjb21wb25lbnQsIHNldHRpbmdzKXtcbiAgICBmb3IodmFyIGtleSBpbiBzZXR0aW5ncyl7XG4gICAgICAgIHZhciBzZXR0aW5nID0gc2V0dGluZ3Nba2V5XSxcbiAgICAgICAgICAgIHByb3BlcnR5ID0gY29tcG9uZW50W2tleV07XG5cbiAgICAgICAgaWYoaXMucHJvcGVydHkoc2V0dGluZ3Nba2V5XSkpe1xuXG4gICAgICAgICAgICBpZihpcy5wcm9wZXJ0eShwcm9wZXJ0eSkpe1xuICAgICAgICAgICAgICAgIHByb3BlcnR5LmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc2V0dGluZy5hZGRUbyhjb21wb25lbnQsIGtleSk7XG5cbiAgICAgICAgfWVsc2UgaWYoaXMucHJvcGVydHkocHJvcGVydHkpKXtcblxuICAgICAgICAgICAgaWYoaXMuYmluZGluZyhzZXR0aW5nKSl7XG4gICAgICAgICAgICAgICAgcHJvcGVydHkuYmluZGluZyhzZXR0aW5nKTtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIHByb3BlcnR5KHNldHRpbmcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBwcm9wZXJ0eS5hZGRUbyhjb21wb25lbnQsIGtleSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlRXhwZWN0ZWRDb21wb25lbnRzKGNvbXBvbmVudHMsIGNvbXBvbmVudE5hbWUsIGV4cGVjdGVkQ29tcG9uZW50cyl7XG4gICAgZXhwZWN0ZWRDb21wb25lbnRzID0gZXhwZWN0ZWRDb21wb25lbnRzLmZpbHRlcihmdW5jdGlvbihjb21wb25lbnROYW1lKXtcbiAgICAgICAgcmV0dXJuICEoY29tcG9uZW50TmFtZSBpbiBjb21wb25lbnRzKTtcbiAgICB9KTtcblxuICAgIGlmKGV4cGVjdGVkQ29tcG9uZW50cy5sZW5ndGgpe1xuICAgICAgICBjb25zb2xlLndhcm4oW1xuICAgICAgICAgICAgJ2Zhc3RuKFwiJyArIGNvbXBvbmVudE5hbWUgKyAnXCIpIHVzZXMgc29tZSBjb21wb25lbnRzIHRoYXQgaGF2ZSBub3QgYmVlbiByZWdpc3RlcmVkIHdpdGggZmFzdG4nLFxuICAgICAgICAgICAgJ0V4cGVjdGVkIGNvbnBvbmVudCBjb25zdHJ1Y3RvcnM6ICcgKyBleHBlY3RlZENvbXBvbmVudHMuam9pbignLCAnKVxuICAgICAgICBdLmpvaW4oJ1xcblxcbicpKTtcbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oY29tcG9uZW50cywgZGVidWcpe1xuXG4gICAgaWYoIWNvbXBvbmVudHMgfHwgdHlwZW9mIGNvbXBvbmVudHMgIT09ICdvYmplY3QnKXtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdmYXN0biBtdXN0IGJlIGluaXRpYWxpc2VkIHdpdGggYSBjb21wb25lbnRzIG9iamVjdCcpO1xuICAgIH1cblxuICAgIGNvbXBvbmVudHMuX2NvbnRhaW5lciA9IGNvbXBvbmVudHMuX2NvbnRhaW5lciB8fCByZXF1aXJlKCcuL2NvbnRhaW5lckNvbXBvbmVudCcpO1xuXG4gICAgZnVuY3Rpb24gZmFzdG4odHlwZSl7XG5cbiAgICAgICAgdmFyIGFyZ3MgPSBbXTtcbiAgICAgICAgZm9yKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKyl7XG4gICAgICAgICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHNldHRpbmdzID0gYXJnc1sxXSxcbiAgICAgICAgICAgIGNoaWxkcmVuSW5kZXggPSAyLFxuICAgICAgICAgICAgc2V0dGluZ3NDaGlsZCA9IGZhc3RuLnRvQ29tcG9uZW50KGFyZ3NbMV0pO1xuXG4gICAgICAgIGlmKEFycmF5LmlzQXJyYXkoYXJnc1sxXSkgfHwgc2V0dGluZ3NDaGlsZCB8fCAhYXJnc1sxXSl7XG4gICAgICAgICAgICBhcmdzWzFdID0gc2V0dGluZ3NDaGlsZCB8fCBhcmdzWzFdO1xuICAgICAgICAgICAgY2hpbGRyZW5JbmRleC0tO1xuICAgICAgICAgICAgc2V0dGluZ3MgPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgc2V0dGluZ3MgPSBvYmplY3RBc3NpZ24oe30sIHNldHRpbmdzIHx8IHt9KTtcblxuICAgICAgICB2YXIgdHlwZXMgPSB0eXBlb2YgdHlwZSA9PT0gJ3N0cmluZycgPyB0eXBlLnNwbGl0KCc6JykgOiBBcnJheS5pc0FycmF5KHR5cGUpID8gdHlwZSA6IFt0eXBlXSxcbiAgICAgICAgICAgIGJhc2VUeXBlLFxuICAgICAgICAgICAgY2hpbGRyZW4gPSBhcmdzLnNsaWNlKGNoaWxkcmVuSW5kZXgpLFxuICAgICAgICAgICAgY29tcG9uZW50ID0gZmFzdG4uYmFzZSh0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pO1xuXG4gICAgICAgIHdoaWxlKGJhc2VUeXBlID0gdHlwZXMuc2hpZnQoKSl7XG4gICAgICAgICAgICBjb21wb25lbnQuZXh0ZW5kKGJhc2VUeXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29tcG9uZW50Ll9wcm9wZXJ0aWVzID0ge307XG5cbiAgICAgICAgaW5mbGF0ZVByb3BlcnRpZXMoY29tcG9uZW50LCBzZXR0aW5ncyk7XG5cbiAgICAgICAgcmV0dXJuIGNvbXBvbmVudDtcbiAgICB9XG5cbiAgICBmYXN0bi50b0NvbXBvbmVudCA9IGZ1bmN0aW9uKGNvbXBvbmVudCl7XG4gICAgICAgIGlmKGNvbXBvbmVudCA9PSBudWxsKXtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZihpcy5jb21wb25lbnQoY29tcG9uZW50KSl7XG4gICAgICAgICAgICByZXR1cm4gY29tcG9uZW50O1xuICAgICAgICB9XG4gICAgICAgIGlmKHR5cGVvZiBjb21wb25lbnQgIT09ICdvYmplY3QnIHx8IGNvbXBvbmVudCBpbnN0YW5jZW9mIERhdGUpe1xuICAgICAgICAgICAgcmV0dXJuIGZhc3RuKCd0ZXh0Jywge2F1dG86IHRydWV9LCBjb21wb25lbnQpO1xuICAgICAgICB9XG4gICAgICAgIGlmKGNyZWwuaXNFbGVtZW50KGNvbXBvbmVudCkpe1xuICAgICAgICAgICAgcmV0dXJuIGZhc3RuKGNvbXBvbmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYoY3JlbC5pc05vZGUoY29tcG9uZW50KSl7XG4gICAgICAgICAgICByZXR1cm4gZmFzdG4oJ3RleHQnLCB7YXV0bzogdHJ1ZX0sIGNvbXBvbmVudC50ZXh0Q29udGVudCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgZmFzdG4uZGVidWcgPSBkZWJ1ZztcbiAgICBmYXN0bi5wcm9wZXJ0eSA9IGNyZWF0ZVByb3BlcnR5O1xuICAgIGZhc3RuLmJpbmRpbmcgPSBjcmVhdGVCaW5kaW5nO1xuICAgIGZhc3RuLmlzQ29tcG9uZW50ID0gaXMuY29tcG9uZW50O1xuICAgIGZhc3RuLmlzQmluZGluZyA9IGlzLmJpbmRpbmc7XG4gICAgZmFzdG4uaXNEZWZhdWx0QmluZGluZyA9IGlzLmRlZmF1bHRCaW5kaW5nO1xuICAgIGZhc3RuLmlzQmluZGluZ09iamVjdCA9IGlzLmJpbmRpbmdPYmplY3Q7XG4gICAgZmFzdG4uaXNQcm9wZXJ0eSA9IGlzLnByb3BlcnR5O1xuICAgIGZhc3RuLmNvbXBvbmVudHMgPSBjb21wb25lbnRzO1xuICAgIGZhc3RuLk1vZGVsID0gRW50aTtcblxuICAgIGZhc3RuLmJhc2UgPSBmdW5jdGlvbih0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pe1xuICAgICAgICByZXR1cm4gbmV3IEJhc2VDb21wb25lbnQoZmFzdG4sIHR5cGUsIHNldHRpbmdzLCBjaGlsZHJlbik7XG4gICAgfTtcblxuICAgIGZvcih2YXIga2V5IGluIGNvbXBvbmVudHMpe1xuICAgICAgICB2YXIgY29tcG9uZW50Q29uc3RydWN0b3IgPSBjb21wb25lbnRzW2tleV07XG5cbiAgICAgICAgaWYoY29tcG9uZW50Q29uc3RydWN0b3IuZXhwZWN0ZWRDb21wb25lbnRzKXtcbiAgICAgICAgICAgIHZhbGlkYXRlRXhwZWN0ZWRDb21wb25lbnRzKGNvbXBvbmVudHMsIGtleSwgY29tcG9uZW50Q29uc3RydWN0b3IuZXhwZWN0ZWRDb21wb25lbnRzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYXN0bjtcbn07IiwidmFyIEZVTkNUSU9OID0gJ2Z1bmN0aW9uJyxcbiAgICBPQkpFQ1QgPSAnb2JqZWN0JyxcbiAgICBGQVNUTkJJTkRJTkcgPSAnX2Zhc3RuX2JpbmRpbmcnLFxuICAgIEZBU1ROUFJPUEVSVFkgPSAnX2Zhc3RuX3Byb3BlcnR5JyxcbiAgICBGQVNUTkNPTVBPTkVOVCA9ICdfZmFzdG5fY29tcG9uZW50JyxcbiAgICBERUZBVUxUQklORElORyA9ICdfZGVmYXVsdF9iaW5kaW5nJztcblxuZnVuY3Rpb24gaXNDb21wb25lbnQodGhpbmcpe1xuICAgIHJldHVybiB0aGluZyAmJiB0eXBlb2YgdGhpbmcgPT09IE9CSkVDVCAmJiBGQVNUTkNPTVBPTkVOVCBpbiB0aGluZztcbn1cblxuZnVuY3Rpb24gaXNCaW5kaW5nT2JqZWN0KHRoaW5nKXtcbiAgICByZXR1cm4gdGhpbmcgJiYgdHlwZW9mIHRoaW5nID09PSBPQkpFQ1QgJiYgRkFTVE5CSU5ESU5HIGluIHRoaW5nO1xufVxuXG5mdW5jdGlvbiBpc0JpbmRpbmcodGhpbmcpe1xuICAgIHJldHVybiB0eXBlb2YgdGhpbmcgPT09IEZVTkNUSU9OICYmIEZBU1ROQklORElORyBpbiB0aGluZztcbn1cblxuZnVuY3Rpb24gaXNQcm9wZXJ0eSh0aGluZyl7XG4gICAgcmV0dXJuIHR5cGVvZiB0aGluZyA9PT0gRlVOQ1RJT04gJiYgRkFTVE5QUk9QRVJUWSBpbiB0aGluZztcbn1cblxuZnVuY3Rpb24gaXNEZWZhdWx0QmluZGluZyh0aGluZyl7XG4gICAgcmV0dXJuIHR5cGVvZiB0aGluZyA9PT0gRlVOQ1RJT04gJiYgRkFTVE5CSU5ESU5HIGluIHRoaW5nICYmIERFRkFVTFRCSU5ESU5HIGluIHRoaW5nO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBjb21wb25lbnQ6IGlzQ29tcG9uZW50LFxuICAgIGJpbmRpbmdPYmplY3Q6IGlzQmluZGluZ09iamVjdCxcbiAgICBiaW5kaW5nOiBpc0JpbmRpbmcsXG4gICAgZGVmYXVsdEJpbmRpbmc6IGlzRGVmYXVsdEJpbmRpbmcsXG4gICAgcHJvcGVydHk6IGlzUHJvcGVydHlcbn07IiwidmFyIE11bHRpTWFwID0gcmVxdWlyZSgnbXVsdGltYXAnKSxcbiAgICBtZXJnZSA9IHJlcXVpcmUoJ2ZsYXQtbWVyZ2UnKTtcblxuTXVsdGlNYXAuTWFwID0gTWFwO1xuXG5mdW5jdGlvbiBlYWNoKHZhbHVlLCBmbil7XG4gICAgaWYoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYoQXJyYXkuaXNBcnJheSh2YWx1ZSkpe1xuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgZm4odmFsdWVbaV0sIGkpXG4gICAgICAgIH1cbiAgICB9ZWxzZXtcbiAgICAgICAgZm9yKHZhciBrZXkgaW4gdmFsdWUpe1xuICAgICAgICAgICAgZm4odmFsdWVba2V5XSwga2V5KTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24ga2V5Rm9yKG9iamVjdCwgdmFsdWUpe1xuICAgIGlmKCFvYmplY3QgfHwgdHlwZW9mIG9iamVjdCAhPT0gJ29iamVjdCcpe1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYoQXJyYXkuaXNBcnJheShvYmplY3QpKXtcbiAgICAgICAgdmFyIGluZGV4ID0gb2JqZWN0LmluZGV4T2YodmFsdWUpO1xuICAgICAgICByZXR1cm4gaW5kZXggPj0wID8gaW5kZXggOiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IodmFyIGtleSBpbiBvYmplY3Qpe1xuICAgICAgICBpZihvYmplY3Rba2V5XSA9PT0gdmFsdWUpe1xuICAgICAgICAgICAgcmV0dXJuIGtleTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihmYXN0biwgY29tcG9uZW50LCB0eXBlLCBzZXR0aW5ncywgY2hpbGRyZW4pe1xuXG4gICAgaWYoZmFzdG4uY29tcG9uZW50cy5fZ2VuZXJpYyl7XG4gICAgICAgIGNvbXBvbmVudC5leHRlbmQoJ19nZW5lcmljJywgc2V0dGluZ3MsIGNoaWxkcmVuKTtcbiAgICB9ZWxzZXtcbiAgICAgICAgY29tcG9uZW50LmV4dGVuZCgnX2NvbnRhaW5lcicsIHNldHRpbmdzLCBjaGlsZHJlbik7XG4gICAgfVxuXG4gICAgaWYoISgndGVtcGxhdGUnIGluIHNldHRpbmdzKSl7XG4gICAgICAgIGNvbnNvbGUud2FybignTm8gXCJ0ZW1wbGF0ZVwiIGZ1bmN0aW9uIHdhcyBzZXQgZm9yIHRoaXMgdGVtcGxhdGVyIGNvbXBvbmVudCcpO1xuICAgIH1cblxuICAgIHZhciBpdGVtc01hcCA9IG5ldyBNdWx0aU1hcCgpLFxuICAgICAgICBkYXRhTWFwID0gbmV3IFdlYWtNYXAoKSxcbiAgICAgICAgbGFzdFRlbXBsYXRlLFxuICAgICAgICBleGlzdGluZ0l0ZW0gPSB7fTtcblxuICAgIGZ1bmN0aW9uIHVwZGF0ZUl0ZW1zKCl7XG4gICAgICAgIHZhciB2YWx1ZSA9IGNvbXBvbmVudC5pdGVtcygpLFxuICAgICAgICAgICAgdGVtcGxhdGUgPSBjb21wb25lbnQudGVtcGxhdGUoKSxcbiAgICAgICAgICAgIGVtcHR5VGVtcGxhdGUgPSBjb21wb25lbnQuZW1wdHlUZW1wbGF0ZSgpLFxuICAgICAgICAgICAgbmV3VGVtcGxhdGUgPSBsYXN0VGVtcGxhdGUgIT09IHRlbXBsYXRlO1xuXG4gICAgICAgIHZhciBjdXJyZW50SXRlbXMgPSBtZXJnZSh0ZW1wbGF0ZSA/IHZhbHVlIDogW10pO1xuXG4gICAgICAgIGl0ZW1zTWFwLmZvckVhY2goZnVuY3Rpb24oY2hpbGRDb21wb25lbnQsIGl0ZW0pe1xuICAgICAgICAgICAgdmFyIGN1cnJlbnRLZXkgPSBrZXlGb3IoY3VycmVudEl0ZW1zLCBpdGVtKTtcblxuICAgICAgICAgICAgaWYoIW5ld1RlbXBsYXRlICYmIGN1cnJlbnRLZXkgIT09IGZhbHNlKXtcbiAgICAgICAgICAgICAgICBjdXJyZW50SXRlbXNbY3VycmVudEtleV0gPSBbZXhpc3RpbmdJdGVtLCBpdGVtLCBjaGlsZENvbXBvbmVudF07XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICByZW1vdmVDb21wb25lbnQoY2hpbGRDb21wb25lbnQpO1xuICAgICAgICAgICAgICAgIGl0ZW1zTWFwLmRlbGV0ZShpdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmFyIGluZGV4ID0gMDtcblxuICAgICAgICBmdW5jdGlvbiB1cGRhdGVJdGVtKGl0ZW0sIGtleSl7XG4gICAgICAgICAgICB2YXIgY2hpbGQsXG4gICAgICAgICAgICAgICAgZXhpc3Rpbmc7XG5cbiAgICAgICAgICAgIHdoaWxlKGluZGV4IDwgY29tcG9uZW50Ll9jaGlsZHJlbi5sZW5ndGggJiYgIWNvbXBvbmVudC5fY2hpbGRyZW5baW5kZXhdLl90ZW1wbGF0ZWQpe1xuICAgICAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKEFycmF5LmlzQXJyYXkoaXRlbSkgJiYgaXRlbVswXSA9PT0gZXhpc3RpbmdJdGVtKXtcbiAgICAgICAgICAgICAgICBleGlzdGluZyA9IHRydWU7XG4gICAgICAgICAgICAgICAgY2hpbGQgPSBpdGVtWzJdO1xuICAgICAgICAgICAgICAgIGl0ZW0gPSBpdGVtWzFdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY2hpbGRNb2RlbDtcblxuICAgICAgICAgICAgaWYoIWV4aXN0aW5nKXtcbiAgICAgICAgICAgICAgICBjaGlsZE1vZGVsID0gbmV3IGZhc3RuLk1vZGVsKHtcbiAgICAgICAgICAgICAgICAgICAgaXRlbTogaXRlbSxcbiAgICAgICAgICAgICAgICAgICAga2V5OiBrZXlcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGNoaWxkID0gZmFzdG4udG9Db21wb25lbnQodGVtcGxhdGUoY2hpbGRNb2RlbCwgY29tcG9uZW50LnNjb3BlKCkpKTtcbiAgICAgICAgICAgICAgICBpZighY2hpbGQpe1xuICAgICAgICAgICAgICAgICAgICBjaGlsZCA9IGZhc3RuKCd0ZW1wbGF0ZScpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjaGlsZC5fbGlzdEl0ZW0gPSBpdGVtO1xuICAgICAgICAgICAgICAgIGNoaWxkLl90ZW1wbGF0ZWQgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgZGF0YU1hcC5zZXQoY2hpbGQsIGNoaWxkTW9kZWwpO1xuICAgICAgICAgICAgICAgIGl0ZW1zTWFwLnNldChpdGVtLCBjaGlsZCk7XG4gICAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgICAgICBjaGlsZE1vZGVsID0gZGF0YU1hcC5nZXQoY2hpbGQpO1xuICAgICAgICAgICAgICAgIGNoaWxkTW9kZWwuc2V0KCdrZXknLCBrZXkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZihmYXN0bi5pc0NvbXBvbmVudChjaGlsZCkgJiYgY29tcG9uZW50Ll9zZXR0aW5ncy5hdHRhY2hUZW1wbGF0ZXMgIT09IGZhbHNlKXtcbiAgICAgICAgICAgICAgICBjaGlsZC5hdHRhY2goY2hpbGRNb2RlbCwgMik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbXBvbmVudC5pbnNlcnQoY2hpbGQsIGluZGV4KTtcbiAgICAgICAgICAgIGluZGV4Kys7XG4gICAgICAgIH1cblxuICAgICAgICBlYWNoKGN1cnJlbnRJdGVtcywgdXBkYXRlSXRlbSk7XG5cbiAgICAgICAgbGFzdFRlbXBsYXRlID0gdGVtcGxhdGU7XG5cbiAgICAgICAgaWYoaW5kZXggPT09IDAgJiYgZW1wdHlUZW1wbGF0ZSl7XG4gICAgICAgICAgICB2YXIgY2hpbGQgPSBmYXN0bi50b0NvbXBvbmVudChlbXB0eVRlbXBsYXRlKGNvbXBvbmVudC5zY29wZSgpKSk7XG4gICAgICAgICAgICBpZighY2hpbGQpe1xuICAgICAgICAgICAgICAgIGNoaWxkID0gZmFzdG4oJ3RlbXBsYXRlJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjaGlsZC5fdGVtcGxhdGVkID0gdHJ1ZTtcblxuICAgICAgICAgICAgaXRlbXNNYXAuc2V0KHt9LCBjaGlsZCk7XG5cbiAgICAgICAgICAgIGNvbXBvbmVudC5pbnNlcnQoY2hpbGQpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVtb3ZlQ29tcG9uZW50KGNoaWxkQ29tcG9uZW50KXtcbiAgICAgICAgY29tcG9uZW50LnJlbW92ZShjaGlsZENvbXBvbmVudCk7XG4gICAgICAgIGNoaWxkQ29tcG9uZW50LmRlc3Ryb3koKTtcbiAgICB9XG5cbiAgICBjb21wb25lbnQuc2V0UHJvcGVydHkoJ2l0ZW1zJyxcbiAgICAgICAgZmFzdG4ucHJvcGVydHkoW10sIHNldHRpbmdzLml0ZW1DaGFuZ2VzIHx8ICd0eXBlIGtleXMgc2hhbGxvd1N0cnVjdHVyZScpXG4gICAgICAgICAgICAub24oJ2NoYW5nZScsIHVwZGF0ZUl0ZW1zKVxuICAgICk7XG5cbiAgICBjb21wb25lbnQuc2V0UHJvcGVydHkoJ3RlbXBsYXRlJyxcbiAgICAgICAgZmFzdG4ucHJvcGVydHkoKS5vbignY2hhbmdlJywgdXBkYXRlSXRlbXMpXG4gICAgKTtcblxuICAgIGNvbXBvbmVudC5zZXRQcm9wZXJ0eSgnZW1wdHlUZW1wbGF0ZScsXG4gICAgICAgIGZhc3RuLnByb3BlcnR5KCkub24oJ2NoYW5nZScsIHVwZGF0ZUl0ZW1zKVxuICAgICk7XG5cbiAgICByZXR1cm4gY29tcG9uZW50O1xufTsiLCJ2YXIgRW50aSA9IHJlcXVpcmUoJ2VudGknKSxcbiAgICBXaGF0Q2hhbmdlZCA9IHJlcXVpcmUoJ3doYXQtY2hhbmdlZCcpLFxuICAgIHNhbWUgPSByZXF1aXJlKCdzYW1lLXZhbHVlJyksXG4gICAgZmlybWVyID0gcmVxdWlyZSgnLi9maXJtZXInKSxcbiAgICBjcmVhdGVCaW5kaW5nID0gcmVxdWlyZSgnLi9iaW5kaW5nJyksXG4gICAgZnVuY3Rpb25FbWl0dGVyID0gcmVxdWlyZSgnLi9mdW5jdGlvbkVtaXR0ZXInKSxcbiAgICBzZXRQcm90b3R5cGVPZiA9IHJlcXVpcmUoJ3NldHByb3RvdHlwZW9mJyksXG4gICAgaXMgPSByZXF1aXJlKCcuL2lzJyk7XG5cbnZhciBwcm9wZXJ0eVByb3RvID0gT2JqZWN0LmNyZWF0ZShmdW5jdGlvbkVtaXR0ZXIpO1xuXG5wcm9wZXJ0eVByb3RvLl9mYXN0bl9wcm9wZXJ0eSA9IHRydWU7XG5wcm9wZXJ0eVByb3RvLl9maXJtID0gMTtcblxuZnVuY3Rpb24gcHJvcGVydHlUZW1wbGF0ZSh2YWx1ZSl7XG4gICAgaWYoIWFyZ3VtZW50cy5sZW5ndGgpe1xuICAgICAgICByZXR1cm4gdGhpcy5iaW5kaW5nICYmIHRoaXMuYmluZGluZygpIHx8IHRoaXMucHJvcGVydHkuX3ZhbHVlO1xuICAgIH1cblxuICAgIGlmKCF0aGlzLmRlc3Ryb3llZCl7XG4gICAgICAgIGlmKHRoaXMuYmluZGluZyl7XG4gICAgICAgICAgICB0aGlzLmJpbmRpbmcodmFsdWUpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucHJvcGVydHk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnZhbHVlVXBkYXRlKHZhbHVlKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn1cblxuZnVuY3Rpb24gY2hhbmdlQ2hlY2tlcihjdXJyZW50LCBjaGFuZ2VzKXtcbiAgICBpZihjaGFuZ2VzKXtcbiAgICAgICAgdmFyIGNoYW5nZXMgPSBuZXcgV2hhdENoYW5nZWQoY3VycmVudCwgY2hhbmdlcyk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAgICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhjaGFuZ2VzLnVwZGF0ZSh2YWx1ZSkpLmxlbmd0aCA+IDA7XG4gICAgICAgIH07XG4gICAgfWVsc2V7XG4gICAgICAgIHZhciBsYXN0VmFsdWUgPSBjdXJyZW50O1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24obmV3VmFsdWUpe1xuICAgICAgICAgICAgaWYoIXNhbWUobGFzdFZhbHVlLCBuZXdWYWx1ZSkpe1xuICAgICAgICAgICAgICAgIGxhc3RWYWx1ZSA9IG5ld1ZhbHVlO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cbn1cblxuXG5mdW5jdGlvbiBwcm9wZXJ0eUJpbmRpbmcobmV3QmluZGluZyl7XG4gICAgaWYoIWFyZ3VtZW50cy5sZW5ndGgpe1xuICAgICAgICByZXR1cm4gdGhpcy5iaW5kaW5nO1xuICAgIH1cblxuICAgIGlmKCFpcy5iaW5kaW5nKG5ld0JpbmRpbmcpKXtcbiAgICAgICAgbmV3QmluZGluZyA9IGNyZWF0ZUJpbmRpbmcobmV3QmluZGluZyk7XG4gICAgfVxuXG4gICAgaWYobmV3QmluZGluZyA9PT0gdGhpcy5iaW5kaW5nKXtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJvcGVydHk7XG4gICAgfVxuXG4gICAgaWYodGhpcy5iaW5kaW5nKXtcbiAgICAgICAgdGhpcy5iaW5kaW5nLnJlbW92ZUxpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLnZhbHVlVXBkYXRlKTtcbiAgICB9XG5cbiAgICB0aGlzLmJpbmRpbmcgPSBuZXdCaW5kaW5nO1xuXG4gICAgaWYodGhpcy5tb2RlbCl7XG4gICAgICAgIHRoaXMucHJvcGVydHkuYXR0YWNoKHRoaXMubW9kZWwsIHRoaXMucHJvcGVydHkuX2Zpcm0pO1xuICAgIH1cblxuICAgIHRoaXMuYmluZGluZy5vbignY2hhbmdlJywgdGhpcy52YWx1ZVVwZGF0ZSk7XG4gICAgdGhpcy52YWx1ZVVwZGF0ZSh0aGlzLmJpbmRpbmcoKSk7XG5cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn07XG5cbmZ1bmN0aW9uIGF0dGFjaFByb3BlcnR5KG9iamVjdCwgZmlybSl7XG4gICAgaWYoZmlybWVyKHRoaXMucHJvcGVydHksIGZpcm0pKXtcbiAgICAgICAgcmV0dXJuIHRoaXMucHJvcGVydHk7XG4gICAgfVxuXG4gICAgdGhpcy5wcm9wZXJ0eS5fZmlybSA9IGZpcm07XG5cbiAgICBpZighKG9iamVjdCBpbnN0YW5jZW9mIE9iamVjdCkpe1xuICAgICAgICBvYmplY3QgPSB7fTtcbiAgICB9XG5cbiAgICBpZih0aGlzLmJpbmRpbmcpe1xuICAgICAgICB0aGlzLm1vZGVsID0gb2JqZWN0O1xuICAgICAgICB0aGlzLmJpbmRpbmcuYXR0YWNoKG9iamVjdCwgMSk7XG4gICAgfVxuXG4gICAgaWYodGhpcy5wcm9wZXJ0eS5fZXZlbnRzICYmICdhdHRhY2gnIGluIHRoaXMucHJvcGVydHkuX2V2ZW50cyl7XG4gICAgICAgIHRoaXMucHJvcGVydHkuZW1pdCgnYXR0YWNoJywgb2JqZWN0LCAxKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn07XG5cbmZ1bmN0aW9uIGRldGFjaFByb3BlcnR5KGZpcm0pe1xuICAgIGlmKGZpcm1lcih0aGlzLnByb3BlcnR5LCBmaXJtKSl7XG4gICAgICAgIHJldHVybiB0aGlzLnByb3BlcnR5O1xuICAgIH1cblxuICAgIGlmKHRoaXMuYmluZGluZyl7XG4gICAgICAgIHRoaXMuYmluZGluZy5yZW1vdmVMaXN0ZW5lcignY2hhbmdlJywgdGhpcy52YWx1ZVVwZGF0ZSk7XG4gICAgICAgIHRoaXMuYmluZGluZy5kZXRhY2goMSk7XG4gICAgICAgIHRoaXMubW9kZWwgPSBudWxsO1xuICAgIH1cblxuICAgIGlmKHRoaXMucHJvcGVydHkuX2V2ZW50cyAmJiAnZGV0YWNoJyBpbiB0aGlzLnByb3BlcnR5Ll9ldmVudHMpe1xuICAgICAgICB0aGlzLnByb3BlcnR5LmVtaXQoJ2RldGFjaCcsIDEpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnByb3BlcnR5O1xufTtcblxuZnVuY3Rpb24gdXBkYXRlUHJvcGVydHkoKXtcbiAgICBpZighdGhpcy5kZXN0cm95ZWQpe1xuXG4gICAgICAgIGlmKHRoaXMucHJvcGVydHkuX3VwZGF0ZSl7XG4gICAgICAgICAgICB0aGlzLnByb3BlcnR5Ll91cGRhdGUodGhpcy5wcm9wZXJ0eS5fdmFsdWUsIHRoaXMucHJvcGVydHkpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5wcm9wZXJ0eS5lbWl0KCd1cGRhdGUnLCB0aGlzLnByb3BlcnR5Ll92YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnByb3BlcnR5O1xufTtcblxuZnVuY3Rpb24gcHJvcGVydHlVcGRhdGVyKGZuKXtcbiAgICBpZighYXJndW1lbnRzLmxlbmd0aCl7XG4gICAgICAgIHJldHVybiB0aGlzLnByb3BlcnR5Ll91cGRhdGU7XG4gICAgfVxuICAgIHRoaXMucHJvcGVydHkuX3VwZGF0ZSA9IGZuO1xuICAgIHJldHVybiB0aGlzLnByb3BlcnR5O1xufTtcblxuZnVuY3Rpb24gZGVzdHJveVByb3BlcnR5KCl7XG4gICAgaWYoIXRoaXMuZGVzdHJveWVkKXtcbiAgICAgICAgdGhpcy5kZXN0cm95ZWQgPSB0cnVlO1xuXG4gICAgICAgIHRoaXMucHJvcGVydHlcbiAgICAgICAgICAgIC5yZW1vdmVBbGxMaXN0ZW5lcnMoJ2NoYW5nZScpXG4gICAgICAgICAgICAucmVtb3ZlQWxsTGlzdGVuZXJzKCd1cGRhdGUnKVxuICAgICAgICAgICAgLnJlbW92ZUFsbExpc3RlbmVycygnYXR0YWNoJyk7XG5cbiAgICAgICAgdGhpcy5wcm9wZXJ0eS5lbWl0KCdkZXN0cm95Jyk7XG4gICAgICAgIHRoaXMucHJvcGVydHkuZGV0YWNoKCk7XG4gICAgICAgIGlmKHRoaXMuYmluZGluZyl7XG4gICAgICAgICAgICB0aGlzLmJpbmRpbmcuZGVzdHJveSh0cnVlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn07XG5cbmZ1bmN0aW9uIHByb3BlcnR5RGVzdHJveWVkKCl7XG4gICAgcmV0dXJuIHRoaXMuZGVzdHJveWVkO1xufTtcblxuZnVuY3Rpb24gYWRkUHJvcGVydHlUbyhjb21wb25lbnQsIGtleSl7XG4gICAgY29tcG9uZW50LnNldFByb3BlcnR5KGtleSwgdGhpcy5wcm9wZXJ0eSk7XG5cbiAgICByZXR1cm4gdGhpcy5wcm9wZXJ0eTtcbn07XG5cbmZ1bmN0aW9uIGNyZWF0ZVByb3BlcnR5KGN1cnJlbnRWYWx1ZSwgY2hhbmdlcywgdXBkYXRlcil7XG4gICAgaWYodHlwZW9mIGNoYW5nZXMgPT09ICdmdW5jdGlvbicpe1xuICAgICAgICB1cGRhdGVyID0gY2hhbmdlcztcbiAgICAgICAgY2hhbmdlcyA9IG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHByb3BlcnR5U2NvcGUgPVxuICAgICAgICBwcm9wZXJ0eSA9IHByb3BlcnR5VGVtcGxhdGUuYmluZChwcm9wZXJ0eVNjb3BlKVxuICAgICAgICBwcm9wZXJ0eVNjb3BlID0ge1xuICAgICAgICBoYXNDaGFuZ2VkOiBjaGFuZ2VDaGVja2VyKGN1cnJlbnRWYWx1ZSwgY2hhbmdlcyksXG4gICAgICAgIHZhbHVlVXBkYXRlOiBmdW5jdGlvbih2YWx1ZSl7XG4gICAgICAgICAgICBwcm9wZXJ0eS5fdmFsdWUgPSB2YWx1ZTtcbiAgICAgICAgICAgIGlmKCFwcm9wZXJ0eVNjb3BlLmhhc0NoYW5nZWQodmFsdWUpKXtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBwcm9wZXJ0eS5lbWl0KCdjaGFuZ2UnLCBwcm9wZXJ0eS5fdmFsdWUpO1xuICAgICAgICAgICAgcHJvcGVydHkudXBkYXRlKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgdmFyIHByb3BlcnR5ID0gcHJvcGVydHlTY29wZS5wcm9wZXJ0eSA9IHByb3BlcnR5VGVtcGxhdGUuYmluZChwcm9wZXJ0eVNjb3BlKTtcblxuICAgIHByb3BlcnR5Ll92YWx1ZSA9IGN1cnJlbnRWYWx1ZTtcbiAgICBwcm9wZXJ0eS5fdXBkYXRlID0gdXBkYXRlcjtcblxuICAgIHNldFByb3RvdHlwZU9mKHByb3BlcnR5LCBwcm9wZXJ0eVByb3RvKTtcblxuICAgIHByb3BlcnR5LmJpbmRpbmcgPSBwcm9wZXJ0eUJpbmRpbmcuYmluZChwcm9wZXJ0eVNjb3BlKTtcbiAgICBwcm9wZXJ0eS5hdHRhY2ggPSBhdHRhY2hQcm9wZXJ0eS5iaW5kKHByb3BlcnR5U2NvcGUpO1xuICAgIHByb3BlcnR5LmRldGFjaCA9IGRldGFjaFByb3BlcnR5LmJpbmQocHJvcGVydHlTY29wZSk7XG4gICAgcHJvcGVydHkudXBkYXRlID0gdXBkYXRlUHJvcGVydHkuYmluZChwcm9wZXJ0eVNjb3BlKTtcbiAgICBwcm9wZXJ0eS51cGRhdGVyID0gcHJvcGVydHlVcGRhdGVyLmJpbmQocHJvcGVydHlTY29wZSk7XG4gICAgcHJvcGVydHkuZGVzdHJveSA9IGRlc3Ryb3lQcm9wZXJ0eS5iaW5kKHByb3BlcnR5U2NvcGUpO1xuICAgIHByb3BlcnR5LmRlc3Ryb3llZCA9IHByb3BlcnR5RGVzdHJveWVkLmJpbmQocHJvcGVydHlTY29wZSk7XG4gICAgcHJvcGVydHkuYWRkVG8gPSBhZGRQcm9wZXJ0eVRvLmJpbmQocHJvcGVydHlTY29wZSk7XG5cbiAgICByZXR1cm4gcHJvcGVydHk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVByb3BlcnR5OyIsInZhciB0b2RvID0gW10sXG4gICAgdG9kb0tleXMgPSBbXSxcbiAgICBzY2hlZHVsZWQsXG4gICAgdXBkYXRlcyA9IDA7XG5cbmZ1bmN0aW9uIHJ1bigpe1xuICAgIHZhciBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xuXG4gICAgd2hpbGUodG9kby5sZW5ndGggJiYgRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSA8IDE2KXtcbiAgICAgICAgdG9kb0tleXMuc2hpZnQoKTtcbiAgICAgICAgdG9kby5zaGlmdCgpKCk7XG4gICAgfVxuXG4gICAgaWYodG9kby5sZW5ndGgpe1xuICAgICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUocnVuKTtcbiAgICB9ZWxzZXtcbiAgICAgICAgc2NoZWR1bGVkID0gZmFsc2U7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzY2hlZHVsZShrZXksIGZuKXtcbiAgICBpZih+dG9kb0tleXMuaW5kZXhPZihrZXkpKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRvZG8ucHVzaChmbik7XG4gICAgdG9kb0tleXMucHVzaChrZXkpO1xuXG4gICAgaWYoIXNjaGVkdWxlZCl7XG4gICAgICAgIHNjaGVkdWxlZCA9IHRydWU7XG4gICAgICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShydW4pO1xuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzY2hlZHVsZTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGZhc3RuLCBjb21wb25lbnQsIHR5cGUsIHNldHRpbmdzLCBjaGlsZHJlbil7XG4gICAgdmFyIGl0ZW1Nb2RlbCA9IG5ldyBmYXN0bi5Nb2RlbCh7fSk7XG5cbiAgICBpZighKCd0ZW1wbGF0ZScgaW4gc2V0dGluZ3MpKXtcbiAgICAgICAgY29uc29sZS53YXJuKCdObyBcInRlbXBsYXRlXCIgZnVuY3Rpb24gd2FzIHNldCBmb3IgdGhpcyB0ZW1wbGF0ZXIgY29tcG9uZW50Jyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVwbGFjZUVsZW1lbnQoZWxlbWVudCl7XG4gICAgICAgIGlmKGNvbXBvbmVudC5lbGVtZW50ICYmIGNvbXBvbmVudC5lbGVtZW50LnBhcmVudE5vZGUpe1xuICAgICAgICAgICAgY29tcG9uZW50LmVsZW1lbnQucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoZWxlbWVudCwgY29tcG9uZW50LmVsZW1lbnQpO1xuICAgICAgICB9XG4gICAgICAgIGNvbXBvbmVudC5lbGVtZW50ID0gZWxlbWVudDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB1cGRhdGUoKXtcblxuICAgICAgICB2YXIgdmFsdWUgPSBjb21wb25lbnQuZGF0YSgpLFxuICAgICAgICAgICAgdGVtcGxhdGUgPSBjb21wb25lbnQudGVtcGxhdGUoKTtcblxuICAgICAgICBpdGVtTW9kZWwuc2V0KCdpdGVtJywgdmFsdWUpO1xuXG4gICAgICAgIHZhciBuZXdDb21wb25lbnQ7XG5cbiAgICAgICAgaWYodGVtcGxhdGUpe1xuICAgICAgICAgICBuZXdDb21wb25lbnQgPSBmYXN0bi50b0NvbXBvbmVudCh0ZW1wbGF0ZShpdGVtTW9kZWwsIGNvbXBvbmVudC5zY29wZSgpLCBjb21wb25lbnQuX2N1cnJlbnRDb21wb25lbnQpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGNvbXBvbmVudC5fY3VycmVudENvbXBvbmVudCAmJiBjb21wb25lbnQuX2N1cnJlbnRDb21wb25lbnQgIT09IG5ld0NvbXBvbmVudCl7XG4gICAgICAgICAgICBpZihmYXN0bi5pc0NvbXBvbmVudChjb21wb25lbnQuX2N1cnJlbnRDb21wb25lbnQpKXtcbiAgICAgICAgICAgICAgICBjb21wb25lbnQuX2N1cnJlbnRDb21wb25lbnQuZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29tcG9uZW50Ll9jdXJyZW50Q29tcG9uZW50ID0gbmV3Q29tcG9uZW50O1xuXG4gICAgICAgIGlmKCFuZXdDb21wb25lbnQpe1xuICAgICAgICAgICAgcmVwbGFjZUVsZW1lbnQoY29tcG9uZW50LmVtcHR5RWxlbWVudCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZihmYXN0bi5pc0NvbXBvbmVudChuZXdDb21wb25lbnQpKXtcbiAgICAgICAgICAgIGlmKGNvbXBvbmVudC5fc2V0dGluZ3MuYXR0YWNoVGVtcGxhdGVzICE9PSBmYWxzZSl7XG4gICAgICAgICAgICAgICAgbmV3Q29tcG9uZW50LmF0dGFjaChpdGVtTW9kZWwsIDIpO1xuICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgbmV3Q29tcG9uZW50LmF0dGFjaChjb21wb25lbnQuc2NvcGUoKSwgMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmKGNvbXBvbmVudC5lbGVtZW50ICYmIGNvbXBvbmVudC5lbGVtZW50ICE9PSBuZXdDb21wb25lbnQuZWxlbWVudCl7XG4gICAgICAgICAgICAgICAgaWYobmV3Q29tcG9uZW50LmVsZW1lbnQgPT0gbnVsbCl7XG4gICAgICAgICAgICAgICAgICAgIG5ld0NvbXBvbmVudC5yZW5kZXIoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVwbGFjZUVsZW1lbnQoY29tcG9uZW50Ll9jdXJyZW50Q29tcG9uZW50LmVsZW1lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgY29tcG9uZW50LnJlbmRlciA9IGZ1bmN0aW9uKCl7XG4gICAgICAgIHZhciBlbGVtZW50O1xuICAgICAgICBjb21wb25lbnQuZW1wdHlFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuICAgICAgICBpZihjb21wb25lbnQuX2N1cnJlbnRDb21wb25lbnQpe1xuICAgICAgICAgICAgY29tcG9uZW50Ll9jdXJyZW50Q29tcG9uZW50LnJlbmRlcigpO1xuICAgICAgICAgICAgZWxlbWVudCA9IGNvbXBvbmVudC5fY3VycmVudENvbXBvbmVudC5lbGVtZW50O1xuICAgICAgICB9XG4gICAgICAgIGNvbXBvbmVudC5lbGVtZW50ID0gZWxlbWVudCB8fCBjb21wb25lbnQuZW1wdHlFbGVtZW50O1xuICAgICAgICBjb21wb25lbnQuZW1pdCgncmVuZGVyJyk7XG4gICAgfTtcblxuICAgIGNvbXBvbmVudC5zZXRQcm9wZXJ0eSgnZGF0YScsXG4gICAgICAgIGZhc3RuLnByb3BlcnR5KHVuZGVmaW5lZCwgc2V0dGluZ3MuZGF0YUNoYW5nZXMgfHwgJ3ZhbHVlIHN0cnVjdHVyZScpXG4gICAgICAgICAgICAub24oJ2NoYW5nZScsIHVwZGF0ZSlcbiAgICApO1xuXG4gICAgY29tcG9uZW50LnNldFByb3BlcnR5KCd0ZW1wbGF0ZScsXG4gICAgICAgIGZhc3RuLnByb3BlcnR5KHVuZGVmaW5lZCwgJ3ZhbHVlIHJlZmVyZW5jZScpXG4gICAgICAgICAgICAub24oJ2NoYW5nZScsIHVwZGF0ZSlcbiAgICApO1xuXG4gICAgY29tcG9uZW50Lm9uKCdkZXN0cm95JywgZnVuY3Rpb24oKXtcbiAgICAgICAgaWYoZmFzdG4uaXNDb21wb25lbnQoY29tcG9uZW50Ll9jdXJyZW50Q29tcG9uZW50KSl7XG4gICAgICAgICAgICBjb21wb25lbnQuX2N1cnJlbnRDb21wb25lbnQuZGVzdHJveSgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBjb21wb25lbnQub24oJ2F0dGFjaCcsIGZ1bmN0aW9uKGRhdGEpe1xuICAgICAgICBpZihmYXN0bi5pc0NvbXBvbmVudChjb21wb25lbnQuX2N1cnJlbnRDb21wb25lbnQpKXtcbiAgICAgICAgICAgIGNvbXBvbmVudC5fY3VycmVudENvbXBvbmVudC5hdHRhY2goY29tcG9uZW50LnNjb3BlKCksIDEpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gY29tcG9uZW50O1xufTsiLCJmdW5jdGlvbiB1cGRhdGVUZXh0KCl7XG4gICAgaWYoIXRoaXMuZWxlbWVudCl7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgdmFsdWUgPSB0aGlzLnRleHQoKTtcblxuICAgIHRoaXMuZWxlbWVudC50ZXh0Q29udGVudCA9ICh2YWx1ZSA9PSBudWxsID8gJycgOiB2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIGF1dG9SZW5kZXIoY29udGVudCl7XG4gICAgdGhpcy5lbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoY29udGVudCk7XG59XG5cbmZ1bmN0aW9uIGF1dG9UZXh0KHRleHQsIGZhc3RuLCBjb250ZW50KSB7XG4gICAgdGV4dC5yZW5kZXIgPSBhdXRvUmVuZGVyLmJpbmQodGV4dCwgY29udGVudCk7XG5cbiAgICByZXR1cm4gdGV4dDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyKCl7XG4gICAgdGhpcy5lbGVtZW50ID0gdGhpcy5jcmVhdGVUZXh0Tm9kZSh0aGlzLnRleHQoKSk7XG4gICAgdGhpcy5lbWl0KCdyZW5kZXInKTtcbn07XG5cbmZ1bmN0aW9uIHRleHRDb21wb25lbnQoZmFzdG4sIGNvbXBvbmVudCwgdHlwZSwgc2V0dGluZ3MsIGNoaWxkcmVuKXtcbiAgICBpZihzZXR0aW5ncy5hdXRvKXtcbiAgICAgICAgZGVsZXRlIHNldHRpbmdzLmF1dG87XG4gICAgICAgIGlmKCFmYXN0bi5pc0JpbmRpbmcoY2hpbGRyZW5bMF0pKXtcbiAgICAgICAgICAgIHJldHVybiBhdXRvVGV4dChjb21wb25lbnQsIGZhc3RuLCBjaGlsZHJlblswXSk7XG4gICAgICAgIH1cbiAgICAgICAgc2V0dGluZ3MudGV4dCA9IGNoaWxkcmVuLnBvcCgpO1xuICAgIH1cblxuICAgIGNvbXBvbmVudC5jcmVhdGVUZXh0Tm9kZSA9IHRleHRDb21wb25lbnQuY3JlYXRlVGV4dE5vZGU7XG4gICAgY29tcG9uZW50LnJlbmRlciA9IHJlbmRlci5iaW5kKGNvbXBvbmVudCk7XG5cbiAgICBjb21wb25lbnQuc2V0UHJvcGVydHkoJ3RleHQnLCBmYXN0bi5wcm9wZXJ0eSgnJywgdXBkYXRlVGV4dC5iaW5kKGNvbXBvbmVudCkpKTtcblxuICAgIHJldHVybiBjb21wb25lbnQ7XG59XG5cbnRleHRDb21wb25lbnQuY3JlYXRlVGV4dE5vZGUgPSBmdW5jdGlvbih0ZXh0KXtcbiAgICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHRleHRDb21wb25lbnQ7IiwiZnVuY3Rpb24gZmxhdE1lcmdlKGEsYil7XG4gICAgaWYoIWIgfHwgdHlwZW9mIGIgIT09ICdvYmplY3QnKXtcbiAgICAgICAgYiA9IHt9O1xuICAgIH1cblxuICAgIGlmKCFhIHx8IHR5cGVvZiBhICE9PSAnb2JqZWN0Jyl7XG4gICAgICAgIGEgPSBuZXcgYi5jb25zdHJ1Y3RvcigpO1xuICAgIH1cblxuICAgIHZhciByZXN1bHQgPSBuZXcgYS5jb25zdHJ1Y3RvcigpLFxuICAgICAgICBhS2V5cyA9IE9iamVjdC5rZXlzKGEpLFxuICAgICAgICBiS2V5cyA9IE9iamVjdC5rZXlzKGIpO1xuXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGFLZXlzLmxlbmd0aDsgaSsrKXtcbiAgICAgICAgcmVzdWx0W2FLZXlzW2ldXSA9IGFbYUtleXNbaV1dO1xuICAgIH1cblxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBiS2V5cy5sZW5ndGg7IGkrKyl7XG4gICAgICAgIHJlc3VsdFtiS2V5c1tpXV0gPSBiW2JLZXlzW2ldXTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZsYXRNZXJnZTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHZhbHVlKXtcbiAgICByZXR1cm4gdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyB8fCB0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbic7XG59OyIsIlwidXNlIHN0cmljdFwiO1xuXG4vKiBnbG9iYWwgbW9kdWxlLCBkZWZpbmUgKi9cblxuZnVuY3Rpb24gbWFwRWFjaChtYXAsIG9wZXJhdGlvbil7XG4gIHZhciBrZXlzID0gbWFwLmtleXMoKTtcbiAgdmFyIG5leHQ7XG4gIHdoaWxlKCEobmV4dCA9IGtleXMubmV4dCgpKS5kb25lKSB7XG4gICAgb3BlcmF0aW9uKG1hcC5nZXQobmV4dC52YWx1ZSksIG5leHQudmFsdWUsIG1hcCk7XG4gIH1cbn1cblxudmFyIE11bHRpbWFwID0gKGZ1bmN0aW9uKCkge1xuICB2YXIgbWFwQ3RvcjtcbiAgaWYgKHR5cGVvZiBNYXAgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbWFwQ3RvciA9IE1hcDtcblxuICAgIGlmICghTWFwLnByb3RvdHlwZS5rZXlzKSB7XG4gICAgICBNYXAucHJvdG90eXBlLmtleXMgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGtleXMgPSBbXTtcbiAgICAgICAgdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGl0ZW0sIGtleSkge1xuICAgICAgICAgIGtleXMucHVzaChrZXkpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGtleXM7XG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIE11bHRpbWFwKGl0ZXJhYmxlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgc2VsZi5fbWFwID0gbWFwQ3RvcjtcblxuICAgIGlmIChNdWx0aW1hcC5NYXApIHtcbiAgICAgIHNlbGYuX21hcCA9IE11bHRpbWFwLk1hcDtcbiAgICB9XG5cbiAgICBzZWxmLl8gPSBzZWxmLl9tYXAgPyBuZXcgc2VsZi5fbWFwKCkgOiB7fTtcblxuICAgIGlmIChpdGVyYWJsZSkge1xuICAgICAgaXRlcmFibGUuZm9yRWFjaChmdW5jdGlvbihpKSB7XG4gICAgICAgIHNlbGYuc2V0KGlbMF0sIGlbMV0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBrZXlcbiAgICogQHJldHVybiB7QXJyYXl9IEFuIGFycmF5IG9mIHZhbHVlcywgdW5kZWZpbmVkIGlmIG5vIHN1Y2ggYSBrZXk7XG4gICAqL1xuICBNdWx0aW1hcC5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24oa2V5KSB7XG4gICAgcmV0dXJuIHRoaXMuX21hcCA/IHRoaXMuXy5nZXQoa2V5KSA6IHRoaXMuX1trZXldO1xuICB9O1xuXG4gIC8qKlxuICAgKiBAcGFyYW0ge09iamVjdH0ga2V5XG4gICAqIEBwYXJhbSB7T2JqZWN0fSB2YWwuLi5cbiAgICovXG4gIE11bHRpbWFwLnByb3RvdHlwZS5zZXQgPSBmdW5jdGlvbihrZXksIHZhbCkge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblxuICAgIGtleSA9IGFyZ3Muc2hpZnQoKTtcblxuICAgIHZhciBlbnRyeSA9IHRoaXMuZ2V0KGtleSk7XG4gICAgaWYgKCFlbnRyeSkge1xuICAgICAgZW50cnkgPSBbXTtcbiAgICAgIGlmICh0aGlzLl9tYXApXG4gICAgICAgIHRoaXMuXy5zZXQoa2V5LCBlbnRyeSk7XG4gICAgICBlbHNlXG4gICAgICAgIHRoaXMuX1trZXldID0gZW50cnk7XG4gICAgfVxuXG4gICAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkoZW50cnksIGFyZ3MpO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBAcGFyYW0ge09iamVjdH0ga2V5XG4gICAqIEBwYXJhbSB7T2JqZWN0PX0gdmFsXG4gICAqIEByZXR1cm4ge2Jvb2xlYW59IHRydWUgaWYgYW55IHRoaW5nIGNoYW5nZWRcbiAgICovXG4gIE11bHRpbWFwLnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbihrZXksIHZhbCkge1xuICAgIGlmICghdGhpcy5oYXMoa2V5KSlcbiAgICAgIHJldHVybiBmYWxzZTtcblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09IDEpIHtcbiAgICAgIHRoaXMuX21hcCA/ICh0aGlzLl8uZGVsZXRlKGtleSkpIDogKGRlbGV0ZSB0aGlzLl9ba2V5XSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGVudHJ5ID0gdGhpcy5nZXQoa2V5KTtcbiAgICAgIHZhciBpZHggPSBlbnRyeS5pbmRleE9mKHZhbCk7XG4gICAgICBpZiAoaWR4ICE9IC0xKSB7XG4gICAgICAgIGVudHJ5LnNwbGljZShpZHgsIDEpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2U7XG4gIH07XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBrZXlcbiAgICogQHBhcmFtIHtPYmplY3Q9fSB2YWxcbiAgICogQHJldHVybiB7Ym9vbGVhbn0gd2hldGhlciB0aGUgbWFwIGNvbnRhaW5zICdrZXknIG9yICdrZXk9PnZhbCcgcGFpclxuICAgKi9cbiAgTXVsdGltYXAucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uKGtleSwgdmFsKSB7XG4gICAgdmFyIGhhc0tleSA9IHRoaXMuX21hcCA/IHRoaXMuXy5oYXMoa2V5KSA6IHRoaXMuXy5oYXNPd25Qcm9wZXJ0eShrZXkpO1xuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT0gMSB8fCAhaGFzS2V5KVxuICAgICAgcmV0dXJuIGhhc0tleTtcblxuICAgIHZhciBlbnRyeSA9IHRoaXMuZ2V0KGtleSkgfHwgW107XG4gICAgcmV0dXJuIGVudHJ5LmluZGV4T2YodmFsKSAhPSAtMTtcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtBcnJheX0gYWxsIHRoZSBrZXlzIGluIHRoZSBtYXBcbiAgICovXG4gIE11bHRpbWFwLnByb3RvdHlwZS5rZXlzID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuX21hcClcbiAgICAgIHJldHVybiBtYWtlSXRlcmF0b3IodGhpcy5fLmtleXMoKSk7XG5cbiAgICByZXR1cm4gbWFrZUl0ZXJhdG9yKE9iamVjdC5rZXlzKHRoaXMuXykpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtBcnJheX0gYWxsIHRoZSB2YWx1ZXMgaW4gdGhlIG1hcFxuICAgKi9cbiAgTXVsdGltYXAucHJvdG90eXBlLnZhbHVlcyA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciB2YWxzID0gW107XG4gICAgdGhpcy5mb3JFYWNoRW50cnkoZnVuY3Rpb24oZW50cnkpIHtcbiAgICAgIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHZhbHMsIGVudHJ5KTtcbiAgICB9KTtcblxuICAgIHJldHVybiBtYWtlSXRlcmF0b3IodmFscyk7XG4gIH07XG5cbiAgLyoqXG4gICAqXG4gICAqL1xuICBNdWx0aW1hcC5wcm90b3R5cGUuZm9yRWFjaEVudHJ5ID0gZnVuY3Rpb24oaXRlcikge1xuICAgIG1hcEVhY2godGhpcywgaXRlcik7XG4gIH07XG5cbiAgTXVsdGltYXAucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbihpdGVyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHNlbGYuZm9yRWFjaEVudHJ5KGZ1bmN0aW9uKGVudHJ5LCBrZXkpIHtcbiAgICAgIGVudHJ5LmZvckVhY2goZnVuY3Rpb24oaXRlbSkge1xuICAgICAgICBpdGVyKGl0ZW0sIGtleSwgc2VsZik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfTtcblxuXG4gIE11bHRpbWFwLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh0aGlzLl9tYXApIHtcbiAgICAgIHRoaXMuXy5jbGVhcigpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl8gPSB7fTtcbiAgICB9XG4gIH07XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KFxuICAgIE11bHRpbWFwLnByb3RvdHlwZSxcbiAgICBcInNpemVcIiwge1xuICAgICAgY29uZmlndXJhYmxlOiBmYWxzZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdG90YWwgPSAwO1xuXG4gICAgICAgIG1hcEVhY2godGhpcywgZnVuY3Rpb24odmFsdWUpe1xuICAgICAgICAgIHRvdGFsICs9IHZhbHVlLmxlbmd0aDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRvdGFsO1xuICAgICAgfVxuICAgIH0pO1xuXG4gIHZhciBzYWZhcmlOZXh0O1xuXG4gIHRyeXtcbiAgICBzYWZhcmlOZXh0ID0gbmV3IEZ1bmN0aW9uKCdpdGVyYXRvcicsICdtYWtlSXRlcmF0b3InLCAndmFyIGtleXNBcnJheSA9IFtdOyBmb3IodmFyIGtleSBvZiBpdGVyYXRvcil7a2V5c0FycmF5LnB1c2goa2V5KTt9IHJldHVybiBtYWtlSXRlcmF0b3Ioa2V5c0FycmF5KS5uZXh0OycpO1xuICB9Y2F0Y2goZXJyb3Ipe1xuICAgIC8vIGZvciBvZiBub3QgaW1wbGVtZW50ZWQ7XG4gIH1cblxuICBmdW5jdGlvbiBtYWtlSXRlcmF0b3IoaXRlcmF0b3Ipe1xuICAgIGlmKEFycmF5LmlzQXJyYXkoaXRlcmF0b3IpKXtcbiAgICAgIHZhciBuZXh0SW5kZXggPSAwO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBuZXh0OiBmdW5jdGlvbigpe1xuICAgICAgICAgIHJldHVybiBuZXh0SW5kZXggPCBpdGVyYXRvci5sZW5ndGggP1xuICAgICAgICAgICAge3ZhbHVlOiBpdGVyYXRvcltuZXh0SW5kZXgrK10sIGRvbmU6IGZhbHNlfSA6XG4gICAgICAgICAge2RvbmU6IHRydWV9O1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIE9ubHkgYW4gaXNzdWUgaW4gc2FmYXJpXG4gICAgaWYoIWl0ZXJhdG9yLm5leHQgJiYgc2FmYXJpTmV4dCl7XG4gICAgICBpdGVyYXRvci5uZXh0ID0gc2FmYXJpTmV4dChpdGVyYXRvciwgbWFrZUl0ZXJhdG9yKTtcbiAgICB9XG5cbiAgICByZXR1cm4gaXRlcmF0b3I7XG4gIH1cblxuICByZXR1cm4gTXVsdGltYXA7XG59KSgpO1xuXG5cbmlmKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiBtb2R1bGUgJiYgbW9kdWxlLmV4cG9ydHMpXG4gIG1vZHVsZS5leHBvcnRzID0gTXVsdGltYXA7XG5lbHNlIGlmKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZClcbiAgZGVmaW5lKGZ1bmN0aW9uKCkgeyByZXR1cm4gTXVsdGltYXA7IH0pO1xuIiwidmFyIHN1cHBvcnRlZFR5cGVzID0gWyd0ZXh0JywgJ3NlYXJjaCcsICd0ZWwnLCAndXJsJywgJ3Bhc3N3b3JkJ107XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZWxlbWVudCl7XG4gICAgcmV0dXJuICEhKGVsZW1lbnQuc2V0U2VsZWN0aW9uUmFuZ2UgJiYgfnN1cHBvcnRlZFR5cGVzLmluZGV4T2YoZWxlbWVudC50eXBlKSk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xudmFyIHByb3BJc0VudW1lcmFibGUgPSBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlO1xuXG5mdW5jdGlvbiBUb09iamVjdCh2YWwpIHtcblx0aWYgKHZhbCA9PSBudWxsKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcignT2JqZWN0LmFzc2lnbiBjYW5ub3QgYmUgY2FsbGVkIHdpdGggbnVsbCBvciB1bmRlZmluZWQnKTtcblx0fVxuXG5cdHJldHVybiBPYmplY3QodmFsKTtcbn1cblxuZnVuY3Rpb24gb3duRW51bWVyYWJsZUtleXMob2JqKSB7XG5cdHZhciBrZXlzID0gT2JqZWN0LmdldE93blByb3BlcnR5TmFtZXMob2JqKTtcblxuXHRpZiAoT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scykge1xuXHRcdGtleXMgPSBrZXlzLmNvbmNhdChPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKG9iaikpO1xuXHR9XG5cblx0cmV0dXJuIGtleXMuZmlsdGVyKGZ1bmN0aW9uIChrZXkpIHtcblx0XHRyZXR1cm4gcHJvcElzRW51bWVyYWJsZS5jYWxsKG9iaiwga2V5KTtcblx0fSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiAodGFyZ2V0LCBzb3VyY2UpIHtcblx0dmFyIGZyb207XG5cdHZhciBrZXlzO1xuXHR2YXIgdG8gPSBUb09iamVjdCh0YXJnZXQpO1xuXG5cdGZvciAodmFyIHMgPSAxOyBzIDwgYXJndW1lbnRzLmxlbmd0aDsgcysrKSB7XG5cdFx0ZnJvbSA9IGFyZ3VtZW50c1tzXTtcblx0XHRrZXlzID0gb3duRW51bWVyYWJsZUtleXMoT2JqZWN0KGZyb20pKTtcblxuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dG9ba2V5c1tpXV0gPSBmcm9tW2tleXNbaV1dO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0bztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGRvRXZhbChzZWxmLCBfX3BzZXVkb3dvcmtlcl9zY3JpcHQpIHtcbiAgLyoganNoaW50IHVudXNlZDpmYWxzZSAqL1xuICAoZnVuY3Rpb24gKCkge1xuICAgIC8qIGpzaGludCBldmlsOnRydWUgKi9cbiAgICBldmFsKF9fcHNldWRvd29ya2VyX3NjcmlwdCk7XG4gIH0pLmNhbGwoZ2xvYmFsKTtcbn1cblxuZnVuY3Rpb24gUHNldWRvV29ya2VyKHBhdGgpIHtcbiAgdmFyIG1lc3NhZ2VMaXN0ZW5lcnMgPSBbXTtcbiAgdmFyIGVycm9yTGlzdGVuZXJzID0gW107XG4gIHZhciB3b3JrZXJNZXNzYWdlTGlzdGVuZXJzID0gW107XG4gIHZhciB3b3JrZXJFcnJvckxpc3RlbmVycyA9IFtdO1xuICB2YXIgcG9zdE1lc3NhZ2VMaXN0ZW5lcnMgPSBbXTtcbiAgdmFyIHRlcm1pbmF0ZWQgPSBmYWxzZTtcbiAgdmFyIHNjcmlwdDtcbiAgdmFyIHdvcmtlclNlbGY7XG5cbiAgdmFyIGFwaSA9IHRoaXM7XG5cbiAgLy8gYmVjYXVzZSBJRTggc3VwcG9ydFxuICBmdW5jdGlvbiBmb3JFYWNoKGFyciwgZnVuKSB7XG4gICAgdmFyIGkgPSAtMTtcbiAgICB2YXIgbGVuID0gYXJyLmxlbmd0aDtcbiAgICB3aGlsZSAoKytpIDwgbGVuKSB7XG4gICAgICBmdW4oYXJyW2ldKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjYWxsRXJyb3JMaXN0ZW5lcihlcnIpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKGxpc3RlbmVyKSB7XG4gICAgICBsaXN0ZW5lcih7XG4gICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgICAgIGVycm9yOiBlcnIsXG4gICAgICAgIG1lc3NhZ2U6IGVyci5tZXNzYWdlXG4gICAgICB9KTtcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBmdW4pIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgIGlmICh0eXBlID09PSAnbWVzc2FnZScpIHtcbiAgICAgIG1lc3NhZ2VMaXN0ZW5lcnMucHVzaChmdW4pO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgICAgZXJyb3JMaXN0ZW5lcnMucHVzaChmdW4pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBvc3RFcnJvcihlcnIpIHtcbiAgICB2YXIgY2FsbEZ1biA9IGNhbGxFcnJvckxpc3RlbmVyKGVycik7XG4gICAgaWYgKHR5cGVvZiBhcGkub25lcnJvciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbEZ1bihhcGkub25lcnJvcik7XG4gICAgfVxuICAgIGlmICh3b3JrZXJTZWxmICYmIHR5cGVvZiB3b3JrZXJTZWxmLm9uZXJyb3IgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGNhbGxGdW4od29ya2VyU2VsZi5vbmVycm9yKTtcbiAgICB9XG4gICAgZm9yRWFjaChlcnJvckxpc3RlbmVycywgY2FsbEZ1bik7XG4gICAgZm9yRWFjaCh3b3JrZXJFcnJvckxpc3RlbmVycywgY2FsbEZ1bik7XG4gIH1cblxuICBmdW5jdGlvbiBydW5Qb3N0TWVzc2FnZShtc2cpIHtcbiAgICBmdW5jdGlvbiBjYWxsRnVuKGxpc3RlbmVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBsaXN0ZW5lcih7ZGF0YTogbXNnfSk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgcG9zdEVycm9yKGVycik7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHdvcmtlclNlbGYgJiYgdHlwZW9mIHdvcmtlclNlbGYub25tZXNzYWdlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBjYWxsRnVuKHdvcmtlclNlbGYub25tZXNzYWdlKTtcbiAgICB9XG4gICAgZm9yRWFjaCh3b3JrZXJNZXNzYWdlTGlzdGVuZXJzLCBjYWxsRnVuKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBvc3RNZXNzYWdlKG1zZykge1xuICAgIGlmICh0eXBlb2YgbXNnID09PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb3N0TWVzc2FnZSgpIHJlcXVpcmVzIGFuIGFyZ3VtZW50Jyk7XG4gICAgfVxuICAgIGlmICh0ZXJtaW5hdGVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICghc2NyaXB0KSB7XG4gICAgICBwb3N0TWVzc2FnZUxpc3RlbmVycy5wdXNoKG1zZyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHJ1blBvc3RNZXNzYWdlKG1zZyk7XG4gIH1cblxuICBmdW5jdGlvbiB0ZXJtaW5hdGUoKSB7XG4gICAgdGVybWluYXRlZCA9IHRydWU7XG4gIH1cblxuICBmdW5jdGlvbiB3b3JrZXJQb3N0TWVzc2FnZShtc2cpIHtcbiAgICBmdW5jdGlvbiBjYWxsRnVuKGxpc3RlbmVyKSB7XG4gICAgICBsaXN0ZW5lcih7XG4gICAgICAgIGRhdGE6IG1zZ1xuICAgICAgfSk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgYXBpLm9ubWVzc2FnZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgY2FsbEZ1bihhcGkub25tZXNzYWdlKTtcbiAgICB9XG4gICAgZm9yRWFjaChtZXNzYWdlTGlzdGVuZXJzLCBjYWxsRnVuKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHdvcmtlckFkZEV2ZW50TGlzdGVuZXIodHlwZSwgZnVuKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICBpZiAodHlwZSA9PT0gJ21lc3NhZ2UnKSB7XG4gICAgICB3b3JrZXJNZXNzYWdlTGlzdGVuZXJzLnB1c2goZnVuKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICAgIHdvcmtlckVycm9yTGlzdGVuZXJzLnB1c2goZnVuKTtcbiAgICB9XG4gIH1cblxuICB2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgeGhyLm9wZW4oJ0dFVCcsIHBhdGgpO1xuICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICh4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgaWYgKHhoci5zdGF0dXMgPj0gMjAwICYmIHhoci5zdGF0dXMgPCA0MDApIHtcbiAgICAgICAgc2NyaXB0ID0geGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgd29ya2VyU2VsZiA9IHtcbiAgICAgICAgICBwb3N0TWVzc2FnZTogd29ya2VyUG9zdE1lc3NhZ2UsXG4gICAgICAgICAgYWRkRXZlbnRMaXN0ZW5lcjogd29ya2VyQWRkRXZlbnRMaXN0ZW5lcixcbiAgICAgICAgfTtcbiAgICAgICAgZG9FdmFsKHdvcmtlclNlbGYsIHNjcmlwdCk7XG4gICAgICAgIHdoaWxlIChwb3N0TWVzc2FnZUxpc3RlbmVycy5sZW5ndGgpIHtcbiAgICAgICAgICBydW5Qb3N0TWVzc2FnZShwb3N0TWVzc2FnZUxpc3RlbmVycy5wb3AoKSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBvc3RFcnJvcihuZXcgRXJyb3IoJ2Nhbm5vdCBmaW5kIHNjcmlwdCAnICsgcGF0aCkpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICB4aHIuc2VuZCgpO1xuXG4gIGFwaS5wb3N0TWVzc2FnZSA9IHBvc3RNZXNzYWdlO1xuICBhcGkuYWRkRXZlbnRMaXN0ZW5lciA9IGFkZEV2ZW50TGlzdGVuZXI7XG4gIGFwaS50ZXJtaW5hdGUgPSB0ZXJtaW5hdGU7XG5cbiAgcmV0dXJuIGFwaTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQc2V1ZG9Xb3JrZXI7IiwiJ3VzZSBzdHJpY3QnO1xuXG5pZiAodHlwZW9mIFdvcmtlciA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgZ2xvYmFsLldvcmtlciA9IHJlcXVpcmUoJy4vJyk7XG59IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc1NhbWUoYSwgYil7XG4gICAgaWYoYSA9PT0gYil7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIGlmKFxuICAgICAgICB0eXBlb2YgYSAhPT0gdHlwZW9mIGIgfHxcbiAgICAgICAgdHlwZW9mIGEgPT09ICdvYmplY3QnICYmXG4gICAgICAgICEoYSBpbnN0YW5jZW9mIERhdGUgJiYgYiBpbnN0YW5jZW9mIERhdGUpXG4gICAgKXtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBTdHJpbmcoYSkgPT09IFN0cmluZyhiKTtcbn07IiwidmFyIG5hdHVyYWxTZWxlY3Rpb24gPSByZXF1aXJlKCduYXR1cmFsLXNlbGVjdGlvbicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVsZW1lbnQsIHZhbHVlKXtcbiAgICB2YXIgY2FuU2V0ID0gbmF0dXJhbFNlbGVjdGlvbihlbGVtZW50KSAmJiBlbGVtZW50ID09PSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXG4gICAgaWYgKGNhblNldCkge1xuICAgICAgICB2YXIgc3RhcnQgPSBlbGVtZW50LnNlbGVjdGlvblN0YXJ0LFxuICAgICAgICAgICAgZW5kID0gZWxlbWVudC5zZWxlY3Rpb25FbmQ7XG5cbiAgICAgICAgZWxlbWVudC52YWx1ZSA9IHZhbHVlO1xuICAgICAgICBlbGVtZW50LnNldFNlbGVjdGlvblJhbmdlKHN0YXJ0LCBlbmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGVsZW1lbnQudmFsdWUgPSB2YWx1ZTtcbiAgICB9XG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHwgKHtfX3Byb3RvX186W119IGluc3RhbmNlb2YgQXJyYXkgPyBzZXRQcm90b09mIDogbWl4aW5Qcm9wZXJ0aWVzKTtcblxuZnVuY3Rpb24gc2V0UHJvdG9PZihvYmosIHByb3RvKSB7XG5cdG9iai5fX3Byb3RvX18gPSBwcm90bztcbn1cblxuZnVuY3Rpb24gbWl4aW5Qcm9wZXJ0aWVzKG9iaiwgcHJvdG8pIHtcblx0Zm9yICh2YXIgcHJvcCBpbiBwcm90bykge1xuXHRcdG9ialtwcm9wXSA9IHByb3RvW3Byb3BdO1xuXHR9XG59XG4iLCJ2YXIgcGxhY2Vob2xkZXIgPSB7fSxcbiAgICBlbmRPZkFyZ3MgPSB7fSxcbiAgICBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsLmJpbmQoQXJyYXkucHJvdG90eXBlLnNsaWNlKTtcblxuZnVuY3Rpb24gc2h1dihmbil7XG4gICAgdmFyIG91dGVyQXJncyA9IHNsaWNlKGFyZ3VtZW50cywgMSk7XG5cbiAgICBpZih0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIG9yIG5vbi1mdW5jdGlvbiBwYXNzZWQgdG8gc2h1dicpO1xuICAgIH1cblxuICAgIHJldHVybiBmdW5jdGlvbigpe1xuICAgICAgICB2YXIgY29udGV4dCA9IHRoaXMsXG4gICAgICAgICAgICBpbm5lckFyZ3MgPSBzbGljZShhcmd1bWVudHMpLFxuICAgICAgICAgICAgZmluYWxBcmdzID0gW10sXG4gICAgICAgICAgICBhcHBlbmQgPSB0cnVlO1xuXG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBvdXRlckFyZ3MubGVuZ3RoOyBpKyspe1xuICAgICAgICAgICAgdmFyIG91dGVyQXJnID0gb3V0ZXJBcmdzW2ldO1xuXG4gICAgICAgICAgICBpZihvdXRlckFyZyA9PT0gZW5kT2ZBcmdzKXtcbiAgICAgICAgICAgICAgICBhcHBlbmQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYob3V0ZXJBcmcgPT09IHBsYWNlaG9sZGVyKXtcbiAgICAgICAgICAgICAgICBmaW5hbEFyZ3MucHVzaChpbm5lckFyZ3Muc2hpZnQoKSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGZpbmFsQXJncy5wdXNoKG91dGVyQXJnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKGFwcGVuZCl7XG4gICAgICAgICAgICBmaW5hbEFyZ3MgPSBmaW5hbEFyZ3MuY29uY2F0KGlubmVyQXJncyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZm4uYXBwbHkoY29udGV4dCwgZmluYWxBcmdzKTtcbiAgICB9O1xufVxuXG5zaHV2Ll8gPSBwbGFjZWhvbGRlcjtcbnNodXYuJCA9IGVuZE9mQXJncztcblxubW9kdWxlLmV4cG9ydHMgPSBzaHV2OyIsInZhciBjbG9uZSA9IHJlcXVpcmUoJ2Nsb25lJyksXG4gICAgZGVlcEVxdWFsID0gcmVxdWlyZSgnZGVlcC1lcXVhbCcpO1xuXG5mdW5jdGlvbiBrZXlzQXJlRGlmZmVyZW50KGtleXMxLCBrZXlzMil7XG4gICAgaWYoa2V5czEgPT09IGtleXMyKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZigha2V5czEgfHwgIWtleXMyIHx8IGtleXMxLmxlbmd0aCAhPT0ga2V5czIubGVuZ3RoKXtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBrZXlzMS5sZW5ndGg7IGkrKyl7XG4gICAgICAgIGlmKCF+a2V5czIuaW5kZXhPZihrZXlzMVtpXSkpe1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldEtleXModmFsdWUpe1xuICAgIGlmKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHJldHVybiBPYmplY3Qua2V5cyh2YWx1ZSk7XG59XG5cbmZ1bmN0aW9uIFdoYXRDaGFuZ2VkKHZhbHVlLCBjaGFuZ2VzVG9UcmFjayl7XG4gICAgdGhpcy5fY2hhbmdlc1RvVHJhY2sgPSB7fTtcblxuICAgIGlmKGNoYW5nZXNUb1RyYWNrID09IG51bGwpe1xuICAgICAgICBjaGFuZ2VzVG9UcmFjayA9ICd2YWx1ZSB0eXBlIGtleXMgc3RydWN0dXJlIHJlZmVyZW5jZSc7XG4gICAgfVxuXG4gICAgaWYodHlwZW9mIGNoYW5nZXNUb1RyYWNrICE9PSAnc3RyaW5nJyl7XG4gICAgICAgIHRocm93ICdjaGFuZ2VzVG9UcmFjayBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nJztcbiAgICB9XG5cbiAgICBjaGFuZ2VzVG9UcmFjayA9IGNoYW5nZXNUb1RyYWNrLnNwbGl0KCcgJyk7XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoYW5nZXNUb1RyYWNrLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRoaXMuX2NoYW5nZXNUb1RyYWNrW2NoYW5nZXNUb1RyYWNrW2ldXSA9IHRydWU7XG4gICAgfTtcblxuICAgIHRoaXMudXBkYXRlKHZhbHVlKTtcbn1cbldoYXRDaGFuZ2VkLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbih2YWx1ZSl7XG4gICAgdmFyIHJlc3VsdCA9IHt9LFxuICAgICAgICBjaGFuZ2VzVG9UcmFjayA9IHRoaXMuX2NoYW5nZXNUb1RyYWNrLFxuICAgICAgICBuZXdLZXlzID0gZ2V0S2V5cyh2YWx1ZSk7XG5cbiAgICBpZigndmFsdWUnIGluIGNoYW5nZXNUb1RyYWNrICYmIHZhbHVlKycnICE9PSB0aGlzLl9sYXN0UmVmZXJlbmNlKycnKXtcbiAgICAgICAgcmVzdWx0LnZhbHVlID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYoXG4gICAgICAgICd0eXBlJyBpbiBjaGFuZ2VzVG9UcmFjayAmJiB0eXBlb2YgdmFsdWUgIT09IHR5cGVvZiB0aGlzLl9sYXN0VmFsdWUgfHxcbiAgICAgICAgKHZhbHVlID09PSBudWxsIHx8IHRoaXMuX2xhc3RWYWx1ZSA9PT0gbnVsbCkgJiYgdGhpcy52YWx1ZSAhPT0gdGhpcy5fbGFzdFZhbHVlIC8vIHR5cGVvZiBudWxsID09PSAnb2JqZWN0J1xuICAgICl7XG4gICAgICAgIHJlc3VsdC50eXBlID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYoJ2tleXMnIGluIGNoYW5nZXNUb1RyYWNrICYmIGtleXNBcmVEaWZmZXJlbnQodGhpcy5fbGFzdEtleXMsIGdldEtleXModmFsdWUpKSl7XG4gICAgICAgIHJlc3VsdC5rZXlzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZih2YWx1ZSAhPT0gbnVsbCAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyl7XG4gICAgICAgIHZhciBsYXN0VmFsdWUgPSB0aGlzLl9sYXN0VmFsdWU7XG5cbiAgICAgICAgaWYoJ3NoYWxsb3dTdHJ1Y3R1cmUnIGluIGNoYW5nZXNUb1RyYWNrICYmICghbGFzdFZhbHVlIHx8IHR5cGVvZiBsYXN0VmFsdWUgIT09ICdvYmplY3QnIHx8IE9iamVjdC5rZXlzKHZhbHVlKS5zb21lKGZ1bmN0aW9uKGtleSwgaW5kZXgpe1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlW2tleV0gIT09IGxhc3RWYWx1ZVtrZXldO1xuICAgICAgICB9KSkpe1xuICAgICAgICAgICAgcmVzdWx0LnNoYWxsb3dTdHJ1Y3R1cmUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmKCdzdHJ1Y3R1cmUnIGluIGNoYW5nZXNUb1RyYWNrICYmICFkZWVwRXF1YWwodmFsdWUsIGxhc3RWYWx1ZSkpe1xuICAgICAgICAgICAgcmVzdWx0LnN0cnVjdHVyZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYoJ3JlZmVyZW5jZScgaW4gY2hhbmdlc1RvVHJhY2sgJiYgdmFsdWUgIT09IHRoaXMuX2xhc3RSZWZlcmVuY2Upe1xuICAgICAgICAgICAgcmVzdWx0LnJlZmVyZW5jZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9sYXN0VmFsdWUgPSAnc3RydWN0dXJlJyBpbiBjaGFuZ2VzVG9UcmFjayA/IGNsb25lKHZhbHVlKSA6ICdzaGFsbG93U3RydWN0dXJlJyBpbiBjaGFuZ2VzVG9UcmFjayA/IGNsb25lKHZhbHVlLCB0cnVlLCAxKTogdmFsdWU7XG4gICAgdGhpcy5fbGFzdFJlZmVyZW5jZSA9IHZhbHVlO1xuICAgIHRoaXMuX2xhc3RLZXlzID0gbmV3S2V5cztcblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFdoYXRDaGFuZ2VkOyIsInZhciBwU2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG52YXIgb2JqZWN0S2V5cyA9IHJlcXVpcmUoJy4vbGliL2tleXMuanMnKTtcbnZhciBpc0FyZ3VtZW50cyA9IHJlcXVpcmUoJy4vbGliL2lzX2FyZ3VtZW50cy5qcycpO1xuXG52YXIgZGVlcEVxdWFsID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoYWN0dWFsLCBleHBlY3RlZCwgb3B0cykge1xuICBpZiAoIW9wdHMpIG9wdHMgPSB7fTtcbiAgLy8gNy4xLiBBbGwgaWRlbnRpY2FsIHZhbHVlcyBhcmUgZXF1aXZhbGVudCwgYXMgZGV0ZXJtaW5lZCBieSA9PT0uXG4gIGlmIChhY3R1YWwgPT09IGV4cGVjdGVkKSB7XG4gICAgcmV0dXJuIHRydWU7XG5cbiAgfSBlbHNlIGlmIChhY3R1YWwgaW5zdGFuY2VvZiBEYXRlICYmIGV4cGVjdGVkIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgIHJldHVybiBhY3R1YWwuZ2V0VGltZSgpID09PSBleHBlY3RlZC5nZXRUaW1lKCk7XG5cbiAgLy8gNy4zLiBPdGhlciBwYWlycyB0aGF0IGRvIG5vdCBib3RoIHBhc3MgdHlwZW9mIHZhbHVlID09ICdvYmplY3QnLFxuICAvLyBlcXVpdmFsZW5jZSBpcyBkZXRlcm1pbmVkIGJ5ID09LlxuICB9IGVsc2UgaWYgKHR5cGVvZiBhY3R1YWwgIT0gJ29iamVjdCcgJiYgdHlwZW9mIGV4cGVjdGVkICE9ICdvYmplY3QnKSB7XG4gICAgcmV0dXJuIG9wdHMuc3RyaWN0ID8gYWN0dWFsID09PSBleHBlY3RlZCA6IGFjdHVhbCA9PSBleHBlY3RlZDtcblxuICAvLyA3LjQuIEZvciBhbGwgb3RoZXIgT2JqZWN0IHBhaXJzLCBpbmNsdWRpbmcgQXJyYXkgb2JqZWN0cywgZXF1aXZhbGVuY2UgaXNcbiAgLy8gZGV0ZXJtaW5lZCBieSBoYXZpbmcgdGhlIHNhbWUgbnVtYmVyIG9mIG93bmVkIHByb3BlcnRpZXMgKGFzIHZlcmlmaWVkXG4gIC8vIHdpdGggT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKSwgdGhlIHNhbWUgc2V0IG9mIGtleXNcbiAgLy8gKGFsdGhvdWdoIG5vdCBuZWNlc3NhcmlseSB0aGUgc2FtZSBvcmRlciksIGVxdWl2YWxlbnQgdmFsdWVzIGZvciBldmVyeVxuICAvLyBjb3JyZXNwb25kaW5nIGtleSwgYW5kIGFuIGlkZW50aWNhbCAncHJvdG90eXBlJyBwcm9wZXJ0eS4gTm90ZTogdGhpc1xuICAvLyBhY2NvdW50cyBmb3IgYm90aCBuYW1lZCBhbmQgaW5kZXhlZCBwcm9wZXJ0aWVzIG9uIEFycmF5cy5cbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gb2JqRXF1aXYoYWN0dWFsLCBleHBlY3RlZCwgb3B0cyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWRPck51bGwodmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGlzQnVmZmVyICh4KSB7XG4gIGlmICgheCB8fCB0eXBlb2YgeCAhPT0gJ29iamVjdCcgfHwgdHlwZW9mIHgubGVuZ3RoICE9PSAnbnVtYmVyJykgcmV0dXJuIGZhbHNlO1xuICBpZiAodHlwZW9mIHguY29weSAhPT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgeC5zbGljZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAoeC5sZW5ndGggPiAwICYmIHR5cGVvZiB4WzBdICE9PSAnbnVtYmVyJykgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gb2JqRXF1aXYoYSwgYiwgb3B0cykge1xuICB2YXIgaSwga2V5O1xuICBpZiAoaXNVbmRlZmluZWRPck51bGwoYSkgfHwgaXNVbmRlZmluZWRPck51bGwoYikpXG4gICAgcmV0dXJuIGZhbHNlO1xuICAvLyBhbiBpZGVudGljYWwgJ3Byb3RvdHlwZScgcHJvcGVydHkuXG4gIGlmIChhLnByb3RvdHlwZSAhPT0gYi5wcm90b3R5cGUpIHJldHVybiBmYWxzZTtcbiAgLy9+fn5JJ3ZlIG1hbmFnZWQgdG8gYnJlYWsgT2JqZWN0LmtleXMgdGhyb3VnaCBzY3Jld3kgYXJndW1lbnRzIHBhc3NpbmcuXG4gIC8vICAgQ29udmVydGluZyB0byBhcnJheSBzb2x2ZXMgdGhlIHByb2JsZW0uXG4gIGlmIChpc0FyZ3VtZW50cyhhKSkge1xuICAgIGlmICghaXNBcmd1bWVudHMoYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgYSA9IHBTbGljZS5jYWxsKGEpO1xuICAgIGIgPSBwU2xpY2UuY2FsbChiKTtcbiAgICByZXR1cm4gZGVlcEVxdWFsKGEsIGIsIG9wdHMpO1xuICB9XG4gIGlmIChpc0J1ZmZlcihhKSkge1xuICAgIGlmICghaXNCdWZmZXIoYikpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuICAgIGZvciAoaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoYVtpXSAhPT0gYltpXSkgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB0cnkge1xuICAgIHZhciBrYSA9IG9iamVjdEtleXMoYSksXG4gICAgICAgIGtiID0gb2JqZWN0S2V5cyhiKTtcbiAgfSBjYXRjaCAoZSkgey8vaGFwcGVucyB3aGVuIG9uZSBpcyBhIHN0cmluZyBsaXRlcmFsIGFuZCB0aGUgb3RoZXIgaXNuJ3RcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgLy8gaGF2aW5nIHRoZSBzYW1lIG51bWJlciBvZiBvd25lZCBwcm9wZXJ0aWVzIChrZXlzIGluY29ycG9yYXRlc1xuICAvLyBoYXNPd25Qcm9wZXJ0eSlcbiAgaWYgKGthLmxlbmd0aCAhPSBrYi5sZW5ndGgpXG4gICAgcmV0dXJuIGZhbHNlO1xuICAvL3RoZSBzYW1lIHNldCBvZiBrZXlzIChhbHRob3VnaCBub3QgbmVjZXNzYXJpbHkgdGhlIHNhbWUgb3JkZXIpLFxuICBrYS5zb3J0KCk7XG4gIGtiLnNvcnQoKTtcbiAgLy9+fn5jaGVhcCBrZXkgdGVzdFxuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGlmIChrYVtpXSAhPSBrYltpXSlcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICAvL2VxdWl2YWxlbnQgdmFsdWVzIGZvciBldmVyeSBjb3JyZXNwb25kaW5nIGtleSwgYW5kXG4gIC8vfn5+cG9zc2libHkgZXhwZW5zaXZlIGRlZXAgdGVzdFxuICBmb3IgKGkgPSBrYS5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGtleSA9IGthW2ldO1xuICAgIGlmICghZGVlcEVxdWFsKGFba2V5XSwgYltrZXldLCBvcHRzKSkgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0eXBlb2YgYSA9PT0gdHlwZW9mIGI7XG59XG4iLCJ2YXIgc3VwcG9ydHNBcmd1bWVudHNDbGFzcyA9IChmdW5jdGlvbigpe1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyZ3VtZW50cylcbn0pKCkgPT0gJ1tvYmplY3QgQXJndW1lbnRzXSc7XG5cbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHN1cHBvcnRzQXJndW1lbnRzQ2xhc3MgPyBzdXBwb3J0ZWQgOiB1bnN1cHBvcnRlZDtcblxuZXhwb3J0cy5zdXBwb3J0ZWQgPSBzdXBwb3J0ZWQ7XG5mdW5jdGlvbiBzdXBwb3J0ZWQob2JqZWN0KSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqZWN0KSA9PSAnW29iamVjdCBBcmd1bWVudHNdJztcbn07XG5cbmV4cG9ydHMudW5zdXBwb3J0ZWQgPSB1bnN1cHBvcnRlZDtcbmZ1bmN0aW9uIHVuc3VwcG9ydGVkKG9iamVjdCl7XG4gIHJldHVybiBvYmplY3QgJiZcbiAgICB0eXBlb2Ygb2JqZWN0ID09ICdvYmplY3QnICYmXG4gICAgdHlwZW9mIG9iamVjdC5sZW5ndGggPT0gJ251bWJlcicgJiZcbiAgICBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCAnY2FsbGVlJykgJiZcbiAgICAhT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKG9iamVjdCwgJ2NhbGxlZScpIHx8XG4gICAgZmFsc2U7XG59O1xuIiwiZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gdHlwZW9mIE9iamVjdC5rZXlzID09PSAnZnVuY3Rpb24nXG4gID8gT2JqZWN0LmtleXMgOiBzaGltO1xuXG5leHBvcnRzLnNoaW0gPSBzaGltO1xuZnVuY3Rpb24gc2hpbSAob2JqKSB7XG4gIHZhciBrZXlzID0gW107XG4gIGZvciAodmFyIGtleSBpbiBvYmopIGtleXMucHVzaChrZXkpO1xuICByZXR1cm4ga2V5cztcbn1cbiIsInZhciBzYW1lVmFsdWUgPSByZXF1aXJlKCdzYW1lLXZhbHVlJyksXG4gICAgaXNJbnN0YW5jZSA9IHJlcXVpcmUoJ2lzLWluc3RhbmNlJyk7XG5cbnZhciBSRU1PVkVEID0gJ3InO1xudmFyIEFEREVEID0gJ2EnO1xudmFyIEVESVRFRCA9ICdlJztcblxudmFyIEFSUkFZID0gJ2EnO1xudmFyIEZVTkNUSU9OID0gJ2YnO1xudmFyIERBVEUgPSAnZCc7XG5cbmZ1bmN0aW9uIHNhbWUoYSwgYil7XG4gICAgaWYoaXNJbnN0YW5jZShhKSAmJiBhIGluc3RhbmNlb2YgRGF0ZSAmJiBhICE9PSBiKXtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBzYW1lVmFsdWUoYSwgYik7XG59XG5cbmZ1bmN0aW9uIGdldElkKGludCl7XG4gICAgaWYoaW50ID09PSAwKXtcbiAgICAgICAgcmV0dXJuICdyb290JztcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmlzY291c0lkICsgJzonICsgaW50LnRvU3RyaW5nKDM2KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSWQoKXtcbiAgICByZXR1cm4gdGhpcy5nZXRJZCh0aGlzLmN1cnJlbnRJZCsrKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSW5zdGFuY2VJbmZvKHNjb3BlLCBpZCwgdmFsdWUpe1xuICAgIHZhciBpbnN0YW5jZUluZm8gPSB7XG4gICAgICAgICAgICBpZDogaWQsXG4gICAgICAgICAgICBpbnN0YW5jZTogdmFsdWUsXG4gICAgICAgICAgICBsYXN0U3RhdGU6IHt9LFxuICAgICAgICAgICAgbmV3OiB0cnVlXG4gICAgICAgIH07XG5cbiAgICBzY29wZS5zZXRJbnN0YW5jZShpZCwgdmFsdWUpO1xuICAgIHNjb3BlLnRyYWNrZWRNYXAuc2V0KHZhbHVlLCBpbnN0YW5jZUluZm8pO1xuXG4gICAgcmV0dXJuIGluc3RhbmNlSW5mbztcbn1cblxuZnVuY3Rpb24gZ2V0SW5zdGFuY2VJbmZvKHNjb3BlLCB2YWx1ZSl7XG4gICAgaWYoIWlzSW5zdGFuY2UodmFsdWUpKXtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBpbnN0YW5jZUluZm8gPSBzY29wZS50cmFja2VkTWFwLmdldCh2YWx1ZSk7XG5cbiAgICBpZighaW5zdGFuY2VJbmZvKXtcbiAgICAgICAgaW5zdGFuY2VJbmZvID0gY3JlYXRlSW5zdGFuY2VJbmZvKHNjb3BlLCBzY29wZS5jcmVhdGVJZCgpLCB2YWx1ZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGluc3RhbmNlSW5mbztcbn1cblxuZnVuY3Rpb24gZ2V0SW5zdGFuY2VJZCh2YWx1ZSl7XG4gICAgdmFyIGluZm8gPSBnZXRJbnN0YW5jZUluZm8odGhpcywgdmFsdWUpO1xuXG4gICAgcmV0dXJuIGluZm8gJiYgaW5mby5pZDtcbn1cblxuZnVuY3Rpb24gZ2V0UmVtb3ZlZENoYW5nZShpbnN0YW5jZUluZm8sIG9iamVjdCwgb2xkS2V5KXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuXG4gICAgaWYoIShvbGRLZXkgaW4gb2JqZWN0KSl7XG4gICAgICAgIHZhciBvbGRWYWx1ZSA9IGluc3RhbmNlSW5mby5sYXN0U3RhdGVbb2xkS2V5XTtcbiAgICAgICAgdGhpcy5uZXh0Q2hhbmdlLnB1c2goW2luc3RhbmNlSW5mby5pZCwgb2xkS2V5LCBSRU1PVkVEXSk7XG5cbiAgICAgICAgZGVsZXRlIGluc3RhbmNlSW5mby5sYXN0U3RhdGVbb2xkS2V5XTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldFJlbW92ZWRDaGFuZ2VzKGluc3RhbmNlSW5mbywgb2JqZWN0KXtcbiAgICBmdW5jdGlvbiBnZXRDaGFuZ2Uob2xkS2V5KXtcbiAgICAgICAgdGhpcy5nZXRSZW1vdmVkQ2hhbmdlKGluc3RhbmNlSW5mbywgb2JqZWN0LCBvbGRLZXkpO1xuICAgIH1cblxuICAgIE9iamVjdC5rZXlzKGluc3RhbmNlSW5mby5sYXN0U3RhdGUpLmZvckVhY2goZ2V0Q2hhbmdlLCB0aGlzKTtcbn1cblxuZnVuY3Rpb24gZ2V0Q3VycmVudENoYW5nZShpbnN0YW5jZUluZm8sIGluc3RhbmNlLCBjdXJyZW50S2V5KXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuXG4gICAgdmFyIHR5cGUgPSBpbnN0YW5jZUluZm8ubGFzdFN0YXRlLmhhc093blByb3BlcnR5KGN1cnJlbnRLZXkpID8gRURJVEVEIDogQURERUQsXG4gICAgICAgIG9sZFZhbHVlID0gaW5zdGFuY2VJbmZvLmxhc3RTdGF0ZVtjdXJyZW50S2V5XSxcbiAgICAgICAgY3VycmVudFZhbHVlID0gaW5zdGFuY2VbY3VycmVudEtleV0sXG4gICAgICAgIGNoYW5nZSA9IFtpbnN0YW5jZUluZm8uaWQsIGN1cnJlbnRLZXksIHR5cGVdLFxuICAgICAgICBjaGFuZ2VkID0gIXNhbWUob2xkVmFsdWUsIGN1cnJlbnRWYWx1ZSk7XG5cbiAgICBpZihjaGFuZ2VkIHx8IHR5cGUgPT09IEFEREVEKXtcbiAgICAgICAgaW5zdGFuY2VJbmZvLmxhc3RTdGF0ZVtjdXJyZW50S2V5XSA9IGN1cnJlbnRWYWx1ZTtcbiAgICAgICAgdGhpcy5uZXh0Q2hhbmdlLnB1c2goY2hhbmdlKTtcbiAgICB9XG5cbiAgICBpZighaXNJbnN0YW5jZShjdXJyZW50VmFsdWUpKXtcbiAgICAgICAgY2hhbmdlLnB1c2goY3VycmVudFZhbHVlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBpbnN0YW5jZUlkID0gc2NvcGUuZ2V0SW5zdGFuY2VJZChpbnN0YW5jZVtjdXJyZW50S2V5XSk7XG5cbiAgICBzY29wZS5jdXJyZW50SW5zdGFuY2VzLmFkZChpbnN0YW5jZUlkKTtcblxuICAgIHNjb3BlLmdldE9iamVjdENoYW5nZXMoY3VycmVudFZhbHVlKTtcblxuICAgIGlmKGNoYW5nZWQpe1xuICAgICAgICBjaGFuZ2UucHVzaChbaW5zdGFuY2VJZF0pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0Q3VycmVudENoYW5nZXMoaW5zdGFuY2VJbmZvLCBpbnN0YW5jZSl7XG4gICAgZnVuY3Rpb24gZ2V0Q2hhbmdlKGN1cnJlbnRLZXkpe1xuICAgICAgICB0aGlzLmdldEN1cnJlbnRDaGFuZ2UoaW5zdGFuY2VJbmZvLCBpbnN0YW5jZSwgY3VycmVudEtleSk7XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXMoaW5zdGFuY2UpLmZvckVhY2goZ2V0Q2hhbmdlLCB0aGlzKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSW5zdGFuY2VEZWZpbml0aW9uKHNjb3BlLCBpbnN0YW5jZSl7XG4gICAgdmFyIHJlc3VsdCA9IHNjb3BlLnNldHRpbmdzLnNlcmlhbGlzZXIoaW5zdGFuY2UpO1xuXG4gICAgaWYoIXJlc3VsdCl7XG4gICAgICAgIHJlc3VsdCA9IFtdO1xuICAgICAgICB2YXIgdmFsdWUgPSBpbnN0YW5jZTtcblxuICAgICAgICBpZih2YWx1ZSBpbnN0YW5jZW9mIERhdGUpe1xuICAgICAgICAgICAgcmV0dXJuIFt2YWx1ZS50b0lTT1N0cmluZygpLCBEQVRFXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyl7XG4gICAgICAgICAgICByZXN1bHQucHVzaChmdW5jdGlvbigpe3JldHVybiBpbnN0YW5jZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpfSwgRlVOQ1RJT04pO1xuICAgICAgICB9ZWxzZSBpZihBcnJheS5pc0FycmF5KHZhbHVlKSl7XG4gICAgICAgICAgICByZXN1bHQucHVzaCh7fSwgQVJSQVkpO1xuICAgICAgICB9ZWxzZSBpZih2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKXtcbiAgICAgICAgICAgIHJlc3VsdC5wdXNoKHt9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIE9iamVjdC5rZXlzKGluc3RhbmNlKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIHZhciBpZCA9IHNjb3BlLmdldEluc3RhbmNlSWQoaW5zdGFuY2Vba2V5XSk7XG4gICAgICAgIHJlc3VsdFswXVtrZXldID0gaWQgPyBbaWRdIDogaW5zdGFuY2Vba2V5XTtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGdldE9iamVjdENoYW5nZXMob2JqZWN0KXtcbiAgICBpZih0aGlzLnNjYW5uZWQuaGFzKG9iamVjdCkpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuc2Nhbm5lZC5hZGQob2JqZWN0KTtcblxuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICB2YXIgaW5zdGFuY2VJbmZvID0gZ2V0SW5zdGFuY2VJbmZvKHNjb3BlLCBvYmplY3QpLFxuICAgICAgICBpc05ldyA9IGluc3RhbmNlSW5mby5uZXcgJiYgb2JqZWN0ICE9PSBzY29wZS5zdGF0ZTtcblxuICAgIHNjb3BlLmdldFJlbW92ZWRDaGFuZ2VzKGluc3RhbmNlSW5mbywgb2JqZWN0KTtcbiAgICBzY29wZS5nZXRDdXJyZW50Q2hhbmdlcyhpbnN0YW5jZUluZm8sIG9iamVjdCk7XG5cbiAgICBpZighaXNOZXcpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaW5zdGFuY2VJbmZvLm5ldyA9IGZhbHNlO1xuICAgIHRoaXMubmV4dENoYW5nZVswXS5wdXNoKFtpbnN0YW5jZUluZm8uaWQsIGNyZWF0ZUluc3RhbmNlRGVmaW5pdGlvbihzY29wZSwgb2JqZWN0KV0pO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVHYXJiYWdlQ2hhbmdlKGlkKXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuICAgIGlmKCFzY29wZS5jdXJyZW50SW5zdGFuY2VzLmhhcyhpZCkpe1xuICAgICAgICBzY29wZS50cmFja2VkTWFwLmRlbGV0ZShzY29wZS5nZXRJbnN0YW5jZShpZCkpO1xuICAgICAgICBzY29wZS5yZW1vdmVJbnN0YW5jZShpZCk7XG4gICAgICAgIHNjb3BlLm5leHRDaGFuZ2VbMF0udW5zaGlmdChbaWQsIFJFTU9WRURdKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGNoYW5nZXMoKXtcbiAgICB2YXIgc2NvcGUgPSB0aGlzO1xuXG4gICAgLy8gVGhpcyBpcyBob3cgbm90IHRvIHdyaXRlIGNvZGUgMTAxLFxuICAgIC8vIEJ1dCBhbnl0aGluZyBpbiB0aGUgbmFtZSBvZiBwZXJmb3JtYW5jZSA6UFxuXG4gICAgc2NvcGUubmV4dENoYW5nZVswXSA9IFtdO1xuICAgIHNjb3BlLnNjYW5uZWQgPSBuZXcgV2Vha1NldCgpO1xuICAgIHNjb3BlLmN1cnJlbnRJbnN0YW5jZXMuY2xlYXIoKTtcbiAgICBzY29wZS5jdXJyZW50SW5zdGFuY2VzLmFkZCh0aGlzLmdldElkKDApKTtcblxuICAgIHNjb3BlLmdldE9iamVjdENoYW5nZXMoc2NvcGUuc3RhdGUpO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5pbnN0YW5jZXMpLmZvckVhY2goY3JlYXRlR2FyYmFnZUNoYW5nZSwgdGhpcyk7XG5cbiAgICByZXR1cm4gc2NvcGUubmV4dENoYW5nZS5zcGxpY2UoMCwgc2NvcGUubmV4dENoYW5nZS5sZW5ndGgpO1xufVxuXG5mdW5jdGlvbiBnZXRTdGF0ZSgpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBzY29wZS5jaGFuZ2VzKCk7XG5cbiAgICByZXR1cm4gW09iamVjdC5rZXlzKHNjb3BlLmluc3RhbmNlcykucmV2ZXJzZSgpLm1hcChmdW5jdGlvbihrZXkpe1xuICAgICAgICByZXR1cm4gW2tleSwgY3JlYXRlSW5zdGFuY2VEZWZpbml0aW9uKHNjb3BlLCBzY29wZS5pbnN0YW5jZXNba2V5XSldO1xuICAgIH0pXTtcbn1cblxuZnVuY3Rpb24gYXBwbHlPYmplY3RDaGFuZ2UodGFyZ2V0LCBuZXdTdGF0ZSwgdG9JbmZsYXRlKXtcbiAgICBpZihBcnJheS5pc0FycmF5KG5ld1N0YXRlKSl7XG4gICAgICAgIG5ld1N0YXRlID0gbmV3U3RhdGVbMF07XG4gICAgICAgIHRvSW5mbGF0ZS5wdXNoKFt0YXJnZXQsIG5ld1N0YXRlXSk7XG4gICAgfVxuXG4gICAgT2JqZWN0LmtleXModGFyZ2V0KS5mb3JFYWNoKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIGlmKCFrZXkgaW4gbmV3U3RhdGUpe1xuICAgICAgICAgICAgZGVsZXRlIHRhcmdldFtrZXldO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBPYmplY3Qua2V5cyhuZXdTdGF0ZSkuZm9yRWFjaChmdW5jdGlvbihrZXkpe1xuICAgICAgICB0YXJnZXRba2V5XSA9IG5ld1N0YXRlW2tleV07XG4gICAgfSk7XG59XG5cbmZ1bmN0aW9uIGFwcGx5Um9vdENoYW5nZShzY29wZSwgbmV3U3RhdGUsIHRvSW5mbGF0ZSl7XG4gICAgYXBwbHlPYmplY3RDaGFuZ2Uoc2NvcGUuc3RhdGUsIG5ld1N0YXRlLCB0b0luZmxhdGUpO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlRGVmaW5pdGlvbihzY29wZSwgcmVzdWx0LCBwcm9wZXJ0aWVzKXtcbiAgICBPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5mb3JFYWNoKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgIGlmKEFycmF5LmlzQXJyYXkocHJvcGVydGllc1trZXldKSl7XG4gICAgICAgICAgICByZXN1bHRba2V5XSA9IHNjb3BlLmdldEluc3RhbmNlKHByb3BlcnRpZXNba2V5XVswXSk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgcmVzdWx0W2tleV0gPSBwcm9wZXJ0aWVzW2tleV07XG4gICAgICAgIH1cbiAgICB9KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlSW5zdGFuY2Uoc2NvcGUsIGRlZmluaXRpb24sIHRvSW5mbGF0ZSl7XG4gICAgaWYoQXJyYXkuaXNBcnJheShkZWZpbml0aW9uKSl7XG4gICAgICAgIHZhciB0eXBlID0gZGVmaW5pdGlvblsxXSxcbiAgICAgICAgICAgIHByb3BlcnRpZXMgPSBkZWZpbml0aW9uWzBdO1xuXG4gICAgICAgIHZhciByZXN1bHQgPSBzY29wZS5zZXR0aW5ncy5kZXNlcmlhbGlzZXIoZGVmaW5pdGlvbik7XG5cbiAgICAgICAgaWYocmVzdWx0KXtcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZighdHlwZSl7XG4gICAgICAgICAgICByZXN1bHQgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBpZih0eXBlID09PSBBUlJBWSl7XG4gICAgICAgICAgICByZXN1bHQgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBpZih0eXBlID09PSBGVU5DVElPTil7XG4gICAgICAgICAgICByZXN1bHQgPSBwcm9wZXJ0aWVzO1xuICAgICAgICB9XG4gICAgICAgIGlmKHR5cGUgPT09IERBVEUpe1xuICAgICAgICAgICAgcmVzdWx0ID0gbmV3IERhdGUocHJvcGVydGllcyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZihpc0luc3RhbmNlKHJlc3VsdCkpe1xuICAgICAgICAgICAgdG9JbmZsYXRlLnB1c2goW3Jlc3VsdCwgcHJvcGVydGllc10pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5KGNoYW5nZXMpe1xuICAgIHZhciBzY29wZSA9IHRoaXMsXG4gICAgICAgIGluc3RhbmNlQ2hhbmdlcyA9IGNoYW5nZXNbMF0sXG4gICAgICAgIHRvSW5mbGF0ZSA9IFtdO1xuXG4gICAgaW5zdGFuY2VDaGFuZ2VzLmZvckVhY2goZnVuY3Rpb24oaW5zdGFuY2VDaGFuZ2Upe1xuICAgICAgICBpZihpbnN0YW5jZUNoYW5nZVsxXSA9PT0gUkVNT1ZFRCl7XG4gICAgICAgICAgICB2YXIgaW5zdGFuY2UgPSBzY29wZS5nZXRJbnN0YW5jZShpbnN0YW5jZUNoYW5nZVswXSk7XG4gICAgICAgICAgICBzY29wZS50cmFja2VkTWFwLmRlbGV0ZShpbnN0YW5jZSk7XG4gICAgICAgICAgICBzY29wZS5yZW1vdmVJbnN0YW5jZShpbnN0YW5jZUNoYW5nZVswXSk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgaWYoc2NvcGUuZ2V0SW5zdGFuY2UoaW5zdGFuY2VDaGFuZ2VbMF0pID09PSBzY29wZS5zdGF0ZSl7XG4gICAgICAgICAgICAgICAgYXBwbHlSb290Q2hhbmdlKHNjb3BlLCBpbnN0YW5jZUNoYW5nZVsxXSwgdG9JbmZsYXRlKTtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIHZhciBleGlzdGluZ0luc3RhbmNlID0gc2NvcGUuZ2V0SW5zdGFuY2UoaW5zdGFuY2VDaGFuZ2VbMF0pO1xuXG4gICAgICAgICAgICAgICAgaWYoZXhpc3RpbmdJbnN0YW5jZSl7XG4gICAgICAgICAgICAgICAgICAgIHRvSW5mbGF0ZS5wdXNoKFtleGlzdGluZ0luc3RhbmNlLCBpbnN0YW5jZUNoYW5nZVsxXVswXV0pO1xuICAgICAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgICAgIGNyZWF0ZUluc3RhbmNlSW5mbyhzY29wZSwgaW5zdGFuY2VDaGFuZ2VbMF0sIGNyZWF0ZUluc3RhbmNlKHNjb3BlLCBpbnN0YW5jZUNoYW5nZVsxXSwgdG9JbmZsYXRlKSk7XG4gICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9KTtcblxuICAgIHRvSW5mbGF0ZS5mb3JFYWNoKGZ1bmN0aW9uKGNoYW5nZSl7XG4gICAgICAgIGluZmxhdGVEZWZpbml0aW9uKHNjb3BlLCBjaGFuZ2VbMF0sIGNoYW5nZVsxXSk7XG4gICAgfSk7XG5cbiAgICBmb3IodmFyIGkgPSAxOyBpIDwgY2hhbmdlcy5sZW5ndGg7IGkrKyl7XG4gICAgICAgIHZhciBjaGFuZ2UgPSBjaGFuZ2VzW2ldO1xuXG4gICAgICAgIGlmKGNoYW5nZVsyXSA9PT0gUkVNT1ZFRCl7XG4gICAgICAgICAgICBkZWxldGUgc2NvcGUuZ2V0SW5zdGFuY2UoY2hhbmdlWzBdKVtjaGFuZ2VbMV1dO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHZhciB2YWx1ZSA9IGNoYW5nZVszXTtcblxuICAgICAgICAgICAgaWYoQXJyYXkuaXNBcnJheShjaGFuZ2VbM10pKXtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHNjb3BlLmdldEluc3RhbmNlKGNoYW5nZVszXSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHNjb3BlLmdldEluc3RhbmNlKGNoYW5nZVswXSlbY2hhbmdlWzFdXSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRJbnN0YW5jZUJ5SWQoaWQpe1xuICAgIHJldHVybiB0aGlzLmluc3RhbmNlc1tpZF07XG59XG5cbmZ1bmN0aW9uIHNldEluc3RhbmNlQnlJZChpZCwgdmFsdWUpe1xuICAgIHRoaXMuaW5zdGFuY2VzW2lkXSA9IHZhbHVlO1xufVxuXG5mdW5jdGlvbiByZW1vdmVJbnN0YW5jZUJ5SWQoaWQpe1xuICAgIGRlbGV0ZSB0aGlzLmluc3RhbmNlc1tpZF07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkSWRNYXAoc2NvcGUsIGRhdGEsIGlkcyl7XG4gICAgaWYoIWlzSW5zdGFuY2UoZGF0YSkpe1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYoc2NvcGUudHJhY2tlZE1hcC5oYXMoZGF0YSkpe1xuICAgICAgICBpZHNbc2NvcGUuZ2V0SW5zdGFuY2VJZChkYXRhKV0gPSBkYXRhO1xuICAgICAgICByZXR1cm4gaWRzO1xuICAgIH1cblxuICAgIGlkc1tzY29wZS5nZXRJbnN0YW5jZUlkKGRhdGEpXSA9IGRhdGE7XG5cbiAgICBmb3IodmFyIGtleSBpbiBkYXRhKXtcbiAgICAgICAgYnVpbGRJZE1hcChzY29wZSwgZGF0YVtrZXldLCBpZHMpO1xuICAgIH1cblxuICAgIHJldHVybiBpZHM7XG59XG5cbmZ1bmN0aW9uIGRlc2NyaWJlKGRhdGEpe1xuICAgIHZhciBzY29wZSA9IHRoaXM7XG5cbiAgICBpZihpc0luc3RhbmNlKGRhdGEpKXtcbiAgICAgICAgaWYoc2NvcGUudHJhY2tlZE1hcC5oYXMoZGF0YSkpe1xuICAgICAgICAgICAgcmV0dXJuIFtzY29wZS5nZXRJbnN0YW5jZUlkKGRhdGEpXTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpZHMgPSBidWlsZElkTWFwKHNjb3BlLCBkYXRhLCB7fSk7XG5cbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKGlkcykubWFwKGZ1bmN0aW9uKGtleSl7XG4gICAgICAgICAgICByZXR1cm4gW2tleSwgY3JlYXRlSW5zdGFuY2VEZWZpbml0aW9uKHNjb3BlLCBzY29wZS5pbnN0YW5jZXNba2V5XSldO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGF0YTtcbn1cblxuZnVuY3Rpb24gaW5mbGF0ZShkZXNjcmlwdGlvbil7XG4gICAgdmFyIHNjb3BlID0gdGhpcztcblxuICAgIGlmKEFycmF5LmlzQXJyYXkoZGVzY3JpcHRpb24pICYmIHR5cGVvZiBkZXNjcmlwdGlvblswXSA9PT0gJ3N0cmluZycpe1xuICAgICAgICByZXR1cm4gc2NvcGUuZ2V0SW5zdGFuY2UoZGVzY3JpcHRpb25bMF0pO1xuICAgIH1cblxuICAgIGlmKGlzSW5zdGFuY2UoZGVzY3JpcHRpb24pKXtcbiAgICAgICAgdmFyIHRvSW5mbGF0ZSA9IFtdO1xuXG4gICAgICAgIHNjb3BlLnZpc2NvdXMuYXBwbHkoW2Rlc2NyaXB0aW9uXSk7XG5cbiAgICAgICAgcmV0dXJuIHNjb3BlLmdldEluc3RhbmNlKGRlc2NyaXB0aW9uWzBdWzBdKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGVzY3JpcHRpb247XG59XG5cbmZ1bmN0aW9uIHZpc2NvdXMoc3RhdGUsIHNldHRpbmdzKXtcbiAgICBpZighc2V0dGluZ3Mpe1xuICAgICAgICBzZXR0aW5ncyA9IHtcbiAgICAgICAgICAgIHNlcmlhbGlzZXI6IGZ1bmN0aW9uKCl7fSxcbiAgICAgICAgICAgIGRlc2VyaWFsaXNlcjogZnVuY3Rpb24oKXt9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgdmFyIHZpc2NvdXMgPSB7fTtcblxuICAgIHZhciBzY29wZSA9IHtcbiAgICAgICAgbmV4dENoYW5nZTogW10sXG4gICAgICAgIGN1cnJlbnRJbnN0YW5jZXM6IG5ldyBTZXQoKSxcbiAgICAgICAgc2V0dGluZ3M6IHNldHRpbmdzLFxuICAgICAgICB2aXNjb3VzOiB2aXNjb3VzLFxuICAgICAgICB2aXNjb3VzSWQ6IHNldHRpbmdzLnZpc2NvdXNJZCB8fCBwYXJzZUludChNYXRoLnJhbmRvbSgpICogTWF0aC5wb3coMzYsMikpLnRvU3RyaW5nKDM2KSxcbiAgICAgICAgY3VycmVudElkOiAwLFxuICAgICAgICBzdGF0ZTogc3RhdGUgfHwge30sXG4gICAgICAgIHRyYWNrZWRNYXA6IG5ldyBXZWFrTWFwKCksXG4gICAgICAgIGluc3RhbmNlczoge31cbiAgICB9O1xuXG4gICAgLy8gU2NvcGUgYm91bmQgZm9yIHBlcmYuXG4gICAgc2NvcGUuZ2V0Q3VycmVudENoYW5nZXMgPSBnZXRDdXJyZW50Q2hhbmdlcy5iaW5kKHNjb3BlKTtcbiAgICBzY29wZS5nZXRDdXJyZW50Q2hhbmdlID0gZ2V0Q3VycmVudENoYW5nZS5iaW5kKHNjb3BlKTtcbiAgICBzY29wZS5nZXRSZW1vdmVkQ2hhbmdlcyA9IGdldFJlbW92ZWRDaGFuZ2VzLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmdldFJlbW92ZWRDaGFuZ2UgPSBnZXRSZW1vdmVkQ2hhbmdlLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmdldE9iamVjdENoYW5nZXMgPSBnZXRPYmplY3RDaGFuZ2VzLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmdldEluc3RhbmNlID0gZ2V0SW5zdGFuY2VCeUlkLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLnNldEluc3RhbmNlID0gc2V0SW5zdGFuY2VCeUlkLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLnJlbW92ZUluc3RhbmNlID0gcmVtb3ZlSW5zdGFuY2VCeUlkLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmdldEluc3RhbmNlSWQgPSBnZXRJbnN0YW5jZUlkLmJpbmQoc2NvcGUpO1xuICAgIHNjb3BlLmNoYW5nZXMgPSBjaGFuZ2VzLmJpbmQoc2NvcGUpO1xuXG4gICAgc2NvcGUuZ2V0SWQgPSBnZXRJZC5iaW5kKHNjb3BlKTtcbiAgICBzY29wZS5jcmVhdGVJZCA9IGNyZWF0ZUlkLmJpbmQoc2NvcGUpO1xuXG4gICAgdmlzY291cy5jaGFuZ2VzID0gc2NvcGUuY2hhbmdlcztcbiAgICB2aXNjb3VzLmFwcGx5ID0gYXBwbHkuYmluZChzY29wZSk7XG4gICAgdmlzY291cy5zdGF0ZSA9IGdldFN0YXRlLmJpbmQoc2NvcGUpO1xuICAgIHZpc2NvdXMuZ2V0SWQgPSBzY29wZS5nZXRJbnN0YW5jZUlkO1xuICAgIHZpc2NvdXMuZ2V0SW5zdGFuY2UgPSBzY29wZS5nZXRJbnN0YW5jZTtcbiAgICB2aXNjb3VzLmRlc2NyaWJlID0gZGVzY3JpYmUuYmluZChzY29wZSk7XG4gICAgdmlzY291cy5pbmZsYXRlID0gaW5mbGF0ZS5iaW5kKHNjb3BlKTtcblxuICAgIHZpc2NvdXMuY2hhbmdlcygpO1xuXG4gICAgcmV0dXJuIHZpc2NvdXM7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdmlzY291cztcbiJdfQ==
