import v8 from 'node:v8'
import util from 'node:util'

/**
 * @param {string|Buffer|Uint8Array} msg
 * @param {Date} date
 * @returns {string|Buffer|Uint8Array}
 */
export const DEFAULT_MESSAGE_FORMATTER = (msg, date) => {
  return `${date.toISOString()}|${msg}\n`
}

const DEFAULT_FORMAT_OPTIONS = {
  depth: null,
  maxStringLength: null,
  maxArrayLength: null,
  breakLength: 80
}

/**
 * @param {Buffer} buffer
 * @returns {string|Buffer|Uint8Array}
 */
export const DEFAULT_SERIALIZER = (buffer) => {
  const data = v8.deserialize(buffer)
  data.unshift(DEFAULT_FORMAT_OPTIONS)

  return util.formatWithOptions.apply(util, data)
}
