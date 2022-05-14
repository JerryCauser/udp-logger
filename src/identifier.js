import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

export const ID_SIZE = 16
const DATE_SIZE = 6
const INCREMENTAL_SIZE = 4
const INCREMENTAL_EDGE = Buffer.alloc(INCREMENTAL_SIZE).fill(0xff).readUIntBE(0, INCREMENTAL_SIZE)
const TIME_META_SIZE = DATE_SIZE + INCREMENTAL_SIZE
const SLICE_SIZE = ID_SIZE - TIME_META_SIZE
const CACHE_SIZE = 2048 * SLICE_SIZE
const CACHE_BUFFER = Buffer.alloc(CACHE_SIZE)

export const BUFFER_COMPARE_SORT_FUNCTION = (a, b) => a.compare(b, 0, TIME_META_SIZE, 0, TIME_META_SIZE)

let incrementId = 0
let cacheOffset = 0

function refreshCache () {
  cacheOffset = 0
  crypto.randomFillSync(CACHE_BUFFER, 0, CACHE_SIZE)
}

refreshCache()

/**
 * @returns {Buffer}
 */
export function generateId () {
  if (cacheOffset >= CACHE_SIZE) refreshCache()

  const id = Buffer.alloc(ID_SIZE)

  id.set([
    CACHE_BUFFER[cacheOffset],
    CACHE_BUFFER[cacheOffset + 1],
    CACHE_BUFFER[cacheOffset + 2],
    CACHE_BUFFER[cacheOffset + 3],
    CACHE_BUFFER[cacheOffset + 4],
    CACHE_BUFFER[cacheOffset + 5]
  ], TIME_META_SIZE)

  cacheOffset += SLICE_SIZE
  incrementId = ++incrementId & INCREMENTAL_EDGE

  id.writeUIntBE(Date.now(), 0, DATE_SIZE)
  id.writeUIntBE(incrementId, DATE_SIZE, INCREMENTAL_SIZE)

  return id
}

/**
 * @param {Buffer} buffer
 * @returns {[Date, string]}
 */
export function parseId (buffer) {
  if (buffer.length !== ID_SIZE) throw new Error('id_size_not_valid')

  const date = new Date(buffer.readUintBE(0, 6))
  const id = buffer.toString('hex')

  return [date, id]
}
