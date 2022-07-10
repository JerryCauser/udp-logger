import crypto from 'node:crypto'
import dgram from 'node:dgram'
import v8 from 'node:v8'
import { Buffer } from 'node:buffer'
import { EventEmitter, once } from 'node:events'
import { generateId, setChunkMetaInfo, ID_SIZE } from './identifier.js'
import { IV_SIZE } from './constants.js'

export const DEFAULT_SERIALIZER = v8.serialize

/**
 * @typedef {object} UDPLoggerClientOptions
 * @property {string} [options.type='udp4']
 * @property {number} [options.port=44002]
 * @property {string} [options.host=('127.0.0.1'|'::1')]
 * @property {number} [options.packetSize=1280] - in bytes
 * @property {object} [options.encryption]
 * @property {string} [options.encryption.algorithm='aes-256-ctr']
 * @property {string} options.encryption.secret
 * @property {function} [options.serializer=v8.serialize]
 */

/**
 * @param {UDPLoggerClientOptions} [options={}]
 * @constructor
 */
class UDPLoggerClient extends EventEmitter {
  #port
  #host
  #type
  #packetSize

  #isAsync
  #serializer

  #encryptionAlgorithm // TODO make it by function
  #encryptionSecret

  #connecting
  #socket

  constructor ({
    type = 'udp4',
    port = 44002,
    host = type === 'udp4' ? '127.0.0.1' : '::1',
    packetSize = 1280,
    isAsync = false,
    encryption,
    serializer = DEFAULT_SERIALIZER,
    ...options
  } = {}) {
    super(options)

    this.#port = port
    this.#host = host
    this.#type = type
    this.#packetSize = packetSize - ID_SIZE

    this.#isAsync = isAsync
    this.#serializer = serializer

    this.#encryptionSecret = encryption?.secret
    this.#encryptionAlgorithm =
      encryption?.algorithm ??
      (this.#encryptionSecret ? 'aes-256-ctr' : undefined)

    if (this.#encryptionSecret) {
      this.#packetSize = packetSize - IV_SIZE
      this.#encryptionSecret = Buffer.from(this.#encryptionSecret)
    }

    this.#socket = dgram.createSocket(this.#type)
    this.#connecting = once(this.#socket, 'connect')
    this.#socket.connect(this.#port, this.#host, () => {
      this.log = isAsync ? this.#asyncLog : this.#syncLog
      this.emit('ready')
    })
  }

  /**
   * @param {string|Buffer} message
   * @returns {Buffer}
   */
  #encryptMessage (message) {
    const iv = crypto.randomBytes(IV_SIZE).subarray(0, IV_SIZE)
    const payload = Buffer.from(message)

    const cipher = crypto.createCipheriv(
      this.#encryptionAlgorithm,
      this.#encryptionSecret,
      iv
    )
    const beginChunk = cipher.update(payload)
    const finalChunk = cipher.final()

    return Buffer.concat(
      [iv, beginChunk, finalChunk],
      IV_SIZE + beginChunk.length + finalChunk.length
    )
  }

  /**
   * @param {*} args
   */
  log = (...args) => {
    this.#connecting.then(() =>
      this.#isAsync ? this.#asyncLog(...args) : this.#syncLog(...args)
    )
  }

  /**
   * @param {*} args
   */
  #syncLog = (...args) => {
    this.#send(this.#serializer(args), generateId())
  }

  /**
   * @param {*} args
   */
  #asyncLog = (...args) => {
    setImmediate(this.#syncLog, ...args)
  }

  /**
   * @param {Buffer} payload
   * @param {Buffer} id
   */
  #send = (payload, id) => {
    const total = Math.ceil(payload.length / this.#packetSize)

    for (let i = 0; i < payload.length; i += this.#packetSize) {
      let chunk = this.#markChunk(
        id,
        total,
        i,
        payload.subarray(i, i + this.#packetSize)
      )

      if (this.#encryptionAlgorithm !== undefined) {
        chunk = this.#encryptMessage(chunk)
      }

      this.#sendChunk(chunk)
    }
  }

  /**
   * @param {Buffer} payload
   */
  #sendChunk = (payload) => {
    this.#socket.send(payload)
  }

  /**
   * @param {Buffer} id
   * @param {number} total
   * @param {number} index
   * @param {Buffer} chunk
   * @returns {Buffer}
   */
  #markChunk (id, total, index, chunk) {
    const marked = Buffer.alloc(chunk.length + ID_SIZE)

    marked.set(id, 0)
    setChunkMetaInfo(marked, total, index)
    marked.set(chunk, ID_SIZE)

    return marked
  }
}

export default UDPLoggerClient
