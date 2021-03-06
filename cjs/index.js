var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// index.js
var udp_logger_exports = {};
__export(udp_logger_exports, {
  DEFAULT_MESSAGE_FORMATTER: () => DEFAULT_MESSAGE_FORMATTER,
  DEFAULT_PORT: () => DEFAULT_PORT,
  UDPLoggerClient: () => client_default,
  UDPLoggerServer: () => server_default,
  UDPLoggerSocket: () => socket_default,
  UDPLoggerWriter: () => writer_default
});
module.exports = __toCommonJS(udp_logger_exports);

// src/socket.js
var import_node_events = __toESM(require("node:events"), 1);
var import_node_dgram = __toESM(require("node:dgram"), 1);
var import_node_buffer3 = require("node:buffer");
var import_node_stream = require("node:stream");

// src/identifier.js
var import_node_crypto = __toESM(require("node:crypto"), 1);
var import_node_buffer = require("node:buffer");
var DATE_SIZE = 6;
var INCREMENTAL_SIZE = 4;
var INCREMENTAL_EDGE = import_node_buffer.Buffer.alloc(INCREMENTAL_SIZE).fill(255).readUIntBE(0, INCREMENTAL_SIZE);
var TIME_META_SIZE = DATE_SIZE + INCREMENTAL_SIZE;
var RANDOM_SIZE = 6;
var SEED_SIZE = TIME_META_SIZE + RANDOM_SIZE;
var COUNTER_TOTAL_SIZE = 3;
var COUNTER_INDEX_SIZE = 3;
var CHUNK_META_SIZE = COUNTER_TOTAL_SIZE + COUNTER_INDEX_SIZE;
var ID_SIZE = SEED_SIZE + CHUNK_META_SIZE;
var CACHE_SIZE = 2048 * RANDOM_SIZE;
var CACHE_BUFFER = import_node_buffer.Buffer.alloc(CACHE_SIZE);
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
  cacheOffset += RANDOM_SIZE;
  incrementId = ++incrementId & INCREMENTAL_EDGE;
  id.writeUIntBE(Date.now(), 0, DATE_SIZE);
  id.writeUIntBE(incrementId, DATE_SIZE, INCREMENTAL_SIZE);
  return id;
}
var SEED_N_TOTAL_OFFSET = SEED_SIZE + COUNTER_TOTAL_SIZE;
function setChunkMetaInfo(id, total, index) {
  id.writeUIntBE(total, SEED_SIZE, COUNTER_TOTAL_SIZE);
  id.writeUIntBE(index, SEED_N_TOTAL_OFFSET, COUNTER_INDEX_SIZE);
}
function parseId(buffer) {
  if (buffer.length !== ID_SIZE)
    throw new Error("id_size_not_valid");
  const date = new Date(buffer.readUintBE(0, DATE_SIZE));
  const id = buffer.subarray(0, SEED_SIZE).toString("hex");
  const total = buffer.readUintBE(SEED_SIZE, COUNTER_TOTAL_SIZE);
  const index = buffer.readUintBE(SEED_N_TOTAL_OFFSET, COUNTER_INDEX_SIZE);
  return [date, id, total, index];
}

// src/constants.js
var import_node_v8 = __toESM(require("node:v8"), 1);
var import_node_util = __toESM(require("node:util"), 1);
var import_node_crypto2 = __toESM(require("node:crypto"), 1);
var import_node_buffer2 = require("node:buffer");
var DEFAULT_FORMAT_OPTIONS = {
  depth: null,
  maxStringLength: null,
  maxArrayLength: null,
  breakLength: 80
};
var DEFAULT_MESSAGE_FORMATTER = (data, date, id) => {
  data.unshift(DEFAULT_FORMAT_OPTIONS);
  data = import_node_util.default.formatWithOptions.apply(import_node_util.default, data);
  return `${date.toISOString()}|${id}|${data}
`;
};
var DEFAULT_DESERIALIZER = import_node_v8.default.deserialize;
var DEFAULT_SERIALIZER = import_node_v8.default.serialize;
var DEFAULT_PORT = 44002;
var IV_SIZE = 16;
var DEFAULT_ENCRYPTION = "aes-256-ctr";
var DEFAULT_ENCRYPT_FUNCTION = (payload, secret) => {
  const iv = import_node_crypto2.default.randomBytes(IV_SIZE).subarray(0, IV_SIZE);
  const cipher = import_node_crypto2.default.createCipheriv(DEFAULT_ENCRYPTION, secret, iv);
  const beginChunk = cipher.update(payload);
  const finalChunk = cipher.final();
  return import_node_buffer2.Buffer.concat([iv, beginChunk, finalChunk], IV_SIZE + beginChunk.length + finalChunk.length);
};
var DEFAULT_DECRYPT_FUNCTION = (buffer, secret) => {
  const iv = buffer.subarray(0, IV_SIZE);
  const payload = buffer.subarray(IV_SIZE);
  const decipher = import_node_crypto2.default.createDecipheriv(DEFAULT_ENCRYPTION, secret, iv);
  const beginChunk = decipher.update(payload);
  const finalChunk = decipher.final();
  return import_node_buffer2.Buffer.concat([beginChunk, finalChunk], beginChunk.length + finalChunk.length);
};

