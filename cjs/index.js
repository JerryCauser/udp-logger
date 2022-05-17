var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target, mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
var __accessCheck = (obj, member, msg) => {
  if (!member.has(obj))
    throw TypeError("Cannot " + msg);
};
var __privateGet = (obj, member, getter) => {
  __accessCheck(obj, member, "read from private field");
  return getter ? getter.call(obj) : member.get(obj);
};
var __privateAdd = (obj, member, value) => {
  if (member.has(obj))
    throw TypeError("Cannot add the same private member more than once");
  member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
};
var __privateSet = (obj, member, value, setter) => {
  __accessCheck(obj, member, "write to private field");
  setter ? setter.call(obj, value) : member.set(obj, value);
  return value;
};
var __privateMethod = (obj, member, method) => {
  __accessCheck(obj, member, "access private method");
  return method;
};

// index.js
var udp_logger_exports = {};
__export(udp_logger_exports, {
  UDPLoggerClient: () => client_default,
  UDPLoggerServer: () => server_default,
  UDPLoggerSocket: () => socket_default,
  constants: () => constants_exports
});
module.exports = __toCommonJS(udp_logger_exports);

// src/socket.js
var import_node_events = __toESM(require("events"), 1);
var import_node_crypto2 = __toESM(require("crypto"), 1);
var import_node_dgram = __toESM(require("dgram"), 1);
var import_node_buffer2 = require("buffer");
var import_node_stream = require("stream");

// src/identifier.js
var import_node_crypto = __toESM(require("crypto"), 1);
var import_node_buffer = require("buffer");
var ID_SIZE = 16;
var DATE_SIZE = 6;
var INCREMENTAL_SIZE = 4;
var INCREMENTAL_EDGE = import_node_buffer.Buffer.alloc(INCREMENTAL_SIZE).fill(255).readUIntBE(0, INCREMENTAL_SIZE);
var TIME_META_SIZE = DATE_SIZE + INCREMENTAL_SIZE;
var SLICE_SIZE = ID_SIZE - TIME_META_SIZE;
var CACHE_SIZE = 2048 * SLICE_SIZE;
var CACHE_BUFFER = import_node_buffer.Buffer.alloc(CACHE_SIZE);
var BUFFER_COMPARE_SORT_FUNCTION = (a, b) => a.compare(b, 0, TIME_META_SIZE, 0, TIME_META_SIZE);
var incrementId = 0;
var cacheOffset = 0;
function refreshCache() {
  cacheOffset = 0;
  import_node_crypto.default.randomFillSync(CACHE_BUFFER, 0, CACHE_SIZE);
}
refreshCache();
function generateId() {
  if (cacheOffset >= CACHE_SIZE)
    refreshCache();
  const id = import_node_buffer.Buffer.alloc(ID_SIZE);
  id.set([
    CACHE_BUFFER[cacheOffset],
    CACHE_BUFFER[cacheOffset + 1],
    CACHE_BUFFER[cacheOffset + 2],
    CACHE_BUFFER[cacheOffset + 3],
    CACHE_BUFFER[cacheOffset + 4],
    CACHE_BUFFER[cacheOffset + 5]
  ], TIME_META_SIZE);
  cacheOffset += SLICE_SIZE;
  incrementId = ++incrementId & INCREMENTAL_EDGE;
  id.writeUIntBE(Date.now(), 0, DATE_SIZE);
  id.writeUIntBE(incrementId, DATE_SIZE, INCREMENTAL_SIZE);
  return id;
}
function parseId(buffer) {
  if (buffer.length !== ID_SIZE)
    throw new Error("id_size_not_valid");
  const date = new Date(buffer.readUintBE(0, 6));
  const id = buffer.toString("hex");
  return [date, id];
}

