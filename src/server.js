import { EventEmitter } from 'node:events'
import UDPLoggerSocket from './socket.js'
import UDPLoggerWriter from './writer.js'
import { DEFAULT_PORT } from './constants.js'

/**
 * @param {UDPLoggerSocketOptions & UDPLoggerWriterOptions} [options={}]
 * @constructor
 */
class UDPLoggerServer extends EventEmitter {
  #options

  socket
  writer

  constructor (options) {
    super(options)

    options.fileName ??= `udp-port-${options.port || DEFAULT_PORT}.log`

    this.#options = options
  }

  async start () {
    this.socket = new UDPLoggerSocket(this.#options)
    this.writer = new UDPLoggerWriter(this.#options)

    this.socket.pipe(this.writer)

    this.socket.on('error', this.handleError)
    this.socket.on('warning', this.handleError)
    this.writer.on('error', this.handleError)

    await Promise.all([
      EventEmitter.once(this.socket, 'socket:ready'),
      EventEmitter.once(this.writer, 'writer:ready')
    ])

    this.emit('ready')

    return this
  }

  /**
   * @param {Error~object} error
   */
  handleError = (error) => {
    this.emit('error', error)
  }

  async stop () {
    this.socket.off('error', this.handleError)
    this.writer.off('error', this.handleError)

    this.socket.push(null)

    await Promise.all([
      EventEmitter.once(this.socket, 'close'),
      EventEmitter.once(this.writer, 'close')
    ])

    this.emit('close')

    return this
  }
}

export default UDPLoggerServer
