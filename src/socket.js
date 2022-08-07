import UdpSocket from './udp-socket.js'
import { DATE_SIZE, SEED_SIZE } from './identifier.js'
import {
  DEFAULT_DESERIALIZER,
  DEFAULT_MESSAGE_FORMATTER
} from './constants.js'

/**
 * @typedef {object} UdpLoggerSocketOptions
 * @property {(payload: Buffer) => any} [deserializer]
 * @property {(data: any, date:Date, id:number|string) => string | Buffer | Uint8Array} [formatMessage]
 *
 * @extends {UdpSocketOptions}
 */

/**
 * @class
 * @param {UdpLoggerSocketOptions} [options={}]
 */
class UdpLoggerSocket extends UdpSocket {
  /** @type {(Buffer) => any} */
  #deserializer

  /** @type {(data: any, date:Date, id:number|string) => string | Buffer | Uint8Array} */
  #formatMessage

  /**
   * @param {UdpLoggerSocketOptions} [options]
   */
  constructor ({
    deserializer = DEFAULT_DESERIALIZER,
    formatMessage = DEFAULT_MESSAGE_FORMATTER,
    ...socketOptions
  } = {}) {
    super({ ...socketOptions })

    this.#deserializer = deserializer
    this.#formatMessage = formatMessage
  }

  /**
   * @param {Buffer|TypedArray|string|Null} data
   * @param {BufferEncoding | undefined} [encoding]
   * @returns {boolean}
   */
  push (data, encoding) {
    if (data === null) return super.push(data, encoding)

    const date = new Date(data.readUintBE(0, DATE_SIZE))
    const id = data.subarray(0, SEED_SIZE).toString('hex')

    try {
      const deserializedBody = this.#deserializer(data.subarray(SEED_SIZE))
      const message = this.#formatMessage(deserializedBody, date, id)

      return super.push(message, encoding)
    } catch (error) {
      const originMessage = error.message

      error.message = 'compile_message_error'
      error.ctx = {
        originMessage,
        date,
        id
      }

      this.emit('warning', error)
    }

    return true
  }
}

export default UdpLoggerSocket
