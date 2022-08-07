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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.js
var udp_logger_exports = {};
__export(udp_logger_exports, {
  DEFAULT_MESSAGE_FORMATTER: () => DEFAULT_MESSAGE_FORMATTER,
  DEFAULT_PORT: () => DEFAULT_PORT,
  UdpLoggerClient: () => client_default,
  UdpLoggerServer: () => server_default,
  UdpLoggerSocket: () => socket_default,
  UdpLoggerWriter: () => writer_default,
  _constants: () => constants_exports,
  _identifier: () => identifier_exports
});
module.exports = __toCommonJS(udp_logger_exports);

// src/udp-socket.js
var import_node_events = __toESM(require("node:events"), 1);
var import_node_dgram = __toESM(require("node:dgram"), 1);
var import_node_buffer3 = require("node:buffer");
var import_node_stream = require("node:stream");

// src/identifier.js
var identifier_exports = {};
__export(identifier_exports, {
  COUNTER_INDEX_SIZE: () => COUNTER_INDEX_SIZE,
  COUNTER_TOTAL_SIZE: () => COUNTER_TOTAL_SIZE,
  DATE_SIZE: () => DATE_SIZE,
  ID_SIZE: () => ID_SIZE,
  INCREMENTAL_SIZE: () => INCREMENTAL_SIZE,
  RANDOM_SIZE: () => RANDOM_SIZE,
  SEED_N_TOTAL_OFFSET: () => SEED_N_TOTAL_OFFSET,
  SEED_SIZE: () => SEED_SIZE,
  TIME_META_SIZE: () => TIME_META_SIZE,
  generateId: () => generateId,
  parseId: () => parseId,
  setChunkMetaInfo: () => setChunkMetaInfo
});
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
  id.set(
    [
      CACHE_BUFFER[cacheOffset],
      CACHE_BUFFER[cacheOffset + 1],
      CACHE_BUFFER[cacheOffset + 2],
      CACHE_BUFFER[cacheOffset + 3],
      CACHE_BUFFER[cacheOffset + 4],
      CACHE_BUFFER[cacheOffset + 5]
    ],
    TIME_META_SIZE
  );
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
var constants_exports = {};
__export(constants_exports, {
  DEFAULT_DECRYPT_FUNCTION: () => DEFAULT_DECRYPT_FUNCTION,
  DEFAULT_DESERIALIZER: () => DEFAULT_DESERIALIZER,
  DEFAULT_ENCRYPT_FUNCTION: () => DEFAULT_ENCRYPT_FUNCTION,
  DEFAULT_MESSAGE_FORMATTER: () => DEFAULT_MESSAGE_FORMATTER,
  DEFAULT_PORT: () => DEFAULT_PORT,
  DEFAULT_SERIALIZER: () => DEFAULT_SERIALIZER,
  IV_SIZE: () => IV_SIZE
});
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
  const str = import_node_util.default.formatWithOptions.apply(import_node_util.default, data);
  return `${date.toISOString()}|${id}|${str}
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
  return import_node_buffer2.Buffer.concat(
    [iv, beginChunk, finalChunk],
    IV_SIZE + beginChunk.length + finalChunk.length
  );
};
var DEFAULT_DECRYPT_FUNCTION = (buffer, secret) => {
  const iv = buffer.subarray(0, IV_SIZE);
  const payload = buffer.subarray(IV_SIZE);
  const decipher = import_node_crypto2.default.createDecipheriv(DEFAULT_ENCRYPTION, secret, iv);
  const beginChunk = decipher.update(payload);
  const finalChunk = decipher.final();
  return import_node_buffer2.Buffer.concat(
    [beginChunk, finalChunk],
    beginChunk.length + finalChunk.length
  );
};

// src/udp-socket.js
var UdpSocket = class extends import_node_stream.Readable {
  #host;
  #port;
  #address;
  #type;
  #decryptionFunction;
  #decryptionSecret;
  #socket;
  #collector = /* @__PURE__ */ new Map();
  #gcIntervalId;
  #gcIntervalTime;
  #gcExpirationTime;
  #allowPush = true;
  #messages = [];
  #handleSocketMessage;
  constructor({
    type = "udp4",
    port = DEFAULT_PORT,
    host = type === "udp4" ? "127.0.0.1" : "::1",
    decryption,
    gcIntervalTime = 5e3,
    gcExpirationTime = 1e4,
    ...readableOptions
  } = {}) {
    super({ ...readableOptions });
    this.#port = port;
    this.#host = host;
    this.#type = type;
    this.#gcIntervalTime = gcIntervalTime;
    this.#gcExpirationTime = gcExpirationTime;
    if (decryption) {
      if (typeof decryption === "string") {
        this.#decryptionSecret = import_node_buffer3.Buffer.from(decryption, "hex");
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
      data = [/* @__PURE__ */ new Map(), Date.now(), date, id];
      this.#collector.set(id, data);
    }
    data[0].set(index, buffer.subarray(ID_SIZE));
    if (data[0].size === total + 1) {
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
    let bodyBuffered;
    if (body.size > 1) {
      const sortedBuffers = [...body.entries()].sort((a, b) => a[0] - b[0]).map((n) => n[1]);
      bodyBuffered = import_node_buffer3.Buffer.concat(sortedBuffers);
    } else {
      bodyBuffered = [...body.values()][0];
    }
    this.#addMessage(import_node_buffer3.Buffer.concat([import_node_buffer3.Buffer.from(id, "hex"), bodyBuffered]));
  }
};
var udp_socket_default = UdpSocket;

// src/socket.js
var UdpLoggerSocket = class extends udp_socket_default {
  #deserializer;
  #formatMessage;
  constructor({
    deserializer = DEFAULT_DESERIALIZER,
    formatMessage = DEFAULT_MESSAGE_FORMATTER,
    ...socketOptions
  } = {}) {
    super({ ...socketOptions });
    this.#deserializer = deserializer;
    this.#formatMessage = formatMessage;
  }
  push(data, encoding) {
    if (data === null)
      return super.push(data, encoding);
    const date = new Date(data.readUintBE(0, DATE_SIZE));
    const id = data.subarray(0, SEED_SIZE).toString("hex");
    try {
      const deserializedBody = this.#deserializer(data.subarray(SEED_SIZE));
      const message = this.#formatMessage(deserializedBody, date, id);
      return super.push(message, encoding);
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
    return true;
  }
};
var socket_default = UdpLoggerSocket;

// src/udp-client.js
var import_node_dgram2 = __toESM(require("node:dgram"), 1);
var import_node_buffer4 = require("node:buffer");
var import_node_events2 = require("node:events");
var UdpClient = class extends import_node_events2.EventEmitter {
  #port;
  #host;
  #type;
  #packetSize;
  #encryptionFunction;
  #encryptionSecret;
  #connecting;
  #socket;
  constructor({
    type = "udp4",
    port = 44002,
    host = type === "udp4" ? "127.0.0.1" : "::1",
    packetSize = 1280,
    encryption,
    ...eventEmitterOptions
  } = {}) {
    super({ ...eventEmitterOptions });
    this.#port = port;
    this.#host = host;
    this.#type = type;
    this.#packetSize = packetSize - ID_SIZE;
    if (encryption) {
      if (typeof encryption === "string") {
        this.#packetSize = packetSize - IV_SIZE;
        this.#encryptionSecret = import_node_buffer4.Buffer.from(encryption, "hex");
        this.#encryptionFunction = (data) => DEFAULT_ENCRYPT_FUNCTION(data, this.#encryptionSecret);
      } else if (encryption instanceof Function) {
        this.#encryptionFunction = encryption;
      }
    }
    this.#socket = import_node_dgram2.default.createSocket(this.#type);
    this.#connecting = (0, import_node_events2.once)(this.#socket, "connect");
    this.#socket.connect(this.#port, this.#host, () => {
      this.emit("ready");
    });
  }
  send(buffer) {
    this.#send(buffer, generateId());
  }
  #send(payload, id) {
    const total = Math.ceil(payload.length / this.#packetSize) - 1;
    for (let i = 0; i < payload.length; i += this.#packetSize) {
      let chunk = this.#markChunk(
        id,
        total,
        i / this.#packetSize,
        payload.subarray(i, i + this.#packetSize)
      );
      if (this.#encryptionFunction !== void 0) {
        chunk = this.#encryptionFunction(chunk);
      }
      this.#sendChunk(chunk);
    }
  }
  #sendChunk(payload) {
    this.#socket.send(payload);
  }
  #markChunk(id, total, index, chunk) {
    const resultChunk = import_node_buffer4.Buffer.alloc(chunk.length + ID_SIZE);
    resultChunk.set(id, 0);
    setChunkMetaInfo(resultChunk, total, index);
    resultChunk.set(chunk, ID_SIZE);
    return resultChunk;
  }
};
var udp_client_default = UdpClient;

// src/client.js
var UdpLoggerClient = class extends udp_client_default {
  #sync;
  #serializer;
  constructor({
    serializer = DEFAULT_SERIALIZER,
    sync = false,
    ...udpClientOptions
  } = {}) {
    super({ ...udpClientOptions });
    this.#sync = sync;
    this.#serializer = serializer;
  }
  log(...args) {
    if (this.#sync) {
      return this.#logSync(args);
    } else {
      return this.#logAsync(args);
    }
  }
  #logSync(args) {
    this.send(this.#serializer(args));
  }
  #logAsync(args) {
    setImmediate(() => this.send(this.#serializer(args)));
  }
};
var client_default = UdpLoggerClient;

// src/server.js
var import_node_events3 = require("node:events");

// src/writer.js
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_node_stream2 = require("node:stream");
var IO_DONE = Symbol("IO_DONE");
var UdpLoggerWriter = class extends import_node_stream2.Writable {
  #filePath;
  #fileName;
  #dir;
  #encoding;
  #flags;
  #fd = null;
  #watcher;
  #isPerforming = false;
  #bytesWritten = 0;
  constructor({
    filePath,
    encoding = "utf8",
    flags = "a",
    ...writableOptions
  } = {}) {
    super({ ...writableOptions });
    this.#filePath = import_node_path.default.resolve(process.cwd(), filePath);
    this.#fileName = import_node_path.default.parse(this.#filePath).base;
    this.#dir = import_node_path.default.parse(this.#filePath).dir;
    this.#encoding = encoding;
    this.#flags = flags;
  }
  _construct(callback) {
    this.#open().then(() => {
      this.#watcher = import_node_fs.default.watch(this.#dir, this.#watchRename);
      this.emit("ready");
      callback(null);
    }).catch(callback);
  }
  _destroy(error, callback) {
    this.#watcher.close();
    if (this.#isPerforming) {
      this.once(
        IO_DONE,
        (err) => this.#close(err).then(() => callback(error)).catch(callback)
      );
    } else {
      this.#close(error).then(() => callback(error)).catch(callback);
    }
  }
  _write(chunk, encoding, callback) {
    this.#isPerforming = true;
    const fn = (error, bytesWritten) => {
      this.#bytesWritten += bytesWritten;
      this.#isPerforming = false;
      if (this.destroyed) {
        callback(error);
        return this.emit(IO_DONE, error);
      }
      if (error)
        return callback(error);
      callback();
    };
    if (typeof chunk === "string") {
      import_node_fs.default.write(this.#fd, chunk, void 0, this.#encoding, fn);
    } else {
      import_node_fs.default.write(this.#fd, chunk, fn);
    }
  }
  _writev(data, callback) {
    const length = data.length;
    const chunks = new Array(length);
    if (typeof data[0].chunk === "string") {
      for (let i = 0; i < length; ++i) {
        chunks[i] = Buffer.from(data[i].chunk, this.#encoding);
      }
    } else {
      for (let i = 0; i < length; ++i) {
        chunks[i] = data[i].chunk;
      }
    }
    this.#isPerforming = true;
    const fn = (error, bytesWritten) => {
      this.#bytesWritten += bytesWritten;
      this.#isPerforming = false;
      if (this.destroyed) {
        callback(error);
        return this.emit(IO_DONE, error);
      }
      if (error)
        return callback(error);
      callback();
    };
    import_node_fs.default.writev(this.#fd, chunks, fn);
  }
  get path() {
    return this.#filePath;
  }
  get fd() {
    return this.#fd;
  }
  get bytesWritten() {
    return this.#bytesWritten;
  }
  get pending() {
    return this.#fd === null;
  }
  async #open() {
    return await new Promise((resolve, reject) => {
      if (typeof this.#fd === "number") {
        return resolve(null);
      }
      import_node_fs.default.open(this.#filePath, this.#flags, (err, fd) => {
        if (err)
          return reject(err);
        this.#fd = fd;
        resolve(null);
        this.emit("reopen");
      });
    });
  }
  async #close(error) {
    return await new Promise((resolve, reject) => {
      if (this.#fd === null)
        return reject(error);
      import_node_fs.default.close(this.#fd, (err) => {
        this.#fd = null;
        if (err)
          return reject(err);
        resolve(null);
      });
    });
  }
  #watchRename = async (event, fileName) => {
    if (event === "rename" && fileName === this.#fileName) {
      if (!import_node_fs.default.existsSync(this.#filePath)) {
        this.cork();
        await this.#close(null);
        await this.#open();
        process.nextTick(() => this.uncork());
      }
    }
  };
};
var writer_default = UdpLoggerWriter;

// src/server.js
var UdpLoggerServer = class extends import_node_events3.EventEmitter {
  #options;
  socket;
  writer;
  constructor(options = {}) {
    super(options);
    options.filePath ??= `./udp-port-${options.port || DEFAULT_PORT}.log`;
    this.#options = options;
  }
  async start() {
    this.socket = new socket_default(this.#options);
    this.writer = new writer_default(this.#options);
    this.socket.pipe(this.writer);
    this.socket.on("error", this.#handleError);
    this.writer.on("error", this.#handleError);
    this.socket.on("warning", this.#handleWarning);
    await Promise.all([
      import_node_events3.EventEmitter.once(this.socket, "ready"),
      import_node_events3.EventEmitter.once(this.writer, "ready")
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
    this.socket.off("warning", this.#handleWarning);
    this.socket.push(null);
    await Promise.all([
      import_node_events3.EventEmitter.once(this.socket, "close"),
      import_node_events3.EventEmitter.once(this.writer, "close")
    ]);
    this.emit("close");
    return this;
  }
};
var server_default = UdpLoggerServer;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_MESSAGE_FORMATTER,
  DEFAULT_PORT,
  UdpLoggerClient,
  UdpLoggerServer,
  UdpLoggerSocket,
  UdpLoggerWriter,
  _constants,
  _identifier
});
