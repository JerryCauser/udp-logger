import crypto from 'node:crypto'
import dgram from 'node:dgram'
import v8 from 'node:v8'
import { Buffer } from 'node:buffer'
import { generateId, ID_SIZE } from './identifier.js'

const IV_SIZE = 16

export const DEFAULT_SERIALIZER = v8.serialize

/**
 * @typedef {object} UDPLoggerClientOptions
 * @property {string} [options.type='udp4']
 * @property {number} [options.port=44002]
 * @property {string} [options.host=('127.0.0.1'|'::1')]
 * @property {number} [options.packetSize=1280]
 * @property {object} [options.encryption]
 * @property {string} [options.encryption.algorithm='aes-256-ctr']
 * @property {string} options.encryption.secret
 * @property {function} [options.serializer=v8.serialize]
 */

/**
 * @param {UDPLoggerClientOptions} [options={}]
 * @constructor
 */
class UDPLoggerClient {
  #port
  #host
  #type
  #packetSize

  #serializer

  #encryptionAlgorithm
  #encryptionSecret

  constructor ({
    type = 'udp4',
    port = 44002,
    host = type === 'udp4' ? '127.0.0.1' : '::1',
    packetSize = 1280,
    encryption,
    serializer = DEFAULT_SERIALIZER
  } = {}) {
    this.#port = port
    this.#host = host
    this.#type = type
    this.#packetSize = packetSize - ID_SIZE

    this.#serializer = serializer

    this.#encryptionSecret = encryption?.secret
    this.#encryptionAlgorithm =
      encryption?.algorithm ??
      (this.#encryptionSecret ? 'aes-256-ctr' : undefined)

    if (this.#encryptionSecret) {
      this.#packetSize = packetSize - IV_SIZE
      this.#encryptionSecret = Buffer.from(this.#encryptionSecret)
    }
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
    const result = Buffer.concat(
      [iv, beginChunk, finalChunk],
      IV_SIZE + beginChunk.length + finalChunk.length
    )

    return result
  }

  /**
   * @param {*} args
   */
  log = (...args) => {
    const id = generateId()
    this.send(this.#serializer(args), id)
  }

  /**
   * @param {Buffer} payload
   * @param {Buffer} id
   */
  send = (payload, id = generateId()) => {
    for (let i = 0; i < payload.length; i += this.#packetSize) {
      let chunk = this.#markChunk(
        id,
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
    const client = dgram.createSocket(this.#type)
    client.send(payload, this.#port, this.#host, (err) => {
      if (err) console.error(err)
      client.close()
    })
  }

  /**
   * @param {Buffer} id
   * @param {Buffer} chunk
   * @returns {Buffer}
   */
  #markChunk (id, chunk) {
    const marked = Buffer.alloc(chunk.length + ID_SIZE)

    marked.set(id, 0)
    marked.set(chunk, ID_SIZE)

    return marked
  }
}

export default UDPLoggerClient