// src/constants.js
var constants_exports = {};
__export(constants_exports, {
  DEFAULT_MESSAGE_FORMATTER: () => DEFAULT_MESSAGE_FORMATTER,
  DEFAULT_SERIALIZER: () => DEFAULT_SERIALIZER
});
var import_node_v8 = __toESM(require("v8"), 1);
var import_node_util = __toESM(require("util"), 1);
var DEFAULT_MESSAGE_FORMATTER = (msg, date) => {
  return `${date.toISOString()}|${msg}
`;
};
var DEFAULT_FORMAT_OPTIONS = {
  depth: null,
  maxStringLength: null,
  maxArrayLength: null,
  breakLength: 80
};
var DEFAULT_SERIALIZER = (buffer) => {
  const data = import_node_v8.default.deserialize(buffer);
  data.unshift(DEFAULT_FORMAT_OPTIONS);
  return import_node_util.default.formatWithOptions.apply(import_node_util.default, data);
};

// src/socket.js
var _port, _address, _type, _decryptionAlgorithm, _decryptionSecret, _socket, _deserializer, _formatMessage, _collector, _collectorIntervalId, _collectorIntervalTime, _allowPush, _messages, _handleSocketMessage, _start, start_fn, _stop, stop_fn, _initSocket, initSocket_fn, _attachHandlers, attachHandlers_fn, _detachHandlers, detachHandlers_fn, _handleSocketClose, _handleSocketError, _handlePlainMessage, _decryptMessage, decryptMessage_fn, _handleEncryptedMessage, _collectorIntervalFunction, _compileMessage, compileMessage_fn, _compileMessageUnsafe, compileMessageUnsafe_fn;
var UDPLoggerSocket = class extends import_node_stream.Readable {
  constructor(_a = {}) {
    var _b = _a, {
      type = "udp4",
      port = 44002,
      decryption,
      collectorInterval = 1e3,
      deserializer = DEFAULT_SERIALIZER,
      formatMessage = DEFAULT_MESSAGE_FORMATTER
    } = _b, options = __objRest(_b, [
      "type",
      "port",
      "decryption",
      "collectorInterval",
      "deserializer",
      "formatMessage"
    ]);
    var _a2;
    super(options);
    __privateAdd(this, _start);
    __privateAdd(this, _stop);
    __privateAdd(this, _initSocket);
    __privateAdd(this, _attachHandlers);
    __privateAdd(this, _detachHandlers);
    __privateAdd(this, _decryptMessage);
    __privateAdd(this, _compileMessage);
    __privateAdd(this, _compileMessageUnsafe);
    __privateAdd(this, _port, void 0);
    __privateAdd(this, _address, void 0);
    __privateAdd(this, _type, void 0);
    __privateAdd(this, _decryptionAlgorithm, void 0);
    __privateAdd(this, _decryptionSecret, void 0);
    __privateAdd(this, _socket, void 0);
    __privateAdd(this, _deserializer, void 0);
    __privateAdd(this, _formatMessage, void 0);
    __privateAdd(this, _collector, []);
    __privateAdd(this, _collectorIntervalId, void 0);
    __privateAdd(this, _collectorIntervalTime, void 0);
    __privateAdd(this, _allowPush, true);
    __privateAdd(this, _messages, []);
    __privateAdd(this, _handleSocketMessage, () => {
    });
    __privateAdd(this, _handleSocketClose, () => {
      this.emit("socket:close");
    });
    __privateAdd(this, _handleSocketError, (error) => {
      this.destroy(error);
    });
    __privateAdd(this, _handlePlainMessage, (buffer) => {
      __privateGet(this, _collector).push(buffer);
    });
    __privateAdd(this, _handleEncryptedMessage, (buffer) => {
      return __privateGet(this, _handlePlainMessage).call(this, __privateMethod(this, _decryptMessage, decryptMessage_fn).call(this, buffer));
    });
    __privateAdd(this, _collectorIntervalFunction, () => {
      if (__privateGet(this, _collector).length === 0)
        return;
      const collector = __privateGet(this, _collector);
      __privateSet(this, _collector, []);
      collector.sort(BUFFER_COMPARE_SORT_FUNCTION);
      let prevBuffer = collector[0];
      let body = [collector[0].subarray(ID_SIZE)];
      if (collector.length > 1) {
        for (let i = 1; i < collector.length; ++i) {
          const buffer = collector[i];
          if (buffer.compare(prevBuffer, 0, ID_SIZE, 0, ID_SIZE) !== 0) {
            __privateMethod(this, _compileMessage, compileMessage_fn).call(this, prevBuffer, body);
            prevBuffer = buffer;
            body = [];
          }
          body.push(buffer.subarray(ID_SIZE));
        }
      }
      __privateMethod(this, _compileMessage, compileMessage_fn).call(this, prevBuffer, body);
    });
    __privateSet(this, _port, port);
    __privateSet(this, _deserializer, deserializer);
    __privateSet(this, _formatMessage, formatMessage);
    __privateSet(this, _type, type);
    __privateSet(this, _decryptionSecret, decryption == null ? void 0 : decryption.secret);
    __privateSet(this, _decryptionAlgorithm, (_a2 = decryption == null ? void 0 : decryption.algorithm) != null ? _a2 : __privateGet(this, _decryptionSecret) ? "aes-256-ctr" : void 0);
    __privateSet(this, _collectorIntervalTime, collectorInterval);
    __privateSet(this, _handleSocketMessage, __privateGet(this, _handlePlainMessage));
    if (__privateGet(this, _decryptionSecret)) {
      __privateSet(this, _decryptionSecret, import_node_buffer2.Buffer.from(__privateGet(this, _decryptionSecret)));
      __privateSet(this, _handleSocketMessage, __privateGet(this, _handleEncryptedMessage));
    }
  }
  _construct(callback) {
    __privateMethod(this, _start, start_fn).call(this).then(() => callback(null)).catch(callback);
  }
  _destroy(error, callback) {
    if (error) {
      this.emit("error", error);
    }
    __privateMethod(this, _stop, stop_fn).call(this).then(() => callback(null)).catch(callback);
  }
  _read(size) {
    if (__privateGet(this, _messages).length > 0) {
      this.push(__privateGet(this, _messages).shift());
    }
    __privateSet(this, _allowPush, __privateGet(this, _messages).length === 0);
  }
  get address() {
    return __privateGet(this, _address);
  }
  get port() {
    return __privateGet(this, _port);
  }
};
_port = new WeakMap();
_address = new WeakMap();
_type = new WeakMap();
_decryptionAlgorithm = new WeakMap();
_decryptionSecret = new WeakMap();
_socket = new WeakMap();
_deserializer = new WeakMap();
_formatMessage = new WeakMap();
_collector = new WeakMap();
_collectorIntervalId = new WeakMap();
_collectorIntervalTime = new WeakMap();
_allowPush = new WeakMap();
_messages = new WeakMap();
_handleSocketMessage = new WeakMap();
_start = new WeakSet();
start_fn = async function() {
  __privateSet(this, _collector, []);
  __privateSet(this, _collectorIntervalId, setInterval(__privateGet(this, _collectorIntervalFunction), __privateGet(this, _collectorIntervalTime)));
  await __privateMethod(this, _initSocket, initSocket_fn).call(this);
  __privateMethod(this, _attachHandlers, attachHandlers_fn).call(this);
  __privateSet(this, _address, __privateGet(this, _socket).address().address);
  __privateSet(this, _port, __privateGet(this, _socket).address().port);
  this.emit("socket:ready");
};
_stop = new WeakSet();
stop_fn = async function() {
  clearInterval(__privateGet(this, _collectorIntervalId));
  __privateSet(this, _collector, []);
  if (!__privateGet(this, _socket)) {
    return;
  }
  __privateMethod(this, _detachHandlers, detachHandlers_fn).call(this);
  __privateGet(this, _socket).close();
  await import_node_events.default.once(__privateGet(this, _socket), "close");
};
_initSocket = new WeakSet();
initSocket_fn = async function() {
  __privateSet(this, _socket, import_node_dgram.default.createSocket({ type: __privateGet(this, _type) }));
  __privateGet(this, _socket).bind(__privateGet(this, _port));
  const error = await Promise.race([
    import_node_events.default.once(__privateGet(this, _socket), "listening"),
    import_node_events.default.once(__privateGet(this, _socket), "error")
  ]);
  if (error instanceof Error) {
    this.destroy(error);
  }
};
_attachHandlers = new WeakSet();
attachHandlers_fn = function() {
  __privateGet(this, _socket).on("close", __privateGet(this, _handleSocketClose));
  __privateGet(this, _socket).on("error", __privateGet(this, _handleSocketError));
  __privateGet(this, _socket).on("message", __privateGet(this, _handleSocketMessage));
};
_detachHandlers = new WeakSet();
detachHandlers_fn = function() {
  __privateGet(this, _socket).off("close", __privateGet(this, _handleSocketClose));
  __privateGet(this, _socket).off("error", __privateGet(this, _handleSocketError));
  __privateGet(this, _socket).off("message", __privateGet(this, _handleSocketMessage));
};
_handleSocketClose = new WeakMap();
_handleSocketError = new WeakMap();
_handlePlainMessage = new WeakMap();
_decryptMessage = new WeakSet();
decryptMessage_fn = function(buffer) {
  const iv = buffer.subarray(0, 16);
  const payload = buffer.subarray(16);
  const decipher = import_node_crypto2.default.createDecipheriv(__privateGet(this, _decryptionAlgorithm), __privateGet(this, _decryptionSecret), iv);
  const beginChunk = decipher.update(payload);
  const finalChunk = decipher.final();
  const result = import_node_buffer2.Buffer.concat([beginChunk, finalChunk], beginChunk.length + finalChunk.length);
  return result;
};
_handleEncryptedMessage = new WeakMap();
_collectorIntervalFunction = new WeakMap();
_compileMessage = new WeakSet();
compileMessage_fn = function(meta, body) {
  try {
    __privateMethod(this, _compileMessageUnsafe, compileMessageUnsafe_fn).call(this, meta, body);
  } catch (error) {
    const originMessage = error.message;
    error.message = "compile_message_error";
    error.ctx = {
      originMessage,
      meta,
      body
    };
    this.emit("error", error);
  }
};
_compileMessageUnsafe = new WeakSet();
compileMessageUnsafe_fn = function(meta, body) {
  const deserializedBody = __privateGet(this, _deserializer).call(this, body.length === 1 ? body[0] : import_node_buffer2.Buffer.concat(body));
  const parsedId = parseId(meta.subarray(0, ID_SIZE));
  const message = __privateGet(this, _formatMessage).call(this, deserializedBody, parsedId[0], parsedId[1]);
  if (__privateGet(this, _allowPush)) {
    __privateSet(this, _allowPush, this.push(message));
  } else {
    __privateGet(this, _messages).push(message);
  }
  this.emit("socket:message", message);
};
var socket_default = UDPLoggerSocket;

