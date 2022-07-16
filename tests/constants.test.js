import crypto from 'node:crypto'
import assert from 'node:assert'
import { tryCountErrorHook } from './_main.js'

/** [x] here we need to check if encryption and decryption works */

async function constantsTests ({
  DEFAULT_SERIALIZER,
  DEFAULT_DESERIALIZER,
  DEFAULT_DECRYPT_FUNCTION,
  DEFAULT_ENCRYPT_FUNCTION,
  DEFAULT_MESSAGE_FORMATTER
}) {
  const alias = '  constants.js:'

  function testSerializerAndDeserializer () {
    const caseAlias = `${alias} SERIALIZER and DESERIALIZER ->`
    const originData = {
      a: Date.now(),
      b: new Date(),
      c: new Map([['c', 2]]),
      d: new Set([1, 2, 'd']),
      e: new Error('e'),
      f: crypto.randomBytes(16)
    }
    const srlzdData = DEFAULT_SERIALIZER(originData)
    const desrlzdData = DEFAULT_DESERIALIZER(srlzdData)

    assert.ok(
      srlzdData instanceof Buffer,
      `${caseAlias} serialized data isn't Buffer type`
    )

    assert.deepStrictEqual(
      originData,
      desrlzdData,
      `${caseAlias} deserialized data isn't samelike as origin`
    )

    console.log(`${caseAlias} passed`)
  }

  function testEncAndDec () {
    const caseAlias = `${alias} ENCRYPT and DECRYPT ->`
    const originData = crypto.randomBytes(1024)
    const secret = crypto.randomBytes(32)
    const encData = DEFAULT_ENCRYPT_FUNCTION(originData, secret)
    const decData = DEFAULT_DECRYPT_FUNCTION(encData, secret)

    assert.ok(
      encData instanceof Buffer,
      `${caseAlias} encrypted Data data isn't Buffer type`
    )

    assert.deepStrictEqual(
      decData,
      originData,
      `${caseAlias} e decrypted data isn't same as origin`
    )

    console.log(`${caseAlias} passed`)
  }

  function testFormat () {
    const caseAlias = `${alias} FORMATTED ->`
    const date = new Date()
    const id = crypto.randomBytes(23).toString('hex')
    const payload = ['some string']
    const expected = `${date.toISOString()}|${id}|${payload}\n`

    const formatted = DEFAULT_MESSAGE_FORMATTER(payload, date, id)

    assert.strictEqual(
      formatted,
      expected,
      `${caseAlias} Formatted data isn't as expected`
    )

    console.log(`${caseAlias} passed`)
  }

  const errors = tryCountErrorHook()

  await errors.try(testSerializerAndDeserializer)
  await errors.try(testEncAndDec)
  await errors.try(testFormat)

  if (errors.count === 0) {
    console.log('[constants.js] All test for  passed\n')
  } else {
    console.log(`[constants.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default constantsTests
