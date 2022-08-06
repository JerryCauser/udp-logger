import fs from 'node:fs'
import url from 'node:url'
import path from 'node:path'
import assert from 'node:assert'
import { tryCountErrorHook } from './_main.js'

/**
 * [x] Just test events `ready` and `close`
 * [x] don't forget to remove created log file
 */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function serverTest (UdpLoggerServer) {
  const alias = '  server.js:'
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    `test-file-${Math.random()}.log`
  )

  async function testBasic () {
    const caseAlias = `${alias} server basic tests ->`
    const server = new UdpLoggerServer({
      filePath,
      port: 45003
    })

    let started = 0
    let closed = 0

    server.once('ready', () => ++started)
    server.once('close', () => ++closed)

    await Promise.race([delay(1000), server.start().then(() => server.stop())])

    assert.strictEqual(started, 1, `${caseAlias} server not started`)

    assert.strictEqual(closed, 1, `${caseAlias} server not closed`)

    assert.ok(fs.existsSync(filePath), `${caseAlias} log file not exists`)

    console.log(`${caseAlias} passed`)
  }

  const errors = tryCountErrorHook()

  await errors.try(testBasic)

  fs.promises.unlink(filePath).catch(() => {})

  if (errors.count === 0) {
    console.log('[server.js] All test for passed\n')
  } else {
    console.log(`[server.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default serverTest