// src/client.js
var import_node_crypto3 = __toESM(require("crypto"), 1);
var import_node_dgram2 = __toESM(require("dgram"), 1);
var import_node_v82 = __toESM(require("v8"), 1);
var import_node_buffer3 = require("buffer");
var IV_SIZE = 16;
var DEFAULT_SERIALIZER2 = import_node_v82.default.serialize;
var _port2, _host, _type2, _packetSize, _serializer, _encryptionAlgorithm, _encryptionSecret, _encryptMessage, encryptMessage_fn, _sendChunk, _markChunk, markChunk_fn;
var UDPLoggerClient = class {
  constructor({
    type = "udp4",
    port = 44002,
    host = type === "udp4" ? "127.0.0.1" : "::1",
    packetSize = 1280,
    encryption,
    serializer = DEFAULT_SERIALIZER2
  } = {}) {
    __privateAdd(this, _encryptMessage);
    __privateAdd(this, _markChunk);
    __privateAdd(this, _port2, void 0);
    __privateAdd(this, _host, void 0);
    __privateAdd(this, _type2, void 0);
    __privateAdd(this, _packetSize, void 0);
    __privateAdd(this, _serializer, void 0);
    __privateAdd(this, _encryptionAlgorithm, void 0);
    __privateAdd(this, _encryptionSecret, void 0);
    __publicField(this, "log", (...args) => {
      const id = generateId();
      this.send(__privateGet(this, _serializer).call(this, args), id);
    });
    __publicField(this, "send", (payload, id = generateId()) => {
      for (let i = 0; i < payload.length; i += __privateGet(this, _packetSize)) {
        let chunk = __privateMethod(this, _markChunk, markChunk_fn).call(this, id, payload.subarray(i, i + __privateGet(this, _packetSize)));
        if (__privateGet(this, _encryptionAlgorithm) !== void 0) {
          chunk = __privateMethod(this, _encryptMessage, encryptMessage_fn).call(this, chunk);
        }
        __privateGet(this, _sendChunk).call(this, chunk);
      }
    });
    __privateAdd(this, _sendChunk, (payload) => {
      const client = import_node_dgram2.default.createSocket(__privateGet(this, _type2));
      client.send(payload, __privateGet(this, _port2), __privateGet(this, _host), (err) => {
        if (err)
          console.error(err);
        client.close();
      });
    });
    var _a;
    __privateSet(this, _port2, port);
    __privateSet(this, _host, host);
    __privateSet(this, _type2, type);
    __privateSet(this, _packetSize, packetSize - ID_SIZE);
    __privateSet(this, _serializer, serializer);
    __privateSet(this, _encryptionSecret, encryption == null ? void 0 : encryption.secret);
    __privateSet(this, _encryptionAlgorithm, (_a = encryption == null ? void 0 : encryption.algorithm) != null ? _a : __privateGet(this, _encryptionSecret) ? "aes-256-ctr" : void 0);
    if (__privateGet(this, _encryptionSecret)) {
      __privateSet(this, _packetSize, packetSize - IV_SIZE);
      __privateSet(this, _encryptionSecret, import_node_buffer3.Buffer.from(__privateGet(this, _encryptionSecret)));
    }
  }
};
_port2 = new WeakMap();
_host = new WeakMap();
_type2 = new WeakMap();
_packetSize = new WeakMap();
_serializer = new WeakMap();
_encryptionAlgorithm = new WeakMap();
_encryptionSecret = new WeakMap();
_encryptMessage = new WeakSet();
encryptMessage_fn = function(message) {
  const iv = import_node_crypto3.default.randomBytes(IV_SIZE).subarray(0, IV_SIZE);
  const payload = import_node_buffer3.Buffer.from(message);
  const cipher = import_node_crypto3.default.createCipheriv(__privateGet(this, _encryptionAlgorithm), __privateGet(this, _encryptionSecret), iv);
  const beginChunk = cipher.update(payload);
  const finalChunk = cipher.final();
  const result = import_node_buffer3.Buffer.concat([iv, beginChunk, finalChunk], IV_SIZE + beginChunk.length + finalChunk.length);
  return result;
};
_sendChunk = new WeakMap();
_markChunk = new WeakSet();
markChunk_fn = function(id, chunk) {
  const marked = import_node_buffer3.Buffer.alloc(chunk.length + ID_SIZE);
  marked.set(id, 0);
  marked.set(chunk, ID_SIZE);
  return marked;
};
var client_default = UDPLoggerClient;

