import dgram from 'node:dgram'
import { Buffer } from 'node:buffer'
import { EventEmitter, once } from 'node:events'
import { generateId, setChunkMetaInfo, ID_SIZE } from './identifier.js'
import {
  IV_SIZE,
  DEFAULT_ENCRYPT_FUNCTION,
  DEFAULT_SERIALIZER
} from './constants.js'

/**
 * @typedef {object} UDPLoggerClientOptions
 * @property {string?} [type='udp4']
 * @property {number?} [port=44002]
 * @property {string?} [host=('127.0.0.1'|'::1')]
 * @property {number?} [packetSize=1280] in bytes
 * @property {boolean?} [isAsync=false] enables or not delayed message sending
 * @property {string | ((payload: Buffer) => Buffer)} [encryption]
 *                    if passed string - will be applied aes-256-ctr encryption with passed string as secret;
 *                    if passed function - will be used that function to encrypt every message;
 * @property {(payload: any) => Buffer} [serializer=v8.serialize]
 */

/**
 * @param {UDPLoggerClientOptions} [options={}]
 * @constructor
 */
class UDPLoggerClient extends EventEmitter {
  /** @type {number} */
  #port

  /** @type {string} */
  #host

  /** @type {'udp4'|'udp6'} */
  #type

  /** @type {number} */
  #packetSize

  /** @type {boolean} */
  #isAsync

  /** @type {(any) => Buffer} */
  #serializer

  /** @type {(Buffer) => Buffer} */
  #encryptionFunction

  /** @type {Buffer} */
  #encryptionSecret

  /** @type {Promise<any>} */
  #connecting

  /** @type {dgram.Socket} */
  #socket

  /**
   * @param {UDPLoggerClientOptions} [options]
   */
  constructor ({
    type = 'udp4',
    port = 44002,
    host = type === 'udp4' ? '127.0.0.1' : '::1',
    packetSize = 1280,
    isAsync = false,
    encryption,
    serializer = DEFAULT_SERIALIZER,
    ...eventEmitterOptions
  } = {}) {
    super({ ...eventEmitterOptions })

    this.#port = port
    this.#host = host
    this.#type = type
    this.#packetSize = packetSize - ID_SIZE // max 65507 - ID_SIZE

    this.#isAsync = isAsync
    this.#serializer = serializer

    if (encryption) {
      if (typeof encryption === 'string') {
        this.#packetSize = packetSize - IV_SIZE
        this.#encryptionSecret = Buffer.from(encryption, 'hex')

        this.#encryptionFunction = (data) =>
          DEFAULT_ENCRYPT_FUNCTION(data, this.#encryptionSecret)
      } else if (encryption instanceof Function) {
        this.#encryptionFunction = encryption
      }
    }

    this.#socket = dgram.createSocket(this.#type)
    this.#connecting = once(this.#socket, 'connect')
    this.#socket.connect(this.#port, this.#host, () => {
      this.log = isAsync ? this.#asyncLog : this.#syncLog
      this.emit('ready')
    })
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
    const total = Math.ceil(payload.length / this.#packetSize) - 1

    for (let i = 0; i < payload.length; i += this.#packetSize) {
      let chunk = this.#markChunk(
        id,
        total,
        i / this.#packetSize,
        payload.subarray(i, i + this.#packetSize)
      )

      if (this.#encryptionFunction !== undefined) {
        chunk = this.#encryptionFunction(chunk)
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
    const resultChunk = Buffer.alloc(chunk.length + ID_SIZE)

    resultChunk.set(id, 0)
    setChunkMetaInfo(resultChunk, total, index)
    resultChunk.set(chunk, ID_SIZE)

    return resultChunk
  }
}

export default UDPLoggerClient
