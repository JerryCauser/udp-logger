import v8 from 'node:v8'
import util from 'node:util'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

const DEFAULT_FORMAT_OPTIONS = {
  depth: null,
  maxStringLength: null,
  maxArrayLength: null,
  breakLength: 80
}

/**
 * @param {any} data
 * @param {Date} date
 * @param {number|string} id
 * @returns {string|Buffer|Uint8Array}
 */
export const DEFAULT_MESSAGE_FORMATTER = (data, date, id) => {
  data.unshift(DEFAULT_FORMAT_OPTIONS)
  data = util.formatWithOptions.apply(util, data)

  return `${date.toISOString()}|${id}|${data}\n`
}

/**
 * @param {Buffer} buffer
 * @returns {any}
 */
export const DEFAULT_DESERIALIZER = v8.deserialize

/**
 * @param {any} buffer
 * @returns {Buffer}
 */
export const DEFAULT_SERIALIZER = v8.serialize

export const DEFAULT_PORT = 44002

export const IV_SIZE = 16

const DEFAULT_ENCRYPTION = 'aes-256-ctr'
/**
 * @param {Buffer} payload
 * @param {Buffer} secret
 * @returns {Buffer}
 */
export const DEFAULT_ENCRYPT_FUNCTION = (payload, secret) => {
  const iv = crypto.randomBytes(IV_SIZE).subarray(0, IV_SIZE)
  const cipher = crypto.createCipheriv(DEFAULT_ENCRYPTION, secret, iv)
  const beginChunk = cipher.update(payload)
  const finalChunk = cipher.final()

  return Buffer.concat(
    [iv, beginChunk, finalChunk],
    IV_SIZE + beginChunk.length + finalChunk.length
  )
}

/**
 * @param {Buffer} buffer
 * @param {Buffer} secret
 * @returns {Buffer}
 */
export const DEFAULT_DECRYPT_FUNCTION = (buffer, secret) => {
  const iv = buffer.subarray(0, IV_SIZE)
  const payload = buffer.subarray(IV_SIZE)
  const decipher = crypto.createDecipheriv(DEFAULT_ENCRYPTION, secret, iv)
  const beginChunk = decipher.update(payload)
  const finalChunk = decipher.final()

  return Buffer.concat(
    [beginChunk, finalChunk],
    beginChunk.length + finalChunk.length
  )
}
