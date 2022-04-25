import dgram from 'node:dgram'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import * as util from 'util'

const IV_SIZE = 16

/**
 * @param {object} [options={}]
 * @param {string} [options.type='udp4']
 * @param {number} [options.port=44002]
 * @param {string} [options.host=('127.0.0.1'|'::1')]
 * @param {object} [options.encryption]
 * @param {string} [options.encryption.algorithm='aes-256-ctr']
 * @param {string} options.encryption.secret
 */
class UDPLoggerClient {
  #port
  #host
  #type
  #mtu

  #format = {
    depth: null,
    maxStringLength: null,
    maxArrayLength: null,
    breakLength: 80
  }

  #encryptionAlgorithm
  #encryptionSecret

  constructor ({
    type = 'udp4',
    port = 44002,
    host = type === 'udp4' ? '127.0.0.1' : '::1',
    mtu = 1280,
    encryption,
    format
  } = {}) {
    this.#port = port
    this.#host = host
    this.#type = type
    this.#mtu = mtu

    if (typeof format === 'object') Object.assign(this.#format, format)

    this.#encryptionSecret = encryption?.secret
    this.#encryptionAlgorithm = encryption?.algorithm ?? (this.#encryptionSecret ? 'aes-256-ctr' : undefined)

    if (this.#encryptionSecret) {
      this.#mtu = mtu - IV_SIZE
      this.#encryptionSecret = Buffer.from(this.#encryptionSecret)

      const _send = this.send
      this.send = message => _send(this.#encryptMessage(message))
    }
  }

  /**
   * @param {string|Buffer} message
   * @returns {Buffer}
   */
  #encryptMessage (message) {
    const iv = crypto.randomBytes(IV_SIZE).subarray(0, IV_SIZE)
    const payload = Buffer.from(message)

    const cipher = crypto.createCipheriv(this.#encryptionAlgorithm, this.#encryptionSecret, iv)
    const beginChunk = cipher.update(payload)
    const finalChunk = cipher.final()
    const result = Buffer.concat([iv, beginChunk, finalChunk], IV_SIZE + beginChunk.length + finalChunk.length)

    return result
  }

  /**
   * @param {*} args
   */
  log = (...args) => {
    this.send(util.formatWithOptions(this.#format, ...args))
  }

  /**
   * @param {string|Buffer} message
   */
  send = (message) => {
    let payload = Buffer.from(message)

    if (payload.length > this.#mtu) {
      const surplus = payload.subarray(this.#mtu)
      setImmediate(() => this.send(surplus))

      payload = payload.subarray(0, this.#mtu)
    }

    const client = dgram.createSocket(this.#type)
    client.send(payload, this.#port, this.#host, (err) => {
      if (err) console.error(err)
      client.close()
    })
  }
}

export default UDPLoggerClient
