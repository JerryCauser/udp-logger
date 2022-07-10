import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

const DATE_SIZE = 6

const INCREMENTAL_SIZE = 4
const INCREMENTAL_EDGE = Buffer.alloc(INCREMENTAL_SIZE)
  .fill(0xff)
  .readUIntBE(0, INCREMENTAL_SIZE)

const TIME_META_SIZE = DATE_SIZE + INCREMENTAL_SIZE

const RANDOM_SIZE = 6

const SEED_SIZE = TIME_META_SIZE + RANDOM_SIZE

const COUNTER_TOTAL_SIZE = 3
const COUNTER_INDEX_SIZE = 3
const CHUNK_META_SIZE = COUNTER_TOTAL_SIZE + COUNTER_INDEX_SIZE

export const ID_SIZE = SEED_SIZE + CHUNK_META_SIZE

const CACHE_SIZE = 2048 * RANDOM_SIZE
const CACHE_BUFFER = Buffer.alloc(CACHE_SIZE)

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

  id.set(
    [
      CACHE_BUFFER[cacheOffset],
      CACHE_BUFFER[cacheOffset + 1],
      CACHE_BUFFER[cacheOffset + 2],
      CACHE_BUFFER[cacheOffset + 3],
      CACHE_BUFFER[cacheOffset + 4],
      CACHE_BUFFER[cacheOffset + 5]
    ],
    TIME_META_SIZE
  )

  cacheOffset += RANDOM_SIZE
  incrementId = ++incrementId & INCREMENTAL_EDGE

  id.writeUIntBE(Date.now(), 0, DATE_SIZE)
  id.writeUIntBE(incrementId, DATE_SIZE, INCREMENTAL_SIZE)

  return id
}

const SEED_N_TOTAL_OFFSET = SEED_SIZE + COUNTER_TOTAL_SIZE
/**
 * @param {Buffer} id - prepared id buffer with filled with date + increment + random data
 * @param {number} total
 * @param {number} index
 */
export function setChunkMetaInfo (id, total, index) {
  id.writeUIntBE(total, SEED_SIZE, COUNTER_TOTAL_SIZE)
  id.writeUIntBE(index, SEED_N_TOTAL_OFFSET, COUNTER_INDEX_SIZE)
}

/**
 * @param {Buffer} buffer
 * @returns {[Date, string, number, number]}
 */
export function parseId (buffer) {
  if (buffer.length !== ID_SIZE) throw new Error('id_size_not_valid')

  const date = new Date(buffer.readUintBE(0, DATE_SIZE))
  const id = buffer.subarray(0, SEED_SIZE).toString('hex')
  const total = buffer.readUintBE(SEED_SIZE, COUNTER_TOTAL_SIZE)
  const index = buffer.readUintBE(SEED_N_TOTAL_OFFSET, COUNTER_INDEX_SIZE)

  return [date, id, total, index]
}
