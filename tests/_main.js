import identifierTests from './identifier.test.js'
/**
 * sequence:
 *  [x] identifier
 *  [] defaults
 *  [] client
 *  [] socket
 *  [] writer
 *  [] server
 */

export default async function _main (type, {
  identifier
}) {
  console.log(`${type} Test Started`)
  let errorsCount = 0

  errorsCount += await identifierTests(identifier)

  if (errorsCount === 0) console.log('All tests passed')
}
