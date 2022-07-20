import identifierTests from './identifier.test.js'
import constantsTest from './constants.test.js'
import clientTest from './client.test.js'
import serverTest from './server.test.js'
import writerTest from './writer.test.js'

/**
 * sequence:
 *  [x] identifier
 *  [x] defaults
 *  [x] client
 *  [] socket
 *  [] writer
 *  [x] server
 */

export default async function _main (type, {
  identifier,
  constants,
  UDPLoggerClient,
  UDPLoggerSocket,
  UDPLoggerWriter,
  UDPLoggerServer
}) {
  console.log(`${type} Tests Started\n`)
  let errorsCount = 0

  errorsCount += await identifierTests(identifier)
  errorsCount += await constantsTest(constants)
  errorsCount += await clientTest(UDPLoggerClient, identifier)
  // errorsCount += await writerTest(UDPLoggerWriter, 'utf8', 'string')
  // errorsCount += await writerTest(UDPLoggerWriter, 'utf8', 'buffer')
  // errorsCount += await writerTest(UDPLoggerWriter, 'buffer', 'string')
  // errorsCount += await writerTest(UDPLoggerWriter, 'buffer', 'buffer')
  errorsCount += await writerTest(UDPLoggerWriter)
  errorsCount += await serverTest(UDPLoggerServer)

  if (errorsCount === 0) console.log('All tests passed')
  else throw new Error(`Not all tests are passed. FAILED tests: ${errorsCount}`)
}

/**
 * @returns {{count: number, try: (((fn: function) => Promise<void>))}}
 */
export const tryCountErrorHook = () => {
  const tryCountError = async (fn) => {
    try {
      const call = fn()

      if (call?.then) {
        await call
      }
    } catch (e) {
      ++obj.count
      console.error(e)
    }
  }

  const obj = {
    count: 0,
    try: tryCountError
  }

  return obj
}

/**
 * @param {function} fn
 * @param {object} obj
 */
export const assertTry = (fn, obj) => {
  try {
    fn()
  } catch (e) {
    obj.fails.push(e)
  }
}
