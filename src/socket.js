import EventEmitter from 'node:events'
import dgram from 'node:dgram'
import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { ID_SIZE, parseId } from './identifier.js'
import {
  DEFAULT_PORT,
  DEFAULT_MESSAGE_FORMATTER,
  DEFAULT_DESERIALIZER,
  DEFAULT_DECRYPT_FUNCTION
} from './constants.js'

/**
 * @typedef {object} UDPLoggerSocketOptions
 * @property {string} [type='udp4']
 * @property {number} [port=44002]
 * @property {string} [host=('127.0.0.1'|'::1')]
 * @property {string | ((payload: Buffer) => Buffer)} [decryption]
 *    if passed string - will be applied aes-256-ctr encryption with passed string as secret;
 *    if passed function - will be used that function to encrypt every message;
 * @property {(payload: Buffer) => any} [deserializer]
 * @property {(data: any, date:Date, id:number|string) => string | Buffer | Uint8Array} [formatMessage]
 *
 * @extends {ReadableOptions}
 */

/**
 * @class
 * @param {UDPLoggerSocketOptions} [options={}]
 */
class UDPLoggerSocket extends Readable {
  /** @type {string} */
  #host

  /** @type {number} */
  #port

  /** @type {string} */
  #address

  /** @type {'udp4'|'udp6'} */
  #type

  /** @type {undefined|function(Buffer): Buffer} */
  #decryptionFunction

  /** @type {undefined|string} */
  #decryptionSecret

  /** @type {dgram.Socket} */
  #socket

  /** @type {(Buffer) => any} */
  #deserializer

  /** @type {(data: any, date:Date, id:number|string) => string | Buffer | Uint8Array} */
  #formatMessage

  /** @type {Map<string, [logBodyMap:Map, lastUpdate:number, logDate:Date, logId:string, logTotal:number]>} data */
  #collector = new Map()

  /** @type {number} */
  #gcIntervalId

  /** @type {number} */
  #gcIntervalTime = 5000

  /** @type {number} */
  #gcExpirationTime = 10000

  /** @type {boolean} */
  #allowPush = true

  /** @type {(string | Buffer | Uint8Array)[]} */
  #messages = []

  /** @type {function (Buffer):void} */
  #handleSocketMessage

  constructor ({
    type = 'udp4',
    port = DEFAULT_PORT,
    host = type === 'udp4' ? '127.0.0.1' : '::1',
    decryption,
    deserializer = DEFAULT_DESERIALIZER,
    formatMessage = DEFAULT_MESSAGE_FORMATTER,
    ...options
  } = {}) {
    super(options)

    this.#port = port
    this.#deserializer = deserializer
    this.#formatMessage = formatMessage
    this.#type = type

    if (decryption) {
      if (typeof decryption === 'string') {
        this.#decryptionSecret = Buffer.from(decryption)

        this.#decryptionFunction = data => DEFAULT_DECRYPT_FUNCTION(data, this.#decryptionSecret)
      } else if (decryption instanceof Function) {
        this.#decryptionFunction = decryption
      }
    }

    this.#handleSocketMessage = this.#handlePlainMessage

    if (this.#decryptionFunction instanceof Function) {
      this.#handleSocketMessage = this.#handleEncryptedMessage
    }
  }

  _construct (callback) {
    this.#start()
      .then(() => callback(null))
      .catch(callback)
  }

  _destroy (error, callback) {
    if (error) {
      this.emit('error', error)
    }

    this.#stop()
      .then(() => callback(error))
      .catch(callback)
  }

  _read (size) {
    this.#sendBufferedMessages()

    this.#allowPush = this.#messages.length === 0
  }

