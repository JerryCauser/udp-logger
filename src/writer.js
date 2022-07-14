import fs from 'node:fs'
import path from 'node:path'
import { Writable } from 'node:stream'

const EVENT_RENAME = 'rename'

/**
 * @typedef {object} UDPLoggerWriterOptions
 * @property {string} filePath supports absolute and relative paths.
 *            If passed relative path then will use process.cwd() as a base path
 * @property {string} [encoding='utf8']
 * @property {string} [flags='a']
 *
 * @extends {WritableOptions}
 */

/**
 * @param {UDPLoggerWriterOptions} [options={}]
 * @constructor
 */
class UDPLoggerWriter extends Writable {
  #filePath
  #fileName
  #dir
  #encoding

  #flags

  #fd
  #watcher

  /**
   * @param {UDPLoggerWriterOptions} options
   */
  constructor ({
    filePath,
    encoding = 'utf8',
    flags = 'a',
    ...writableOptions
  } = {}) {
    super({ ...writableOptions })

    this.#filePath = path.resolve(process.cwd(), filePath)
    console.log(path.parse(this.#filePath))
    this.#fileName = path.parse(this.#filePath).base
    this.#dir = path.parse(this.#filePath).dir
    this.#encoding = encoding
    this.#flags = flags

    console.log({
      filePath: this.#filePath,
      fileName: this.#fileName,
      dir: this.#dir
    })
  }

  _construct (callback) {
    this.#open()
      .then(() => {
        this.#watcher = fs.watch(this.#dir, this.#watchRename)
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
   * @returns {string}
   */
  get filePath () {
    return this.#filePath
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
      if (!fs.existsSync(this.#fileName)) {
        this.cork()
        await this.#close()
        await this.#open()
        this.uncork()
      }
    }
  }
}

export default UDPLoggerWriter
