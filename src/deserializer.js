import { Buffer } from 'node:buffer'
import { Transform } from 'node:stream'
import { ID_SIZE, parseId } from './identifier.js'
import { DEFAULT_SERIALIZER } from './constants.js'

/**
 * @typedef {object} UDPLoggerDeserializerOptions
 * @property {function} [options.deserializer]
 *
 * @typedef {ReadableOptions & UDPLoggerDeserializerOptions}
 */

/**
 * @param {UDPLoggerDeserializerOptions} [options={}]
 * @constructor
 */
class UDPLoggerDeserializer extends Transform {
  #deserializer

  #messages = []
  #allowPush = true

  constructor ({
    deserializer = DEFAULT_SERIALIZER,
    ...options
  } = {}) {
    super({ ...options, objectMode: true, autoDestroy: false })

    this.#deserializer = deserializer
  }

  _construct (callback) {
    this.emit('deserializer:ready')
    callback()
  }

  _destroy (error, callback) {
    if (error) {
      this.emit('error', error)
    }
    this.#messages = []

    callback(error)
  }

  _read (size) {
    this.#sendBufferedMessages()

    this.#allowPush = this.#messages.length === 0
  }

  _transform (data, encoding, callback) {
    try {
      this.#compileMessage(data[0], data[1])
      callback()
    } catch (error) {
      callback(error)
    }
  }

  _flush (callback) {
    this.#allowPush = false
    this.#sendBufferedMessages()

    callback()
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

  /**
   * @param {Buffer} meta
   * @param {Buffer[]} body
   * @returns {void|[*, Date, string]}
   */
  #compileMessage (meta, body) {
    try {
      this.#addMessage(this.#compileMessageUnsafe(meta, body))
    } catch (error) {
      const originMessage = error.message

      error.message = 'compile_message_error'
      error.ctx = {
        originMessage,
        meta,
        body
      }

      this.emit('warning', error)
    }
  }

  /**
   * @param {Buffer} meta
   * @param {Buffer[]} body
   * @returns {[*, Date, string]}
   */
  #compileMessageUnsafe (meta, body) {
    const deserializedBody = this.#deserializer(
      body.length === 1 ? body[0] : Buffer.concat(body)
    )
    const data = parseId(meta.subarray(0, ID_SIZE))

    return [deserializedBody, data[0], data[1]] // [payload, date, id]
  }
}

export default UDPLoggerDeserializer
