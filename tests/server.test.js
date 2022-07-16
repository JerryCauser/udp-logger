import fs from 'node:fs'
import url from 'node:url'
import path from 'node:path'
import assert from 'node:assert'
import { tryCountErrorHook } from './_main.js'

/**
 *  Just test events `ready` and `close`
 */

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function serverTest (UDPLoggerServer) {
  const alias = '  server.js:'

  async function testBasic () {
    const caseAlias = `${alias} server basic tests ->`
    const filePath = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), `test-file-${Math.random()}.log`)
    const server = new UDPLoggerServer({
      filePath,
      port: 45003
    })

    let started = 0
    let closed = 0

    server.once('ready', () => ++started)
    server.once('close', () => ++closed)

    await Promise.race([
      delay(1000),
      server.start().then(() => server.stop())
    ])

    assert.strictEqual(
      started,
      1,
      `${caseAlias} server not started`
    )

    assert.strictEqual(
      closed,
      1,
      `${caseAlias} server not closed`
    )

    assert.ok(
      fs.existsSync(filePath),
      `${caseAlias} log file not exists`
    )

    fs.unlinkSync(filePath)

    console.log(`${caseAlias} passed`)
  }

  const errors = tryCountErrorHook()

  await errors.try(testBasic)

  if (errors.count === 0) {
    console.log('[server.js] All test for passed\n')
  } else {
    console.log(`[server.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default serverTest
