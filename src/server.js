import crypto from 'node:crypto'
import dgram from 'node:dgram'
import path from 'node:path'
import util from 'node:util'
import v8 from 'node:v8'
import fs from 'node:fs'
import { Buffer } from 'node:buffer'
import { EventEmitter } from 'node:events'
import { ID_SIZE, parseId, BUFFER_COMPARE_SORT_FUNCTION } from './identifier.js'

/**
 * @param {Date} date
 * @param {string} str
 * @returns {string}
 */
export const DEFAULT_MESSAGE_FORMATTER = (str, date) => {
  return `${date.toISOString()}|${str}\n`
}

export const DEFAULT_FORMAT_OPTIONS = {
  depth: null,
  maxStringLength: null,
  maxArrayLength: null,
  breakLength: 80
}

/**
 * @param {Buffer} buffer
 * @returns {string}
 */
export const DEFAULT_SERIALIZER = (buffer) => {
  const data = v8.deserialize(buffer)
  data.unshift(DEFAULT_FORMAT_OPTIONS)

  return util.formatWithOptions.apply(util, data)
}

/**
 * @param {object} options={}
 * @param {string} [options.type='udp4']
 * @param {number} [options.port=44002]
 * @param {string} options.dirName
 * @param {string} [options.fileName]
 * @param {string} [options.encoding='utf8']
 * @param {object} [options.decryption]
 * @param {object} [options.decryption.algorithm]
 * @param {object} [options.decryption.secret]
 * @param {number} [options.writeInterval=1000]
 * @param {function} [options.formatMessage]
 * @param {function} [options.deserializer]
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

  #socket
  #writeStream

  #deserializer
  #formatMessage

  #writeIntervalId
  #writeIntervalTime
  #collector = []

  constructor ({
    type = 'udp4',
    port = 44002,
    dirName,
    fileName = `udp-port-${port}.log`,
    encoding = 'utf8',
    decryption,
    deserializer = DEFAULT_SERIALIZER,
    formatMessage = DEFAULT_MESSAGE_FORMATTER,
    writeIntervalTime = 1000
  } = {}) {
    super()

    this.#port = port
    this.#dirName = dirName
    this.#fileName = fileName
    this.#encoding = encoding
    this.#deserializer = deserializer
    this.#formatMessage = formatMessage
    this.#type = type
    this.#decryptionSecret = decryption?.secret
    this.#decryptionAlgorithm = decryption?.algorithm ?? (this.#decryptionSecret ? 'aes-256-ctr' : undefined)

    this.#writeIntervalTime = writeIntervalTime

    this.#handleMessage = this.#handlePlainMessage

    if (this.#decryptionSecret) {
      this.#decryptionSecret = Buffer.from(this.#decryptionSecret)

      this.#handleMessage = this.#handleEncryptedMessage
    }
  }

  get address () { return this.#address }
  get port () { return this.#port }

  /**
   * @returns {Promise<UDPLoggerServer>}
   */
  async start () {
    this.#collector = []
    await this.#initWriting()
    this.#writeIntervalId = setInterval(this.#writeIntervalFunction, this.#writeIntervalTime)
    await this.#initSocket()

    this.#address = this.#socket.address().address
    this.#port = this.#socket.address().port

    this.emit('start', this)

    return this
  }

  /**
   * @returns {Promise<UDPLoggerServer>}
   */
  async stop () {
    clearInterval(this.#writeIntervalId)
    this.#detachHandlers()
    this.#socket.close()
    this.#writeStream.close()

    await Promise.all([
      new Promise(resolve => {
        this.#socket.once('close', resolve)
      }),
      new Promise(resolve => {
        this.#writeStream.once('close', resolve)
      })
    ])

    this.#collector = []

    return this
  }

  async #initWriting () {
    this.#filePath = path.resolve(this.#dirName, this.#fileName)
    this.#writeStream = fs.createWriteStream(this.#filePath, { flags: 'a' })

    await new Promise(resolve => {
      this.#writeStream.once('ready', resolve)
    })
  }

  async #initSocket () {
    this.#socket = dgram.createSocket({ type: this.#type })
    this.#attachHandlers()
    this.#socket.bind(this.#port)

    await new Promise(resolve => {
      this.#socket.once('listening', resolve)
    })
  }

  /**
   * @param {Buffer} buffer
   * @returns {Buffer}
   */
  #decryptMessage (buffer) {
    const iv = buffer.subarray(0, 16)
    const payload = buffer.subarray(16)

    const decipher = crypto.createDecipheriv(this.#decryptionAlgorithm, this.#decryptionSecret, iv)
    const beginChunk = decipher.update(payload)
    const finalChunk = decipher.final()
    const result = Buffer.concat([beginChunk, finalChunk], beginChunk.length + finalChunk.length)

    return result
  }

  #attachHandlers () {
    this.#socket.on('close', this.#handleClose)
    this.#socket.on('error', this.#handleError)
    this.#socket.on('message', this.#handleMessage)
    this.#writeStream.on('close', this.#handleFileClose)
  }

  #detachHandlers () {
    this.#socket.off('close', this.#handleClose)
    this.#socket.off('error', this.#handleError)
    this.#socket.off('message', this.#handleMessage)
    this.#writeStream.off('close', this.#handleFileClose)
  }

  #handleClose = () => {
    this.emit('close')
  }

  #handleError = (error) => {
    this.emit('error', error)
    this.stop().catch(error => this.emit('error', error))
  }

  #handleMessage = () => {
    throw new Error('handle_message_not_attached')
  }

  /**
   * @param {Buffer} buffer
   */
  #handlePlainMessage = (buffer) => {
    this.#collector.push(buffer)
  }

  #handleEncryptedMessage = (buffer) => {
    return this.#handlePlainMessage(this.#decryptMessage(buffer))
  }

  #handleFileClose = () => {
    this.emit('error', new Error('file_write_stream_closed'))
    this.stop().catch(error => this.emit('error', error))
  }

  /**
   * @param {Buffer|string} body
   * @param {Date} [date]
   * @returns {Promise<void>}
   */
  #write = async (body, date = new Date()) => {
    if (Buffer.isBuffer(body)) body = body.toString(this.#encoding)

    await new Promise(resolve => {
      if (!this.#writeStream.write(this.#formatMessage(body, date), this.#encoding)) {
        this.#writeStream.once('drain', resolve)
      } else {
        process.nextTick(resolve)
      }
    })
  }

  #writeIntervalFunction = () => {
    if (this.#collector.length === 0) return

    const collector = this.#collector
    this.#collector = []

    collector.sort(BUFFER_COMPARE_SORT_FUNCTION) // it will also sort by date

    let prevBuffer = collector[0]
    let body = [collector[0].subarray(ID_SIZE)]

    if (collector.length > 1) {
      for (let i = 1; i < collector.length; ++i) {
        const buffer = collector[i]

        if (buffer.compare(prevBuffer, 0, ID_SIZE, 0, ID_SIZE) !== 0) { // check id equality
          this.#writeIntervalCompileMessage(prevBuffer, body)

          prevBuffer = buffer
          body = []
        }

        body.push(buffer.subarray(ID_SIZE))
      }
    }

    this.#writeIntervalCompileMessage(prevBuffer, body)
  }

  /**
   * @param {Buffer} meta
   * @param {Buffer[]} body
   */
  #writeIntervalCompileMessage (meta, body) {
    const deserializedBody = this.#deserializer(body.length === 1 ? body[0] : Buffer.concat(body))
    const date = parseId(meta.subarray(0, ID_SIZE))[0]

    this.#write(deserializedBody, date)
      .catch(error => this.emit('error', error))
  }
}

export default UDPLoggerServer
