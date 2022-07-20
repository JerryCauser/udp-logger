import fs from 'node:fs'
import url from 'node:url'
import path from 'node:path'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { once } from 'node:events'
import { tryCountErrorHook, assertTry } from './_main.js'
import UDPLoggerWriter from '../src/writer.js'

/** here we need to create writer instance
 * [x] simple write test
 * [x] rename file and write something again.
 * [x]  old didn't changed
 * [x]  new one has only new info
 */

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * @param {string[]} paths
 * @returns {Promise<void>}
 */
async function unlinkAllWithEnsure (paths) {
  await Promise.allSettled(paths.map(path => fs.promises.unlink(path)))

  for (let i = 0; i < 20; ++i) {
    if (paths.some(path => fs.existsSync(path))) {
      await delay(10)
    } else {
      break
    }
  }
}

/**
 *
 * @param {UDPLoggerWriter} _
 * @param {string|undefined} encoding
 * @param {'buffer'|'string'} dataType
 * @returns {Promise<number>}
 */
async function writerTest (_, encoding = 'utf8', dataType = 'string') {
  const alias = `  writer.js:${encoding}:${dataType}: `

  const filePath = path.resolve(__dirname, 'test-file.log')
  const filePathRotated = filePath + '.old'

  await unlinkAllWithEnsure([filePath, filePathRotated])

  const readFileOptions = {}
  if (dataType !== 'buffer') {
    readFileOptions.encoding = encoding
  }

  async function testBasic () {
    const caseAlias = `${alias} basic tests ->`
    /**
     * @param {Buffer|string} data - should be buffer
     * @returns {string|Buffer}
     */
    const encodeData = (data) => {
      if (dataType === 'buffer') {
        if (Buffer.isBuffer(data)) return data

        return Buffer.from(data, 'base64')
      }

      if (dataType === 'string') {
        if (typeof data === 'string') return data

        return data.toString(encoding)
      }
    }

    /**
     * @param {string|Buffer} data - should be string
     * @returns {Buffer|string}
     */
    const decodeData = (data) => {
      if (typeof data === 'string') return data

      return data.toString('base64')
    }

    const write = data => {
      writer.write(encodeData(data))
    }

    const read = path => {
      return fs.readFileSync(path)
    }

    const writer = new UDPLoggerWriter({ filePath, encoding })

    const data = [
      crypto.randomBytes(128),
      crypto.randomBytes(128),
      crypto.randomBytes(128),
      crypto.randomBytes(128),
      crypto.randomBytes(128),
      crypto.randomBytes(128)
    ].map(n => encodeData(n))

    let started = 0
    let closed = 0
    const unexpectedErrors = []
    const results = { fails: [] }

    writer.on('error', err => {
      unexpectedErrors.push(err)
    })

    writer.once('ready', () => ++started)
    writer.once('close', () => ++closed)

    write(data[0])
    await delay(10)

    const dataAfterFirstWrite = read(filePath)

    assertTry(() => assert.deepStrictEqual(
      decodeData(dataAfterFirstWrite),
      decodeData(data[0]),
      `${caseAlias} data after FIRST writing isn't as expected`
    ), results)

    write(data[1])
    await delay(20)

    const dataAfterSecondWrite = read(filePath)
    const oneAndTwoData = data[0] + data[1]

    assertTry(() => assert.deepStrictEqual(
      decodeData(dataAfterSecondWrite),
      decodeData(oneAndTwoData),
      `${caseAlias} data after SECOND writing isn't as expected`
    ), results)

    // RENAMING

    fs.renameSync(filePath, filePathRotated)
    write(data[2]) // before reopen we still write to old file

    await once(writer, 'reopen')
    write(data[3])

    await delay(10)

    const dataAfterRotateOld = read(filePathRotated)
    const oneTwoThreeData = data[0] + data[1] + data[2]

    assertTry(() => assert.deepStrictEqual(
      decodeData(dataAfterRotateOld),
      decodeData(oneTwoThreeData),
      `${caseAlias} data in ROTATED file after THIRD writing isn't as expected`
    ), results)

    const dataAfterRotate = read(filePath)
    const fourData = data[3]

    assertTry(() => assert.deepStrictEqual(
      decodeData(dataAfterRotate),
      decodeData(fourData),
      `${caseAlias} data in NEW file after THIRD writing isn't as expected`
    ), results)

    // REMOVING

    fs.unlinkSync(filePath)

    await once(writer, 'reopen')
    write(data[4])

    await delay(10)

    const dataAfterRemove = read(filePath)
    const fiveSixData = data[4]

    assertTry(() => assert.deepStrictEqual(
      decodeData(dataAfterRemove),
      decodeData(fiveSixData),
      `${caseAlias} data after REMOVE file isn't as expected`
    ), results)

    // ENDING

    writer.end()
    await once(writer, 'close')
    await delay(5)

    assertTry(() => assert.strictEqual(
      started,
      1,
      `${caseAlias} writer not started`
    ), results)

    assertTry(() => assert.strictEqual(
      closed,
      1,
      `${caseAlias} writer not closed`
    ), results)

    if (unexpectedErrors.length > 0) {
      const error = new Error(`There are some unexpected errors. Number: ${unexpectedErrors}`)

      error.list = unexpectedErrors

      throw error
    }

    if (results.fails.length > 0) {
      const error = new Error(`${caseAlias} failed some tests: Number: ${results.fails.length}. Check ctx for description`)

      Object.assign(error, results)

      throw error
    } else {
      console.log(`${caseAlias} passed`)
    }
  }

  const errors = tryCountErrorHook()

  await errors.try(testBasic)

  await unlinkAllWithEnsure([filePath, filePathRotated])

  if (errors.count === 0) {
    console.log('[writer.js] All test for passed\n')
  } else {
    console.log(`[writer.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default writerTest
