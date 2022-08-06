import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { once } from 'node:events'
import { tryCountErrorHook, assertTry, checkResults } from './_main.js'

/** here we need to create writer instance
 * [x] simple write test
 * [x] rename file and write something again.
 * [x]  old didn't changed
 * [x]  new one has only new info
 */

const __dirname = os.tmpdir()
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * @param {string[]} paths
 * @returns {Promise<void>}
 */
async function unlinkAllWithEnsure (paths) {
  await Promise.allSettled(paths.map((path) => fs.promises.unlink(path)))

  for (let i = 0; i < 20; ++i) {
    if (paths.some((path) => fs.existsSync(path))) {
      await delay(10)
    } else {
      break
    }
  }
}

/**
 *
 * @param {UdpLoggerWriter} UdpLoggerWriter
 * @param {'ESM'|'CJS'} type
 * @param {string|undefined|null} encoding
 * @param {'buffer'|'string'} dataType
 * @returns {Promise<number>}
 */
async function writerTest (
  UdpLoggerWriter,
  type,
  encoding = 'utf8',
  dataType = 'string'
) {
  const alias = `  writer.js:${encoding || 'null'}:${dataType}: `

  const filePath = path.resolve(
    __dirname,
    `test-file-${crypto.randomBytes(6).toString('hex')}-${type}.log`
  )
  const filePathRotated = filePath + '.old'

  await unlinkAllWithEnsure([filePath, filePathRotated])

  const readFileOptions = {}
  if (dataType !== 'buffer') {
    readFileOptions.encoding = encoding
  }

  async function testBasic () {
    const caseAlias = `${alias} basic tests ->`
    const binData = [
      crypto.randomBytes(128),
      crypto.randomBytes(128),
      crypto.randomBytes(128),
      crypto.randomBytes(128),
      crypto.randomBytes(128),
      crypto.randomBytes(128)
    ]
    const data = binData.map((n) => {
      if (dataType === 'string') return n.toString('base64')

      return n
    })

    /**
     * @param {string[]|Buffer[]} items
     * @returns {string|Buffer}
     */
    const concatData = (items) => {
      if (Buffer.isBuffer(items[0])) return Buffer.concat(items)

      return items.reduce((acc, el) => {
        acc += el

        return acc
      }, '')
    }

    const write = (data) => {
      writer.write(data)
    }

    const read = (path) => {
      const fileData = fs.readFileSync(path, readFileOptions)

      if (dataType === 'string' && Buffer.isBuffer(fileData)) {
        return fileData.toString(encoding || 'utf8')
      }

      if (dataType === 'buffer' && !Buffer.isBuffer(fileData)) {
        return Buffer.from(fileData, encoding)
      }

      return fileData
    }

    const writer = new UdpLoggerWriter({ filePath, encoding })

    let started = 0
    let closed = 0
    const unexpectedErrors = []
    const results = { fails: [] }

    writer.on('error', (err) => {
      unexpectedErrors.push(err)
    })

    writer.once('ready', () => ++started)
    writer.once('close', () => ++closed)

    write(data[0])
    await delay(10)

    const dataAfterFirstWrite = read(filePath)

    assertTry(
      () =>
        assert.deepStrictEqual(
          dataAfterFirstWrite,
          data[0],
          `${caseAlias} data after FIRST writing isn't as expected`
        ),
      results
    )

    write(data[1])
    await delay(20)

    const dataAfterSecondWrite = read(filePath)
    const oneAndTwoData = concatData([data[0], data[1]])

    assertTry(
      () =>
        assert.deepStrictEqual(
          dataAfterSecondWrite,
          oneAndTwoData,
          `${caseAlias} data after SECOND writing isn't as expected`
        ),
      results
    )

    // RENAMING

    fs.renameSync(filePath, filePathRotated)
    write(data[2]) // before reopen we still write to old file

    await once(writer, 'reopen')
    write(data[3])

    await delay(10)

    const dataAfterRotateOld = read(filePathRotated)
    const oneTwoThreeData = concatData([data[0], data[1], data[2]])

    assertTry(
      () =>
        assert.deepStrictEqual(
          dataAfterRotateOld,
          oneTwoThreeData,
          `${caseAlias} data in ROTATED file after THIRD writing isn't as expected`
        ),
      results
    )

    const dataAfterRotate = read(filePath)
    const fourData = data[3]

    assertTry(
      () =>
        assert.deepStrictEqual(
          dataAfterRotate,
          fourData,
          `${caseAlias} data in NEW file after THIRD writing isn't as expected`
        ),
      results
    )

    // REMOVING

    fs.unlinkSync(filePath)

    await once(writer, 'reopen')
    write(data[4])

    await delay(10)

    const dataAfterRemove = read(filePath)
    const fiveSixData = data[4]

    assertTry(
      () =>
        assert.deepStrictEqual(
          dataAfterRemove,
          fiveSixData,
          `${caseAlias} data after REMOVE file isn't as expected`
        ),
      results
    )

    // ENDING

    writer.end()
    await once(writer, 'close')
    await delay(5)

    assertTry(
      () => assert.strictEqual(started, 1, `${caseAlias} writer not started`),
      results
    )

    assertTry(
      () => assert.strictEqual(closed, 1, `${caseAlias} writer not closed`),
      results
    )

    if (unexpectedErrors.length > 0) {
      const error = new Error(
        `There are some unexpected errors. Number: ${unexpectedErrors}`
      )

      error.list = unexpectedErrors

      throw error
    }

    checkResults(results, caseAlias, { data })
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
