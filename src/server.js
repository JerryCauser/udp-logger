import { EventEmitter } from 'node:events'
import UdpLoggerSocket from './udp-logger-socket.js'
import UdpLoggerWriter from './writer.js'
import { DEFAULT_PORT } from './constants.js'

/**
 * @param {UdpSocketOptions & UdpLoggerSocketOptions & UdpLoggerWriterOptions} [options={}]
 * @constructor
 */
class UdpLoggerServer extends EventEmitter {
  #options

  socket
  writer

  constructor (options = {}) {
    super(options)

    options.filePath ??= `./udp-port-${options.port || DEFAULT_PORT}.log`

    this.#options = options
  }

  async start () {
    this.socket = new UdpLoggerSocket(this.#options)
    this.writer = new UdpLoggerWriter(this.#options)

    this.socket.pipe(this.writer)

    this.socket.on('error', this.#handleError)
    this.writer.on('error', this.#handleError)
    this.socket.on('warning', this.#handleWarning)

    await Promise.all([
      EventEmitter.once(this.socket, 'ready'),
      EventEmitter.once(this.writer, 'ready')
    ])

    this.emit('ready')

    return this
  }

  /**
   * @param {Error~object} error
   */
  #handleError = (error) => {
    this.emit('error', error)
  }

  /**
   * @param {any} warning
   */
  #handleWarning = (warning) => {
    this.emit('warning', warning)
  }

  async stop () {
    this.socket.off('error', this.#handleError)
    this.writer.off('error', this.#handleError)
    this.socket.off('warning', this.#handleWarning)

    this.socket.push(null) // it will cause ending of readable and after writable stream

    await Promise.all([
      EventEmitter.once(this.socket, 'close'),
      EventEmitter.once(this.writer, 'close')
    ])

    this.emit('close')

    return this
  }
}

export default UdpLoggerServer
