import UdpClient from './udp-client.js'
import { DEFAULT_SERIALIZER } from './constants.js'

/**
 * @import('./udp-client.js')
 */

/**
 *
 * @typedef {object} UdpLoggerClientOptions
 * @property {boolean?} [sync=true] disables/enables delayed message sending
 * @property {(payload: any) => Buffer} [serializer=v8.serialize]
 *
 */

/**
 * @param {UdpLoggerClientOptions} [options={}]
 * @constructor
 */
class UdpLoggerClient extends UdpClient {
  /** @type {boolean} */
  #sync

  /** @type {(any) => Buffer} */
  #serializer

  /**
   * @param {UdpLoggerClientOptions} [options]
   */
  constructor ({
    serializer = DEFAULT_SERIALIZER,
    sync = false,
    ...udpClientOptions
  } = {}) {
    super({ ...udpClientOptions })

    this.#sync = sync
    this.#serializer = serializer
  }

  /**
   * @param {any[]} args
   */
  log (...args) {
    if (this.#sync) {
      return this.#logSync(args)
    } else {
      return this.#logAsync(args)
    }
  }

  /**
   * @param {any[]} args
   */
  #logSync (args) {
    this.send(this.#serializer(args))
  }

  /**
   * @param {any[]} args
   */
  #logAsync (args) {
    setImmediate(() => this.send(this.#serializer(args)))
  }
}

export default UdpLoggerClient
