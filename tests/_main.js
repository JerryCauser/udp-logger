import identifierTests from './identifier.test.js'
import constantsTest from './constants.test.js'
/**
 * sequence:
 *  [x] identifier
 *  [x] defaults
 *  [] client
 *  [] socket
 *  [] writer
 *  [] server
 */

export default async function _main (type, {
  identifier,
  constants
}) {
  console.log(`${type} Tests Started`)
  let errorsCount = 0

  errorsCount += await identifierTests(identifier)
  errorsCount += await constantsTest(constants)

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
        await call()
      }
    } catch (e) {
      ++obj.count
      console.error(e.message)
    }
  }

  const obj = {
    count: 0,
    try: tryCountError
  }

  return obj
}
