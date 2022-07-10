import v8 from 'node:v8'
import util from 'node:util'

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

export const DEFAULT_PORT = 44002
export const IV_SIZE = 16
