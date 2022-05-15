import EventEmitter from 'node:events'
import path from 'node:path'
import fs from 'node:fs'
import UDPLoggerSocket from './socket.js'

/**
 * @param {Date} date
 * @param {string} str
 * @returns {string}
 */
export const DEFAULT_MESSAGE_FORMATTER = (str, date) => {
  return `${date.toISOString()}|${str}\n`
}

/**
 * @param {object} options={}
 * @param {string} [options.type='udp4']
 * @param {number} [options.port=44002]
 * @param {string} options.dirName
 * @param {string} [options.fileName]
 * @param {string} [options.encoding='utf8']
 * @param {string} [options.socketEncoding=options.encoding]
 * @param {object} [options.decryption]
 * @param {object} [options.decryption.algorithm]
 * @param {object} [options.decryption.secret]
 * @param {number} [options.writeInterval=1000]
 * @param {function} [options.formatMessage]
 * @param {function} [options.deserializer]
 */
class UDPLoggerServer extends UDPLoggerSocket {
  #dirName
  #fileName
  #filePath
  #encoding

  #writeStream
  #formatMessage

  constructor ({
    port,
    dirName,
    fileName = `udp-port-${port}.log`,
    encoding = 'utf8',
    socketEncoding = encoding,
    formatMessage = DEFAULT_MESSAGE_FORMATTER,
    ...args
  } = {}) {
    super({
      port,
      encoding: socketEncoding,
      ...args
    })

    this.#dirName = dirName
    this.#fileName = fileName
    this.#encoding = encoding
    this.#formatMessage = formatMessage
  }

  /**
   * @returns {Promise<UDPLoggerServer>}
   */
  async start () {
    await super.start()
    await this.#initWriting()
    this.#attachHandlers()

    this.emit('start', this)

    return this
  }

  /**
   * @returns {Promise<UDPLoggerServer>}
   */
  async stop () {
    await super.stop()
    this.#detachHandlers()
    this.#writeStream.close()

    await EventEmitter.once(this.#writeStream, 'close')

    return this
  }

  async #initWriting () {
    this.#filePath = path.resolve(this.#dirName, this.#fileName)
    this.#writeStream = fs.createWriteStream(this.#filePath, { flags: 'a' })

    await EventEmitter.once(this.#writeStream, 'ready')
  }

  #attachHandlers () {
    this.on('message', this.#handleMessage)
    this.#writeStream.on('close', this.#handleFileClose)
  }

  #detachHandlers () {
    this.off('message', this.#handleMessage)
    this.#writeStream.off('close', this.#handleFileClose)
  }

  /**
   * @param {object} data
   * @param {Buffer} data.message
   * @param {Date} [data.date]
   * @returns {Promise<void>}
   */
  #handleMessage = async ({ message, date = new Date() }) => {
    await new Promise(resolve => {
      const writeSuccess = this.#writeStream.write(this.#formatMessage(message, date), this.#encoding)

      if (writeSuccess) {
        resolve()
      } else {
        this.#writeStream.once('drain', resolve)
      }
    })
  }

  #handleFileClose = () => {
    this.emit('error', new Error('file_write_stream_closed'))
    this.stop().catch(error => this.emit('error', error))
  }
}

export default UDPLoggerServer
