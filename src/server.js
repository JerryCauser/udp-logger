import { EventEmitter } from 'node:events'
import UDPLoggerSocket from './socket.js'
import UDPLoggerWriter from './writer.js'

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

    options.fileName ??= `udp-port-${options.port}.log`

    this.#options = options
  }

  start () {
    this.socket = new UDPLoggerSocket(this.#options)
    this.writer = new UDPLoggerWriter(this.#options)

    this.socket.pipe(this.writer)

    this.socket.on('error', this.handleError)
    this.writer.on('error', this.handleError)

    Promise.all([
      EventEmitter.once(this.socket, 'socket:ready'),
      EventEmitter.once(this.writer, 'writer:ready')
    ]).then(() => this.emit('ready'))

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

    this.socket.destroy()
    this.writer.destroy()

    await Promise.all([
      EventEmitter.once(this.socket, 'close'),
      EventEmitter.once(this.writer, 'close')
    ])

    this.emit('close')

    return this
  }
}

export default UDPLoggerServer
