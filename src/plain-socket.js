import EventEmitter from 'node:events'
import dgram from 'node:dgram'
import { Readable } from 'node:stream'

/**
 * @typedef {object} UDPLoggerPlainSocketOptions
 * @property {string} [options.type='udp4']
 * @property {number} [options.port=44002]
 *
 * @typedef {ReadableOptions & UDPLoggerPlainSocketOptions}
 */

/**
 * @param {UDPLoggerPlainSocketOptions} [options={}]
 * @constructor
 */
class UDPLoggerPlainSocket extends Readable {
  #port
  #address
  #type

  #socket

  #allowPush = true
  #messages = []

  constructor ({
    type = 'udp4',
    port = 44002,
    ...options
  } = {}) {
    super(options)

    this.#port = port
    this.#type = type
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
    await this.#initSocket()
    this.#attachHandlers()

    this.#address = this.#socket.address().address
    this.#port = this.#socket.address().port

    this.emit('socket:ready')
  }

  async #stop () {
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
  #handleSocketMessage = (buffer) => {
    this.#addMessage(buffer)
  }
}

export default UDPLoggerPlainSocket
