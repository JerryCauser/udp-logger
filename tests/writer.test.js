import fs from 'node:fs'
import url from 'node:url'
import path from 'node:path'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { once } from 'node:events'
import { tryCountErrorHook } from './_main.js'
import UDPLoggerWriter from '../src/writer.js'

/** here we need to create writer instance
 * [x] simple write test
 * [x] rename file and write something again.
 * [x]  old didn't changed
 * [x]  new one has only new info
 */

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function writerTest (_, encoding = 'utf8', dataType = 'hex') {
  const alias = `  writer.js:${encoding}:${dataType}: `

  const filePath = path.resolve(__dirname, 'test-file.log')
  const filePathRotated = filePath + '.old'

  await fs.promises.unlink(filePath).catch(() => {})
  await fs.promises.unlink(filePathRotated).catch(() => {})

  async function testBasic () {
    const caseAlias = `${alias} basic tests ->`
    /**
     * @param {Buffer|string} data - should be buffer
     * @returns {string|Buffer}
     */
    const encodeData = (data) => {
      if (!Buffer.isBuffer(data)) data = decodeData(data)

      if (dataType === 'buffer') return data

      return data.toString(dataType)
    }

    /**
     * @param {string|Buffer} data - should be string
     * @returns {Buffer|string}
     */
    const decodeData = (data) => {
      if (Buffer.isBuffer(data)) data = encodeData(data)

      if (dataType === 'buffer') return data

      return Buffer.from(data, dataType)
    }

    const write = data => {
      writer.write(encodeData(data))
    }

    const writer = new UDPLoggerWriter({ filePath, encoding })

    const data = [
      crypto.randomBytes(128),
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

    writer.on('error', err => {
      unexpectedErrors.push(err)
    })

    writer.once('ready', () => ++started)
    writer.once('close', () => ++closed)

    write(data[0])
    await delay(10)

    const dataAfterFirstWrite = fs.readFileSync(filePath, { encoding })

    assert.deepStrictEqual(
      decodeData(dataAfterFirstWrite),
      decodeData(data[0]),
      `${caseAlias} data after FIRST writing isn't as expected`
    )

    write(data[1])
    await delay(20)

    const dataAfterSecondWrite = fs.readFileSync(filePath, { encoding })
    const oneAndTwoData = data[0] + data[1]

    assert.deepStrictEqual(
      decodeData(dataAfterSecondWrite),
      decodeData(oneAndTwoData),
      `${caseAlias} data after SECOND writing isn't as expected`
    )

    // RENAMING

    fs.renameSync(filePath, filePathRotated)
    write(data[2]) // before reopen we still write to old file

    await once(writer, 'reopen')
    write(data[3])

    await delay(10)

    const dataAfterRotateOld = fs.readFileSync(filePathRotated, { encoding })
    const oneTwoThreeData = data[0] + data[1] + data[2]

    assert.deepStrictEqual(
      decodeData(dataAfterRotateOld),
      decodeData(oneTwoThreeData),
      `${caseAlias} data in ROTATED file after THIRD writing isn't as expected`
    )

    const dataAfterRotate = fs.readFileSync(filePath, { encoding })
    const fourData = data[3]

    assert.deepStrictEqual(
      decodeData(dataAfterRotate),
      decodeData(fourData),
      `${caseAlias} data in NEW file after THIRD writing isn't as expected`
    )

    // REMOVING

    fs.unlinkSync(filePath)
    write(data[4]) // it should cork file or something. but right now it should raise error

    await once(writer, 'reopen')
    write(data[5])

    await delay(10)

    const dataAfterRemove = fs.readFileSync(filePath, { encoding })
    const fiveSixData = data[4] + data[5]

    assert.deepStrictEqual(
      decodeData(dataAfterRemove),
      decodeData(fiveSixData),
      `${caseAlias} data after REMOVE file isn't as expected`
    )

    // ENDING

    writer.end()
    await delay(10)

    assert.strictEqual(
      started,
      1,
      `${caseAlias} writer not started`
    )

    assert.strictEqual(
      closed,
      1,
      `${caseAlias} writer not closed`
    )

    if (unexpectedErrors.length > 0) {
      const error = new Error(`There are some unexpected errors. Number: ${unexpectedErrors}`)

      error.list = unexpectedErrors

      throw error
    }

    console.log(`${caseAlias} passed`)
  }

  const errors = tryCountErrorHook()

  await errors.try(testBasic)

  await fs.promises.unlink(filePath).catch(() => {})
  await fs.promises.unlink(filePathRotated).catch(() => {})

  if (errors.count === 0) {
    console.log('[writer.js] All test for passed\n')
  } else {
    console.log(`[writer.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default writerTest
