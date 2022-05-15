import EventEmitter from 'node:events'
import crypto from 'node:crypto'
import dgram from 'node:dgram'
import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import {
  ID_SIZE,
  parseId,
  BUFFER_COMPARE_SORT_FUNCTION
} from './identifier.js'
import { DEFAULT_MESSAGE_FORMATTER, DEFAULT_SERIALIZER } from './constants.js'

/**
 * @typedef {object} UDPLoggerSocketOptions
 * @property {string} [options.type='udp4']
 * @property {number} [options.port=44002]
 * @property {object} [options.decryption]
 * @property {object} [options.decryption.algorithm]
 * @property {object} [options.decryption.secret]
 * @property {number} [options.collectorInterval=1000]
 * @property {function} [options.deserializer]
 * @property {function} [options.formatMessage]
 *
 * @typedef {ReadableOptions & UDPLoggerSocketOptions}
 */

/**
 * @param {UDPLoggerSocketOptions} [options={}]
 * @constructor
 */
class UDPLoggerSocket extends Readable {
  #port
  #address
  #type

  #decryptionAlgorithm
  #decryptionSecret

  #socket

  #deserializer
  #formatMessage

  #collector = []
  #collectorIntervalId
  #collectorIntervalTime

  #allowPush = true
  #messages = []

  #handleSocketMessage = () => {}

  constructor ({
    type = 'udp4',
    port = 44002,
    decryption,
    collectorInterval = 1000,
    deserializer = DEFAULT_SERIALIZER,
    formatMessage = DEFAULT_MESSAGE_FORMATTER,
    ...options
  } = {}) {
    super(options)

    this.#port = port
    this.#deserializer = deserializer
    this.#formatMessage = formatMessage
    this.#type = type
    this.#decryptionSecret = decryption?.secret
    this.#decryptionAlgorithm =
      decryption?.algorithm ??
      (this.#decryptionSecret ? 'aes-256-ctr' : undefined)

    this.#collectorIntervalTime = collectorInterval

    this.#handleSocketMessage = this.#handlePlainMessage

    if (this.#decryptionSecret) {
      this.#decryptionSecret = Buffer.from(this.#decryptionSecret)

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
      .then(() => callback(null))
      .catch(callback)
  }

  _read (size) {
    if (this.#messages.length > 0) {
      this.push(this.#messages.shift())
    }

    this.#allowPush = this.#messages.length === 0
  }

  get address () {
    return this.#address
  }

  get port () {
    return this.#port
  }

  async #start () {
    this.#collector = []
    this.#collectorIntervalId = setInterval(
      this.#collectorIntervalFunction,
      this.#collectorIntervalTime
    )
    await this.#initSocket()
    this.#attachHandlers()

    this.#address = this.#socket.address().address
    this.#port = this.#socket.address().port

    this.emit('socket:ready')
  }

  async #stop () {
    clearInterval(this.#collectorIntervalId)
    this.#collector = []

    if (!this.#socket) {
      return
    }

    this.#detachHandlers()
    this.#socket.close()

    await EventEmitter.once(this.#socket, 'close')
  }

  async #initSocket () {
    this.#socket = dgram.createSocket({ type: this.#type })
    this.#socket.bind(this.#port)

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
    this.#collector.push(buffer)
  }

  /**
   * @param {Buffer} buffer
   * @returns {Buffer}
   */
  #decryptMessage (buffer) {
    const iv = buffer.subarray(0, 16)
    const payload = buffer.subarray(16)

    const decipher = crypto.createDecipheriv(
      this.#decryptionAlgorithm,
      this.#decryptionSecret,
      iv
    )
    const beginChunk = decipher.update(payload)
    const finalChunk = decipher.final()
    const result = Buffer.concat(
      [beginChunk, finalChunk],
      beginChunk.length + finalChunk.length
    )

    return result
  }

  /**
   * @param {Buffer} buffer
   */
  #handleEncryptedMessage = (buffer) => {
    return this.#handlePlainMessage(this.#decryptMessage(buffer))
  }

  #collectorIntervalFunction = () => {
    if (this.#collector.length === 0) return

    const collector = this.#collector
    this.#collector = []

    collector.sort(BUFFER_COMPARE_SORT_FUNCTION) // it will also sort by date

    let prevBuffer = collector[0]
    let body = [collector[0].subarray(ID_SIZE)]

    if (collector.length > 1) {
      for (let i = 1; i < collector.length; ++i) {
        const buffer = collector[i]

        if (buffer.compare(prevBuffer, 0, ID_SIZE, 0, ID_SIZE) !== 0) {
          // if current id NOT equal to previous
          this.#compileMessage(prevBuffer, body)

          prevBuffer = buffer
          body = []
        }

        body.push(buffer.subarray(ID_SIZE))
      }
    }

    this.#compileMessage(prevBuffer, body)
  }

  /**
   * @param {Buffer} meta
   * @param {Buffer[]} body
   */
  #compileMessage (meta, body) {
    try {
      this.#compileMessageUnsafe(meta, body)
    } catch (error) {
      const originMessage = error.message

      error.message = 'compile_message_error'
      error.ctx = {
        originMessage,
        meta,
        body
      }

      this.emit('error', error)
    }
  }

  /**
   * @param {Buffer} meta
   * @param {Buffer[]} body
   */
  #compileMessageUnsafe (meta, body) {
    const deserializedBody = this.#deserializer(
      body.length === 1 ? body[0] : Buffer.concat(body)
    )
    const parsedId = parseId(meta.subarray(0, ID_SIZE))

    const message = this.#formatMessage(
      deserializedBody,
      parsedId[0],
      parsedId[1]
    )

    if (this.#allowPush) {
      this.#allowPush = this.push(message)
    } else {
      this.#messages.push(message)
    }

    this.emit('socket:message', message)
  }
}

export default UDPLoggerSocket