// src/socket.js
var UDPLoggerSocket = class extends import_node_stream.Readable {
  #host;
  #port;
  #address;
  #type;
  #decryptionFunction;
  #decryptionSecret;
  #socket;
  #deserializer;
  #formatMessage;
  #collector = /* @__PURE__ */ new Map();
  #gcIntervalId;
  #gcIntervalTime = 5e3;
  #gcExpirationTime = 1e4;
  #allowPush = true;
  #messages = [];
  #handleSocketMessage;
  constructor({
    type = "udp4",
    port = DEFAULT_PORT,
    host = type === "udp4" ? "127.0.0.1" : "::1",
    decryption,
    deserializer = DEFAULT_DESERIALIZER,
    formatMessage = DEFAULT_MESSAGE_FORMATTER,
    ...options
  } = {}) {
    super(options);
    this.#port = port;
    this.#deserializer = deserializer;
    this.#formatMessage = formatMessage;
    this.#type = type;
    if (decryption) {
      if (typeof decryption === "string") {
        this.#decryptionSecret = import_node_buffer3.Buffer.from(decryption);
        this.#decryptionFunction = (data) => DEFAULT_DECRYPT_FUNCTION(data, this.#decryptionSecret);
      } else if (decryption instanceof Function) {
        this.#decryptionFunction = decryption;
      }
    }
    this.#handleSocketMessage = this.#handlePlainMessage;
    if (this.#decryptionFunction instanceof Function) {
      this.#handleSocketMessage = this.#handleEncryptedMessage;
    }
  }
  _construct(callback) {
    this.#start().then(() => callback(null)).catch(callback);
  }
  _destroy(error, callback) {
    if (error) {
      this.emit("error", error);
    }
    this.#stop().then(() => callback(error)).catch(callback);
  }
  _read(size) {
    this.#sendBufferedMessages();
    this.#allowPush = this.#messages.length === 0;
  }
  #addMessage(message) {
    if (this.#allowPush) {
      this.#allowPush = this.push(message);
    } else {
      this.#messages.push(message);
    }
  }
  #sendBufferedMessages() {
    if (this.#messages.length === 0)
      return;
    for (let i = 0; i < this.#messages.length; ++i) {
      if (!this.push(this.#messages[i])) {
        this.#messages.splice(0, i + 1);
        break;
      }
    }
  }
  get address() {
    return this.#address;
  }
  get port() {
    return this.#port;
  }
  async #start() {
    this.#collector.clear();
    this.#gcIntervalId = setInterval(this.#gcFunction, this.#gcIntervalTime);
    await this.#initSocket();
    this.#attachHandlers();
    this.#address = this.#socket.address().address;
    this.#port = this.#socket.address().port;
    this.emit("ready");
  }
  async #stop() {
    clearInterval(this.#gcIntervalId);
    this.#collector.clear();
    if (!this.#socket) {
      return;
    }
    this.#detachHandlers();
    this.#socket.close();
    await import_node_events.default.once(this.#socket, "close");
  }
  async #initSocket() {
    this.#socket = import_node_dgram.default.createSocket({ type: this.#type });
    this.#socket.bind(this.#port, this.#host);
    const error = await Promise.race([
      import_node_events.default.once(this.#socket, "listening"),
      import_node_events.default.once(this.#socket, "error")
    ]);
    if (error instanceof Error) {
      this.destroy(error);
    }
  }
  #attachHandlers() {
    this.#socket.on("error", this.#handleSocketError);
    this.#socket.on("message", this.#handleSocketMessage);
  }
  #detachHandlers() {
    this.#socket.off("error", this.#handleSocketError);
    this.#socket.off("message", this.#handleSocketMessage);
  }
  #handleSocketError = (error) => {
    this.destroy(error);
  };
  #handlePlainMessage = (buffer) => {
    const [date, id, total, index] = parseId(buffer.subarray(0, ID_SIZE));
    let data = this.#collector.get(id);
    if (!data) {
      data = [/* @__PURE__ */ new Map(), Date.now(), date, id, total];
      this.#collector.set(id, data);
    }
    data[0].set(index, buffer.subarray(ID_SIZE));
    if (data[0].size === total) {
      this.#collector.delete(id);
      this.#compileMessage(data[0], data[2], data[3]);
    }
  };
  #handleEncryptedMessage = (buffer) => {
    try {
      return this.#handlePlainMessage(this.#decryptionFunction(buffer));
    } catch (e) {
      console.error(e);
    }
  };
  #gcFunction = () => {
    const dateNow = Date.now();
    for (const [id, payload] of this.#collector) {
      if (payload[1] + this.#gcExpirationTime < dateNow) {
        this.#collector.delete(id);
        this.emit("warning", {
          message: "missing_message",
          id,
          date: payload[2]
        });
      }
    }
  };
  #compileMessage(body, date, id) {
    try {
      this.#compileMessageUnsafe(body, date, id);
    } catch (error) {
      const originMessage = error.message;
      error.message = "compile_message_error";
      error.ctx = {
        originMessage,
        date,
        id
      };
      this.emit("warning", error);
    }
  }
  #compileMessageUnsafe(body, date, id) {
    let deserializedBody;
    if (body.size === 1) {
      deserializedBody = this.#deserializer([...body.values()][0]);
    } else {
      const sortedBuffers = [...body.entries()].sort((a, b) => a[0] - b[0]).map((n) => n[1]);
      deserializedBody = this.#deserializer(import_node_buffer3.Buffer.concat(sortedBuffers));
    }
    const message = this.#formatMessage(deserializedBody, date, id);
    this.#addMessage(message);
    this.emit("message", message, { body: deserializedBody, date, id });
  }
};
var socket_default = UDPLoggerSocket;

