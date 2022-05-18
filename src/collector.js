import { Transform } from 'node:stream'
import {
  ID_SIZE,
  BUFFER_COMPARE_SORT_FUNCTION
} from './identifier.js'

/**
 * @typedef {object} UDPLoggerCollectorOptions
 * @property {number} [options.collectorInterval=1000]
 *
 * @typedef {ReadableOptions & UDPLoggerCollectorOptions}
 */

/**
 * @param {UDPLoggerCollectorOptions} [options={}]
 * @constructor
 */
class UDPLoggerCollector extends Transform {
  #collector = []
  #collectorIntervalId
  #collectorIntervalTime

  #allowPush = true
  #messages = []

  constructor ({
    collectorInterval = 1000,
    ...options
  } = {}) {
    super({ ...options, objectMode: true })

    this.#collectorIntervalTime = collectorInterval
  }

  _construct (callback) {
    this.#start()
      .then(() => callback(null))
      .catch(callback)
  }

  _destroy (error, callback) {
    if (error) {
      this.emit('error', error)
    }

    this.#stop()
      .then(() => callback(error))
      .catch(callback)
  }

  _transform (data, encoding, callback) {
    this.#collector.push(data)
    callback()
  }

  _read (size) {
    this.#sendBufferedMessages()

    this.#allowPush = this.#messages.length === 0
  }

  _flush (callback) {
    this.#allowPush = false
    this.#collectorIntervalFunction()
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

  async #start () {
    this.#collector = []
    this.#collectorIntervalId = setInterval(
      this.#collectorIntervalFunction,
      this.#collectorIntervalTime
    )

    this.emit('collector:ready')
  }

  async #stop () {
    clearInterval(this.#collectorIntervalId)
    this.#collector = []
  }

  #collectorIntervalFunction = () => {
    if (this.#collector.length === 0) return

    const collector = this.#collector
    this.#collector = []

    collector.sort(BUFFER_COMPARE_SORT_FUNCTION) // it will also sort by date

    let meta = collector[0].subarray(0, ID_SIZE)
    let body = [collector[0].subarray(ID_SIZE)]

    if (collector.length > 1) {
      for (let i = 1; i < collector.length; ++i) {
        const buffer = collector[i]

        if (buffer.compare(meta, 0, ID_SIZE, 0, ID_SIZE) !== 0) {
          // if current id NOT equal to previous
          this.#addMessage([meta, body])

          meta = buffer.subarray(0, ID_SIZE)
          body = []
        }

        body.push(buffer.subarray(ID_SIZE))
      }
    }

    this.#addMessage([meta, body])
  }
}

export default UDPLoggerCollector
