import { EventEmitter } from 'node:events'
import UDPLoggerPlainSocket from './plain-socket.js'
import UDPLoggerDecryptor from './decryptor.js'
import UDPLoggerCollector from './collector.js'
import UDPLoggerDeserializer from './deserializer.js'
import UDPLoggerFormatter from './formatter.js'
import UDPLoggerWriter from './writer.js'
import { DEFAULT_PORT } from './constants.js'

/**
 * @param {UDPLoggerSocketOptions & UDPLoggerWriterOptions} [options={}]
 * @constructor
 */
class UDPLoggerServer extends EventEmitter {
  #options

  socket
  decryptor
  collector
  deserializer
  formatter
  writer

  constructor (options = {}) {
    super(options)

    options.fileName ??= `udp-port-${options.port || DEFAULT_PORT}.log`

    this.#options = options
  }

  async start () {
    this.socket = new UDPLoggerPlainSocket(this.#options)
    this.collector = new UDPLoggerCollector(this.#options)
    this.deserializer = new UDPLoggerDeserializer(this.#options)
    this.formatter = new UDPLoggerFormatter(this.#options)
    this.writer = new UDPLoggerWriter(this.#options)

    this.stream = this.socket

    if (this.#options.decryption) {
      this.decryptor = new UDPLoggerDecryptor(this.#options.decryption)

      this.stream = this.stream.pipe(this.decryptor)

      this.decryptor.on('error', this.handleError)
    }

    this.stream = this.stream
      .pipe(this.collector)
      .pipe(this.deserializer)
      .pipe(this.formatter)
      .pipe(this.writer)

    this.socket.on('error', this.handleError)
    this.collector.on('error', this.handleError)
    this.deserializer.on('error', this.handleError)
    this.formatter.on('error', this.handleError)
    this.writer.on('error', this.handleError)

    this.deserializer.on('warning', this.handleError)
    this.formatter.on('warning', this.handleError)

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
    this.collector.off('error', this.handleError)
    this.deserializer.off('error', this.handleError)
    this.formatter.off('error', this.handleError)
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