// src/writer.js
var import_node_path = __toESM(require("node:path"), 1);
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_stream2 = require("node:stream");
var EVENT_RENAME = "rename";
var UDPLoggerWriter = class extends import_node_stream2.Writable {
  #dirName;
  #fileName;
  #filePath;
  #encoding;
  #flags;
  #fd;
  #watcher;
  constructor({
    dirName,
    fileName,
    encoding = "utf8",
    flags = "a",
    ...options
  } = {}) {
    super({ ...options });
    this.#dirName = dirName;
    this.#fileName = fileName;
    this.#encoding = encoding;
    this.#filePath = import_node_path.default.resolve(this.#dirName, this.#fileName);
    this.#flags = flags;
  }
  _construct(callback) {
    this.#open().then(() => {
      this.#watcher = import_node_fs.default.watch(this.#dirName, this.#watchRename);
      this.emit("writer:ready");
      callback(null);
    }).catch(callback);
  }
  _destroy(error, callback) {
    if (error) {
      this.emit("error", error);
    }
    this.#watcher.close();
    this.#close().then(() => callback(error)).catch(callback);
  }
  _write(chunk, encoding, callback) {
    if (typeof chunk === "string") {
      import_node_fs.default.write(this.#fd, chunk, void 0, this.#encoding, callback);
    } else {
      import_node_fs.default.write(this.#fd, chunk, callback);
    }
  }
  _writev(chunks, callback) {
    if (typeof chunks[0].chunk === "string") {
      let data = "";
      for (let i = 0; i < chunks.length; ++i)
        data += chunks[i].chunk;
      import_node_fs.default.write(this.#fd, data, void 0, this.#encoding, callback);
    } else {
      const arr = [];
      for (let i = 0; i < chunks.length; ++i)
        arr.push(chunks[i].chunk);
      import_node_fs.default.write(this.#fd, Buffer.concat(arr), callback);
    }
  }
  async #open() {
    return await new Promise((resolve, reject) => {
      import_node_fs.default.open(this.#filePath, this.#flags, (err, fd) => {
        if (err)
          return reject(err);
        this.#fd = fd;
        resolve(null);
      });
    });
  }
  async #close() {
    return await new Promise((resolve, reject) => {
      import_node_fs.default.close(this.#fd, (err) => {
        if (err)
          return reject(err);
        resolve(null);
      });
    });
  }
  #watchRename = async (event, fileName) => {
    if (event === EVENT_RENAME && fileName === this.#fileName) {
      if (!import_node_fs.default.existsSync(this.#filePath)) {
        this.cork();
        await this.#close();
        await this.#open();
        this.uncork();
      }
    }
  };
};
var writer_default = UDPLoggerWriter;