  /**
   * @param {*} message
   */
  #addMessage (message) {
    if (this.#allowPush) {
      this.#allowPush = this.push(message)
    } else {
      this.#messages.push(message)
    }
  }

  #sendBufferedMessages () {
    if (this.#messages.length === 0) return

    for (let i = 0; i < this.#messages.length; ++i) {
      if (!this.push(this.#messages[i])) {
        this.#messages.splice(0, i + 1)
        break
      }
    }
  }

  get address () {
    return this.#address
  }

  get port () {
    return this.#port
  }

  async #start () {
    this.#collector.clear()
    this.#gcIntervalId = setInterval(this.#gcFunction, this.#gcIntervalTime)
    await this.#initSocket()
    this.#attachHandlers()

    this.#address = this.#socket.address().address
    this.#port = this.#socket.address().port

    this.emit('socket:ready')
  }

  async #stop () {
    clearInterval(this.#gcIntervalId)
    this.#collector.clear()

    if (!this.#socket) {
      return
    }

    this.#detachHandlers()
    this.#socket.close()

    await EventEmitter.once(this.#socket, 'close')
  }

  async #initSocket () {
    this.#socket = dgram.createSocket({ type: this.#type })
    this.#socket.bind(this.#port, this.#host)

    const error = await Promise.race([
      EventEmitter.once(this.#socket, 'listening'),
      EventEmitter.once(this.#socket, 'error')
    ])

    if (error instanceof Error) {
      this.destroy(error)
    }
  }

  #attachHandlers () {
    this.#socket.on('close', this.#handleSocketClose)
    this.#socket.on('error', this.#handleSocketError)
    this.#socket.on('message', this.#handleSocketMessage)
  }

  #detachHandlers () {
    this.#socket.off('close', this.#handleSocketClose)
    this.#socket.off('error', this.#handleSocketError)
    this.#socket.off('message', this.#handleSocketMessage)
  }

  #handleSocketClose = () => {
    this.emit('socket:close')
  }

  #handleSocketError = (error) => {
    this.destroy(error)
  }

  /**
   * @param {Buffer} buffer
   */
  #handlePlainMessage = (buffer) => {
    const [date, id, total, index] = parseId(buffer.subarray(0, ID_SIZE))

    /** @type {[logBodyMap:Map, lastUpdate:number, logDate:Date, logId:string, logTotal:number]} */
    let data = this.#collector.get(id)
    if (!data) {
      data = [new Map(), Date.now(), date, id, total]
      this.#collector.set(id, data)
    }

    data[0].set(index, buffer.subarray(ID_SIZE))

    if (data[0].size === total) {
      this.#collector.delete(id)
      this.#compileMessage(data[0], data[2], data[3])
    }
  }

  /**
   * @param {Buffer} buffer
   */
  #handleEncryptedMessage = (buffer) => {
    try {
      return this.#handlePlainMessage(this.#decryptionFunction(buffer))
    } catch (e) {
      console.error(e)
    }
  }

  #gcFunction = () => {
    const dateNow = Date.now()

    for (const [id, payload] of this.#collector) {
      if (payload[1] + this.#gcExpirationTime < dateNow) {
        this.#collector.delete(id)
        this.emit('socket:missing', { message: 'missing data', id, date: payload[2] })
      }
    }
  }

  /**
   * @param {Map<number, Buffer>} body
   * @param {Date|number} date
   * @param {string} id
   */
  #compileMessage (body, date, id) {
    try {
      this.#compileMessageUnsafe(body, date, id)
    } catch (error) {
      const originMessage = error.message

      error.message = 'compile_message_error'
      error.ctx = {
        originMessage,
        date,
        id,
        body
      }

      this.emit('warning', error)
    }
  }

  /**
   * @param {Map<number, Buffer>} body
   * @param {Date|number} date
   * @param {string} id
   */
  #compileMessageUnsafe (body, date, id) {
    let deserializedBody

    if (body.size === 1) {
      deserializedBody = this.#deserializer([...body.values()][0])
    } else {
      const sortedBuffers = [...body.entries()]
        .sort((a, b) => a[0] - b[0])
        .map((n) => n[1])

      deserializedBody = this.#deserializer(Buffer.concat(sortedBuffers))
    }

    const message = this.#formatMessage(deserializedBody, date, id)

    this.#addMessage(message)

    this.emit('socket:message', message)
  }
}

export default UDPLoggerSocket
