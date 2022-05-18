import v8 from 'node:v8'
import util from 'node:util'

/**
 * @param {*} data
 * @param {Date} date
 * @param {number|string} id
 * @returns {string|Buffer|Uint8Array}
 */
export const DEFAULT_MESSAGE_FORMATTER = (data, date, id) => {
  data.unshift(DEFAULT_FORMAT_OPTIONS)
  data = util.formatWithOptions.apply(util, data)

  return `${date.toISOString()}|${id}|${data}\n`
}

const DEFAULT_FORMAT_OPTIONS = {
  depth: null,
  maxStringLength: null,
  maxArrayLength: null,
  breakLength: 80
}

/**
 * @param {Buffer} buffer
 * @returns {*}
 */
export const DEFAULT_SERIALIZER = (buffer) => {
  return v8.deserialize(buffer)
}

export const DEFAULT_PORT = 44002
