import EventEmitter from 'node:events'
import dgram from 'node:dgram'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

/**
 * @param {string} str
 * @returns {string}
 */
const DEFAULT_MESSAGE_FORMATTER = (str) => {
  return `${new Date().toISOString()}|${str}\n`
}

/**
 * @param {object} options={}
 * @param {string} [options.type='udp4']
 * @param {number} [options.port=44002]
 * @param {string} options.dirName
 * @param {string} [options.fileName]
 * @param {function} [options.formatMessage]
 * @param {object} [options.decryption]
 * @param {object} [options.decryption.algorithm]
 * @param {object} [options.decryption.secret]
 */
class UDPLoggerServer extends EventEmitter {
  #port
  #address
  #type

  #dirName
  #fileName
  #filePath
  #encoding

  #decryptionAlgorithm
  #decryptionSecret

  #instance
  #writeStream

  #formatMessage

  constructor ({
    port = 44002,
    dirName,
    fileName = `udp-port-${port}.log`,
    formatMessage = DEFAULT_MESSAGE_FORMATTER,
    type = 'udp4',
    encoding = 'utf8',
    decryption
  } = {}) {
    super()

    this.#port = port
    this.#dirName = dirName
    this.#fileName = fileName
    this.#encoding = encoding
    this.#formatMessage = formatMessage
    this.#type = type
    this.#decryptionSecret = decryption?.secret
    this.#decryptionAlgorithm = decryption?.algorithm ?? (this.#decryptionSecret ? 'aes-256-ctr' : undefined)

    if (this.#decryptionSecret) {
      this.#decryptionSecret = Buffer.from(this.#decryptionSecret)

      const mainHandler = this.#handleMessage
      this.#handleMessage = data => mainHandler(this.#decryptMessage(data))
    }
  }

  get address () { return this.#address }
  get port () { return this.#port }

  /**
   * @returns {Promise<UDPLoggerServer>}
   */
  async start () {
    await this.#initWriteStream()
    await this.#initSocket()

    this.#address = this.#instance.address().address
    this.#port = this.#instance.address().port

    this.emit('start', this)

    return this
  }

  /**
   * @returns {Promise<UDPLoggerServer>}
   */
  async stop () {
    this.#detachHandlers()
    this.#instance.close()
    this.#writeStream.close()

    await Promise.all([
      new Promise(resolve => {
        this.#instance.once('close', resolve)
      }),
      new Promise(resolve => {
        this.#writeStream.once('close', resolve)
      })
    ])

    return this
  }

  async #initWriteStream () {
    this.#filePath = path.resolve(this.#dirName, this.#fileName)
    this.#writeStream = fs.createWriteStream(this.#filePath)

    await new Promise(resolve => {
      this.#writeStream.once('ready', resolve)
    })
  }

  async #initSocket () {
    this.#instance = dgram.createSocket({ type: this.#type })
    this.#attachHandlers()
    this.#instance.bind(this.#port)

    await new Promise(resolve => {
      this.#instance.once('listening', resolve)
    })
  }

  /**
   * @param {Buffer} buffer
   * @returns {Buffer}
   */
  #decryptMessage (buffer) {
    console.log({ buffer })
    const iv = buffer.subarray(0, 16)
    const payload = buffer.subarray(16)

    console.log(this.#decryptionAlgorithm, this.#decryptionSecret.length, iv.length)

    const decipher = crypto.createDecipheriv(this.#decryptionAlgorithm, this.#decryptionSecret, iv)
    const beginChunk = decipher.update(payload)
    const finalChunk = decipher.final()
    const result = Buffer.concat([beginChunk, finalChunk], beginChunk.length + finalChunk.length)

    return result
  }

  #attachHandlers () {
    this.#instance.on('close', this.#handleClose)
    this.#instance.on('error', this.#handleError)
    this.#instance.on('message', this.#handleMessage)
    this.#writeStream.on('close', this.#handleFileClose)
  }

  #detachHandlers () {
    this.#instance.off('close', this.#handleClose)
    this.#instance.off('error', this.#handleError)
    this.#instance.off('message', this.#handleMessage)
    this.#writeStream.off('close', this.#handleFileClose)
  }

  #handleClose = () => {
    this.emit('close')
  }

  #handleError = (error) => {
    this.emit('error', error)
    this.stop().catch(error => this.emit('error', error))
  }

  #handleMessage = (msg) => {
    this.#write(msg).catch(error => this.emit('error', error))
  }

  #handleFileClose = () => {
    this.emit('error', new Error('file_write_stream_closed'))
    this.stop().catch(error => this.emit('error', error))
  }

  /**
   * @param {Buffer} data
   * @returns {Promise<void>}
   */
  #write = async (data) => {
    await new Promise(resolve => {
      if (!this.#writeStream.write(this.#formatMessage(data.toString(this.#encoding)), this.#encoding)) {
        this.#writeStream.once('drain', resolve)
      } else {
        process.nextTick(resolve)
      }
    })
  }
}

export default UDPLoggerServer
