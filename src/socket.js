import EventEmitter from 'node:events'
import crypto from 'node:crypto'
import dgram from 'node:dgram'
import util from 'node:util'
import v8 from 'node:v8'
import { Buffer } from 'node:buffer'
import { ID_SIZE, parseId, BUFFER_COMPARE_SORT_FUNCTION } from './identifier.js'

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
 * @param {string} [options.encoding='utf8']
 * @param {object} [options.decryption]
 * @param {object} [options.decryption.algorithm]
 * @param {object} [options.decryption.secret]
 * @param {number} [options.collectorInterval=1000]
 * @param {function} [options.deserializer]
 */
class UDPLoggerSocket extends EventEmitter {
  #port
  #address
  #type

  #encoding

  #decryptionAlgorithm
  #decryptionSecret

  #socket

  #deserializer

  #collector = []
  #collectorIntervalId
  #collectorIntervalTime

  constructor ({
    type = 'udp4',
    port = 44002,
    encoding = 'utf8',
    decryption,
    collectorInterval = 1000,
    deserializer = DEFAULT_SERIALIZER
  } = {}) {
    super()

    this.#port = port
    this.#encoding = encoding
    this.#deserializer = deserializer
    this.#type = type
    this.#decryptionSecret = decryption?.secret
    this.#decryptionAlgorithm = decryption?.algorithm ?? (this.#decryptionSecret ? 'aes-256-ctr' : undefined)

    this.#collectorIntervalTime = collectorInterval

    this.#handleMessage = this.#handlePlainMessage

    if (this.#decryptionSecret) {
      this.#decryptionSecret = Buffer.from(this.#decryptionSecret)

      this.#handleMessage = this.#handleEncryptedMessage
    }
  }

  get address () { return this.#address }
  get port () { return this.#port }

  /**
   * @returns {Promise<UDPLoggerSocket>}
   */
  async start () {
    this.#collector = []
    this.#collectorIntervalId = setInterval(this.#collectorIntervalFunction, this.#collectorIntervalTime)
    await this.#initSocket()
    this.#attachHandlers()

    this.#address = this.#socket.address().address
    this.#port = this.#socket.address().port

    this.emit('start:socket', this)

    return this
  }

  /**
   * @returns {Promise<UDPLoggerSocket>}
   */
  async stop () {
    clearInterval(this.#collectorIntervalId)
    this.#detachHandlers()
    this.#socket.close()

    await EventEmitter.once(this.#socket, 'close')

    this.#collector = []

    return this
  }

  async #initSocket () {
    this.#socket = dgram.createSocket({ type: this.#type })
    this.#socket.bind(this.#port)

    await EventEmitter.once(this.#socket, 'listening')
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
  }

  #detachHandlers () {
    this.#socket.off('close', this.#handleClose)
    this.#socket.off('error', this.#handleError)
    this.#socket.off('message', this.#handleMessage)
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

  /**
   * @param {Buffer} buffer
   */
  #handleEncryptedMessage = (buffer) => {
    return this.#handlePlainMessage(this.#decryptMessage(buffer))
  }

  #collectorIntervalFunction = () => {
    if (this.#collector.length === 0) return

    const collector = this.#collector
    this.#collector = []

    collector.sort(BUFFER_COMPARE_SORT_FUNCTION) // it will also sort by date

    let prevBuffer = collector[0]
    let body = [collector[0].subarray(ID_SIZE)]

    if (collector.length > 1) {
      for (let i = 1; i < collector.length; ++i) {
        const buffer = collector[i]

        if (buffer.compare(prevBuffer, 0, ID_SIZE, 0, ID_SIZE) !== 0) { // if current id NOT equal to previous
          this.#compileMessage(prevBuffer, body)

          prevBuffer = buffer
          body = []
        }

        body.push(buffer.subarray(ID_SIZE))
      }
    }

    this.#compileMessage(prevBuffer, body)
  }

  /**
   * @param {Buffer} meta
   * @param {Buffer[]} body
   */
  #compileMessage (meta, body) {
    const deserializedBody = this.#deserializer(body.length === 1 ? body[0] : Buffer.concat(body))
    const date = parseId(meta.subarray(0, ID_SIZE))[0]

    this.emit('message', { date, message: deserializedBody })
  }
}

export default UDPLoggerSocket
