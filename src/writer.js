/** Rewritten https://github.com/nodejs/node/blob/73ba8830d59015e8554903301245ee32c31baa9f/lib/internal/fs/streams.js#L307
 * But I've added here logic to recreate file on rename/remove and keep writing
 * */
import fs from 'node:fs'
import path from 'node:path'
import { Writable } from 'node:stream'

const IO_DONE = Symbol('IO_DONE')

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

  #fd = null
  #watcher

  #isPerforming = false

  #bytesWritten = 0

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
    this.#fileName = path.parse(this.#filePath).base
    this.#dir = path.parse(this.#filePath).dir

    this.#encoding = encoding
    this.#flags = flags
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
    this.#watcher.close()

    if (this.#isPerforming) {
      this.once(IO_DONE, (err) =>
        this.#close(err)
          .then(() => callback(error))
          .catch(callback)
      )
    } else {
      this.#close(error)
        .then(() => callback(error))
        .catch(callback)
    }
  }

  _write (chunk, encoding, callback) {
    this.#isPerforming = true

    const fn = (error, bytesWritten) => {
      this.#bytesWritten += bytesWritten
      this.#isPerforming = false

      if (this.destroyed) {
        callback(error)
        return this.emit(IO_DONE, error)
      }

      if (error) return callback(error)

      callback()
    }

    if (typeof chunk === 'string') {
      fs.write(this.#fd, chunk, undefined, this.#encoding, fn)
    } else {
      fs.write(this.#fd, chunk, fn)
    }
  }

  _writev (data, callback) {
    const length = data.length
    const chunks = new Array(length)

    if (typeof data[0].chunk === 'string') {
      for (let i = 0; i < length; ++i) {
        chunks[i] = Buffer.from(data[i].chunk, this.#encoding)
      }
    } else {
      for (let i = 0; i < length; ++i) {
        chunks[i] = data[i].chunk
      }
    }

    this.#isPerforming = true

    const fn = (error, bytesWritten) => {
      this.#bytesWritten += bytesWritten
      this.#isPerforming = false

      if (this.destroyed) {
        callback(error)
        return this.emit(IO_DONE, error)
      }

      if (error) return callback(error)

      callback()
    }

    fs.writev(this.#fd, chunks, fn)
  }

  /**
   * @returns {string}
   */
  get path () {
    return this.#filePath
  }

  /**
   * @returns {null|number}
   */
  get fd () {
    return this.#fd
  }

  /**
   * @returns {number}
   */
  get bytesWritten () {
    return this.#bytesWritten
  }

  /**
   * @returns {boolean}
   */
  get pending () {
    return this.#fd === null
  }

  /**
   * @returns {Promise<null>}
   */
  async #open () {
    return await new Promise((resolve, reject) => {
      if (typeof this.#fd === 'number') {
        return resolve(null)
      }

      fs.open(this.#filePath, this.#flags, (err, fd) => {
        if (err) return reject(err)

        this.#fd = fd
        resolve(null)
        this.emit('reopen')
      })
    })
  }

  /**
   * @returns {Promise<null>}
   */
  async #close (error) {
    return await new Promise((resolve, reject) => {
      if (this.#fd === null) return reject(error)

      fs.close(this.#fd, (err) => {
        this.#fd = null

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
    if (event === 'rename' && fileName === this.#fileName) {
      if (!fs.existsSync(this.#filePath)) {
        this.cork()
        await this.#close(null)
        await this.#open()
        process.nextTick(() => this.uncork())
      }
    }
  }
}

export default UDPLoggerWriter