// src/server.js
var import_node_events2 = require("events");

// src/writer.js
var import_node_path = __toESM(require("path"), 1);
var import_node_fs = __toESM(require("fs"), 1);
var import_node_stream2 = require("stream");
var EVENT_RENAME = "rename";
var _dirName, _fileName, _filePath, _encoding, _flags, _options, _fd, _watcher, _open, open_fn, _close, close_fn, _watchRename;
var UDPLoggerWriter = class extends import_node_stream2.Writable {
  constructor(_a = {}) {
    var _b = _a, {
      dirName,
      fileName,
      encoding = "utf8",
      flags = "a"
    } = _b, options = __objRest(_b, [
      "dirName",
      "fileName",
      "encoding",
      "flags"
    ]);
    super(__spreadValues({}, options));
    __privateAdd(this, _open);
    __privateAdd(this, _close);
    __privateAdd(this, _dirName, void 0);
    __privateAdd(this, _fileName, void 0);
    __privateAdd(this, _filePath, void 0);
    __privateAdd(this, _encoding, void 0);
    __privateAdd(this, _flags, void 0);
    __privateAdd(this, _options, void 0);
    __privateAdd(this, _fd, void 0);
    __privateAdd(this, _watcher, void 0);
    __privateAdd(this, _watchRename, async (event, fileName) => {
      if (event === EVENT_RENAME && fileName === __privateGet(this, _fileName)) {
        if (!import_node_fs.default.existsSync(__privateGet(this, _filePath))) {
          this.cork();
          await __privateMethod(this, _close, close_fn).call(this);
          await __privateMethod(this, _open, open_fn).call(this);
          this.uncork();
        }
      }
    });
    __privateSet(this, _dirName, dirName);
    __privateSet(this, _fileName, fileName);
    __privateSet(this, _encoding, encoding);
    __privateSet(this, _filePath, import_node_path.default.resolve(__privateGet(this, _dirName), __privateGet(this, _fileName)));
    __privateSet(this, _flags, flags);
    __privateSet(this, _options, options);
  }
  _construct(callback) {
    __privateMethod(this, _open, open_fn).call(this).then(() => {
      __privateSet(this, _watcher, import_node_fs.default.watch(__privateGet(this, _dirName), __privateGet(this, _watchRename)));
      this.emit("writer:ready");
      callback(null);
    }).catch(callback);
  }
  _destroy(error, callback) {
    __privateGet(this, _watcher).close();
    __privateMethod(this, _close, close_fn).call(this).then(() => callback(error)).catch(callback);
  }
  _write(chunk, encoding, callback) {
    if (typeof chunk === "string") {
      import_node_fs.default.write(__privateGet(this, _fd), chunk, void 0, __privateGet(this, _encoding), callback);
    } else {
      import_node_fs.default.write(__privateGet(this, _fd), chunk, callback);
    }
  }
  _writev(chunks, callback) {
    if (typeof chunks[0].chunk === "string") {
      let data = "";
      for (let i = 0; i < chunks.length; ++i)
        data += chunks[i].chunk;
      import_node_fs.default.write(__privateGet(this, _fd), data, void 0, __privateGet(this, _encoding), callback);
    } else {
      const arr = [];
      for (let i = 0; i < chunks.length; ++i)
        arr.push(chunks[i].chunk);
      import_node_fs.default.write(__privateGet(this, _fd), Buffer.concat(arr), callback);
    }
  }
};
_dirName = new WeakMap();
_fileName = new WeakMap();
_filePath = new WeakMap();
_encoding = new WeakMap();
_flags = new WeakMap();
_options = new WeakMap();
_fd = new WeakMap();
_watcher = new WeakMap();
_open = new WeakSet();
open_fn = async function() {
  return await new Promise((resolve, reject) => {
    import_node_fs.default.open(__privateGet(this, _filePath), __privateGet(this, _flags), (err, fd) => {
      if (err)
        return reject(err);
      __privateSet(this, _fd, fd);
      resolve(null);
    });
  });
};
_close = new WeakSet();
close_fn = async function() {
  return await new Promise((resolve, reject) => {
    import_node_fs.default.close(__privateGet(this, _fd), (err) => {
      if (err)
        return reject(err);
      resolve(null);
    });
  });
};
_watchRename = new WeakMap();
var writer_default = UDPLoggerWriter;

