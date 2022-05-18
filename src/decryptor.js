import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import { Transform } from 'node:stream'

/**
 * @typedef {object} UDPLoggerDecryptorOptions
 * @property {object} [options.algorithm]
 * @property {object} [options.secret]
 *
 * @typedef {ReadableOptions & UDPLoggerDecryptorOptions}
 */

/**
 * @param {UDPLoggerDecryptorOptions} [options={}]
 * @constructor
 */
class UDPLoggerDecryptor extends Transform {
  #algorithm
  #secret

  #messages = []
  #allowPush = true

  constructor ({
    secret,
    algorithm = 'aes-256-ctr',
    ...options
  } = {}) {
    super(options)

    console.log({ secret, algorithm })

    this.#secret = Buffer.from(secret)
    this.#algorithm = algorithm
  }

  _construct (callback) {
    this.emit('decryptor:ready')
    callback()
  }

  _destroy (error, callback) {
    if (error) {
      this.emit('error', error)
    }
    this.#messages = []

    callback(error)
  }

  _read (size) {
    this.#sendBufferedMessages()

    this.#allowPush = this.#messages.length === 0
  }

  _transform (data, encoding, callback) {
    try {
      this.#addMessage(this.#decryptMessage(data))
      callback()
    } catch (error) {
      callback(error)
    }
  }

  _flush (callback) {
    this.#allowPush = false
    this.#sendBufferedMessages()

    callback()
  }

  /**
   * @param {*} message
   */
  #addMessage (message) {
    if (this.#allowPush) {
      this.#allowPush = this.push(message)
    } else {
      this.#messages.push(message)
    }
  }

  #sendBufferedMessages () {
    if (this.#messages.length === 0) return

    for (let i = 0; i < this.#messages.length; ++i) {
      if (!this.push(this.#messages[i])) {
        this.#messages.splice(0, i + 1)
        break
      }
    }
  }

  /**
   * @param {Buffer} buffer
   * @returns {Buffer}
   */
  #decryptMessage (buffer) {
    const iv = buffer.subarray(0, 16)
    const payload = buffer.subarray(16)

    const decipher = crypto.createDecipheriv(
      this.#algorithm,
      this.#secret,
      iv
    )
    const beginChunk = decipher.update(payload)
    const finalChunk = decipher.final()

    return Buffer.concat(
      [beginChunk, finalChunk],
      beginChunk.length + finalChunk.length
    )
  }
}

export default UDPLoggerDecryptor
