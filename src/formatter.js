import { Transform } from 'node:stream'
import { DEFAULT_MESSAGE_FORMATTER } from './constants.js'

/**
 * @typedef {object} UDPLoggerFormatterOptions
 * @property {function} [options.formatMessage]
 *
 * @typedef {ReadableOptions & UDPLoggerFormatterOptions}
 */

/**
 * @param {UDPLoggerFormatterOptions} [options={}]
 * @constructor
 */
class UDPLoggerFormatter extends Transform {
  #formatMessageUnsafe

  #messages = []
  #allowPush = true

  constructor ({
    formatMessage = DEFAULT_MESSAGE_FORMATTER,
    ...options
  } = {}) {
    super({ ...options, objectMode: true, autoDestroy: false })

    this.#formatMessageUnsafe = formatMessage
  }

  _construct (callback) {
    this.emit('formatter:ready')
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
      this.#formatMessage(data[0], data[1], data[2])
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
   * @param {*} payload
   * @param {Date} date
   * @param {string} id
   */
  #formatMessage (payload, date, id) {
    try {
      return this.#addMessage(this.#formatMessageUnsafe(payload, date, id))
    } catch (error) {
      const originMessage = error.message

      error.message = 'format_message_error'
      error.ctx = {
        originMessage,
        payload,
        date,
        id
      }

      this.emit('warning', error)
    }
  }
}

export default UDPLoggerFormatter