// src/server.js
var _options2;
var UDPLoggerServer = class extends import_node_events2.EventEmitter {
  constructor(options) {
    var _a;
    super(options);
    __privateAdd(this, _options2, void 0);
    __publicField(this, "socket");
    __publicField(this, "writer");
    __publicField(this, "handleError", (error) => {
      this.emit("error", error);
    });
    (_a = options.fileName) != null ? _a : options.fileName = `udp-port-${options.port}.log`;
    __privateSet(this, _options2, options);
  }
  start() {
    this.socket = new socket_default(__privateGet(this, _options2));
    this.writer = new writer_default(__privateGet(this, _options2));
    this.socket.pipe(this.writer);
    this.socket.on("error", this.handleError);
    this.writer.on("error", this.handleError);
    Promise.all([
      import_node_events2.EventEmitter.once(this.socket, "socket:ready"),
      import_node_events2.EventEmitter.once(this.writer, "writer:ready")
    ]).then(() => this.emit("ready"));
    return this;
  }
  async stop() {
    this.socket.off("error", this.handleError);
    this.writer.off("error", this.handleError);
    this.socket.destroy();
    this.writer.destroy();
    await Promise.all([
      import_node_events2.EventEmitter.once(this.socket, "close"),
      import_node_events2.EventEmitter.once(this.writer, "close")
    ]);
    this.emit("close");
    return this;
  }
};
_options2 = new WeakMap();
var server_default = UDPLoggerServer;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  UDPLoggerClient,
  UDPLoggerServer,
  UDPLoggerSocket,
  constants
});
