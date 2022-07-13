import path from 'node:path'
import fs from 'node:fs'
import { Writable } from 'node:stream'

const EVENT_RENAME = 'rename'

/**
 * @typedef {object} UDPLoggerWriterOptions
 * @property {string} options.dirName
 * @property {string} options.fileName
 * @property {string} [options.encoding='utf8']
 * @property {string} [options.flags='a']
 *
 * @extends {WritableOptions}
 */

/**
 * @param {UDPLoggerWriterOptions} [options={}]
 * @constructor
 */
class UDPLoggerWriter extends Writable {
  #dirName
  #fileName
  #filePath
  #encoding

  #flags

  #fd
  #watcher

  constructor ({
    dirName,
    fileName,
    encoding = 'utf8',
    flags = 'a',
    ...options
  } = {}) {
    super({ ...options })

    this.#dirName = dirName
    this.#fileName = fileName
    this.#encoding = encoding
    this.#filePath = path.resolve(this.#dirName, this.#fileName)
    this.#flags = flags
  }

  _construct (callback) {
    this.#open()
      .then(() => {
        this.#watcher = fs.watch(this.#dirName, this.#watchRename)
        this.emit('ready')
        callback(null)
      })
      .catch(callback)
  }

  _destroy (error, callback) {
    if (error) {
      this.emit('error', error)
    }

    this.#watcher.close()

    this.#close()
      .then(() => callback(error))
      .catch(callback)
  }

  _write (chunk, encoding, callback) {
    if (typeof chunk === 'string') {
      fs.write(this.#fd, chunk, undefined, this.#encoding, callback)
    } else {
      fs.write(this.#fd, chunk, callback)
    }
  }

  _writev (chunks, callback) {
    if (typeof chunks[0].chunk === 'string') {
      let data = ''
      for (let i = 0; i < chunks.length; ++i) data += chunks[i].chunk

      fs.write(this.#fd, data, undefined, this.#encoding, callback)
    } else {
      const arr = []
      for (let i = 0; i < chunks.length; ++i) arr.push(chunks[i].chunk)
      fs.write(this.#fd, Buffer.concat(arr), callback)
    }
  }

  /**
   * @returns {Promise<null>}
   */
  async #open () {
    return await new Promise((resolve, reject) => {
      fs.open(this.#filePath, this.#flags, (err, fd) => {
        if (err) return reject(err)

        this.#fd = fd
        resolve(null)
      })
    })
  }

  /**
   * @returns {Promise<null>}
   */
  async #close () {
    return await new Promise((resolve, reject) => {
      fs.close(this.#fd, (err) => {
        if (err) return reject(err)

        resolve(null)
      })
    })
  }

  /**
   * @param {string} event
   * @param {string} fileName
   * @returns {Promise<void>}
   */
  #watchRename = async (event, fileName) => {
    if (event === EVENT_RENAME && fileName === this.#fileName) {
      if (!fs.existsSync(this.#filePath)) {
        this.cork()
        await this.#close()
        await this.#open()
        this.uncork()
      }
    }
  }
}

export default UDPLoggerWriter