// src/client.js
var import_node_dgram2 = __toESM(require("node:dgram"), 1);
var import_node_buffer4 = require("node:buffer");
var import_node_events2 = require("node:events");
var UDPLoggerClient = class extends import_node_events2.EventEmitter {
  #port;
  #host;
  #type;
  #packetSize;
  #isAsync;
  #serializer;
  #encryptionFunction;
  #encryptionSecret;
  #connecting;
  #socket;
  constructor({
    type = "udp4",
    port = 44002,
    host = type === "udp4" ? "127.0.0.1" : "::1",
    packetSize = 1280,
    isAsync = false,
    encryption,
    serializer = DEFAULT_SERIALIZER,
    ...other
  } = {}) {
    super(other);
    this.#port = port;
    this.#host = host;
    this.#type = type;
    this.#packetSize = packetSize - ID_SIZE;
    this.#isAsync = isAsync;
    this.#serializer = serializer;
    if (encryption) {
      if (typeof encryption === "string") {
        this.#packetSize = packetSize - IV_SIZE;
        this.#encryptionSecret = import_node_buffer4.Buffer.from(encryption);
        this.#encryptionFunction = (data) => DEFAULT_ENCRYPT_FUNCTION(data, this.#encryptionSecret);
      } else if (encryption instanceof Function) {
        this.#encryptionFunction = encryption;
      }
    }
    this.#socket = import_node_dgram2.default.createSocket(this.#type);
    this.#connecting = (0, import_node_events2.once)(this.#socket, "connect");
    this.#socket.connect(this.#port, this.#host, () => {
      this.log = isAsync ? this.#asyncLog : this.#syncLog;
      this.emit("ready");
    });
  }
  log = (...args) => {
    this.#connecting.then(() => this.#isAsync ? this.#asyncLog(...args) : this.#syncLog(...args));
  };
  #syncLog = (...args) => {
    this.#send(this.#serializer(args), generateId());
  };
  #asyncLog = (...args) => {
    setImmediate(this.#syncLog, ...args);
  };
  #send = (payload, id) => {
    const total = Math.ceil(payload.length / this.#packetSize);
    for (let i = 0; i < payload.length; i += this.#packetSize) {
      let chunk = this.#markChunk(id, total, i, payload.subarray(i, i + this.#packetSize));
      if (this.#encryptionFunction !== void 0) {
        chunk = this.#encryptionFunction(chunk);
      }
      this.#sendChunk(chunk);
    }
  };
  #sendChunk = (payload) => {
    this.#socket.send(payload);
  };
  #markChunk(id, total, index, chunk) {
    const marked = import_node_buffer4.Buffer.alloc(chunk.length + ID_SIZE);
    marked.set(id, 0);
    setChunkMetaInfo(marked, total, index);
    marked.set(chunk, ID_SIZE);
    return marked;
  }
};
var client_default = UDPLoggerClient;

// src/server.js
var import_node_events3 = require("node:events");
var UDPLoggerServer = class extends import_node_events3.EventEmitter {
  #options;
  socket;
  writer;
  constructor(options) {
    super(options);
    options.fileName ??= `udp-port-${options.port || DEFAULT_PORT}.log`;
    this.#options = options;
  }
  async start() {
    this.socket = new socket_default(this.#options);
    this.writer = new writer_default(this.#options);
    this.socket.pipe(this.writer);
    this.socket.on("error", this.#handleError);
    this.writer.on("error", this.#handleError);
    this.socket.on("socket:warning", this.#handleWarning);
    this.socket.on("socket:missing", this.#handleWarning);
    await Promise.all([
      import_node_events3.EventEmitter.once(this.socket, "socket:ready"),
      import_node_events3.EventEmitter.once(this.writer, "writer:ready")
    ]);
    this.emit("ready");
    return this;
  }
  #handleError = (error) => {
    this.emit("error", error);
  };
  #handleWarning = (warning) => {
    this.emit("warning", warning);
  };
  async stop() {
    this.socket.off("error", this.#handleError);
    this.writer.off("error", this.#handleError);
    this.socket.off("socket:warning", this.#handleWarning);
    this.socket.off("socket:missing", this.#handleWarning);
    this.socket.push(null);
    await Promise.all([
      import_node_events3.EventEmitter.once(this.socket, "close"),
      import_node_events3.EventEmitter.once(this.writer, "close")
    ]);
    this.emit("close");
    return this;
  }
};
var server_default = UDPLoggerServer;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_MESSAGE_FORMATTER,
  DEFAULT_PORT,
  UDPLoggerClient,
  UDPLoggerServer,
  UDPLoggerSocket,
  UDPLoggerWriter
});
