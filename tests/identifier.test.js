import crypto from 'node:crypto'
import assert from 'node:assert'
import { tryCountErrorHook } from './_main.js'

/** here we need just to check functions
 * [x] generateId() return correct size
 * [x]   we can parse correct date
 * [x]   random data not same all time
 * [x]   increment works as we think
 * [x] setChunkMetaInfo() writes data at correct position and that data is correct
 * [x] parseId() throws error for non correct id size
 * [x]   date is correct
 * [x]   id size correct
 * [x]   total expected
 * [x]   index expected
 * [x] id generated by generateId and setChunkMetaInfo correctly parsed by parseId
*/

async function identifierTests ({
  generateId,
  setChunkMetaInfo,
  parseId,
  ID_SIZE,
  DATE_SIZE,
  RANDOM_SIZE,
  INCREMENTAL_SIZE,
  TIME_META_SIZE,
  SEED_SIZE,
  COUNTER_TOTAL_SIZE,
  SEED_N_TOTAL_OFFSET,
  COUNTER_INDEX_SIZE
}) {
  const alias = '  identifier.js:'

  function testGenerateId () {
    const caseAlias = `${alias} generateId() ->`
    const dateBefore = Date.now()
    const firstId = generateId()
    const dateAfter = Date.now()

    assert.strictEqual(
      firstId.byteLength,
      ID_SIZE,
      `${alias} generateId() -> id should be of size ${ID_SIZE}`
    )

    const dateId = firstId.readUintBE(0, DATE_SIZE)

    assert.ok(
      dateBefore <= dateId && dateAfter >= dateId,
      `${caseAlias} id date isn't correct`
    )

    const secondId = generateId()

    const firstRandom = firstId.subarray(TIME_META_SIZE, TIME_META_SIZE + RANDOM_SIZE).toString('hex')
    const secondRandom = secondId.subarray(TIME_META_SIZE, TIME_META_SIZE + RANDOM_SIZE).toString('hex')

    assert.notStrictEqual(
      firstRandom,
      secondRandom,
      `${caseAlias} id random same for 2 ids`
    )

    const firstInc = firstId.readUintBE(DATE_SIZE, INCREMENTAL_SIZE)
    const secondInc = secondId.readUintBE(DATE_SIZE, INCREMENTAL_SIZE)

    assert.notStrictEqual(
      firstInc,
      secondInc,
      `${caseAlias} id inc same for 2 ids`
    )
    assert.strictEqual(
      firstInc + 1,
      secondInc,
      `${caseAlias} id inc diff more than 1`
    )

    console.log(`${caseAlias} passed`)
  }

  function testSetChunkMetaInfo () {
    const caseAlias = `${alias} setChunkMetaInfo() ->`
    const id = generateId()
    const expTotal = 300
    const expIndex = 290

    setChunkMetaInfo(id, expTotal, expIndex)

    const total = id.readUintBE(SEED_SIZE, COUNTER_TOTAL_SIZE)
    const index = id.readUintBE(SEED_N_TOTAL_OFFSET, COUNTER_INDEX_SIZE)

    assert.strictEqual(
      total,
      expTotal,
      `${caseAlias} total info isn't as expected`
    )

    assert.strictEqual(
      index,
      expIndex,
      `${caseAlias} index info isn't as expected`
    )

    console.log(`${caseAlias} passed`)
  }

  function testParseId () {
    const caseAlias = `${alias} parseId() ->`

    const incorrectSizeFn = () => parseId(Buffer.alloc(ID_SIZE + 1))
    assert.throws(incorrectSizeFn, `${caseAlias} not throws error on incorrect ID size`)

    const testId = Buffer.alloc(ID_SIZE)

    const expId = crypto.randomBytes(SEED_SIZE)
    const expDate = expId.readUintBE(0, DATE_SIZE)
    const expTotal = 4
    const expIndex = 2

    testId.set(expId, 0)
    testId.writeUintBE(expTotal, SEED_SIZE, COUNTER_TOTAL_SIZE)
    testId.writeUintBE(expIndex, SEED_N_TOTAL_OFFSET, COUNTER_INDEX_SIZE)

    const [date, id, total, index] = parseId(testId)

    assert.strictEqual(
      id,
      expId.toString('hex'),
      `${caseAlias} id isn't as expected`
    )

    assert.strictEqual(
      expDate,
      date.getTime(),
      `${caseAlias} parsed id date isn't as expected`
    )

    assert.strictEqual(
      expTotal,
      total,
      `${caseAlias} parsed total isn't as expected `
    )

    assert.strictEqual(
      expIndex,
      index,
      `${caseAlias} parsed index isn't as expected `
    )

    console.log(`${caseAlias} passed`)
  }

  function testSynergy () {
    const caseAlias = `${alias} synergy ->`

    const processId = generateId()

    const correctParse = () => parseId(processId)
    assert.doesNotThrow(correctParse, `${caseAlias} throws error on correct ID generated by prev methods`)

    console.log(`${caseAlias} passed`)
  }

  const errors = tryCountErrorHook()

  await errors.try(testGenerateId)
  await errors.try(testSetChunkMetaInfo)
  await errors.try(testParseId)
  await errors.try(testSynergy)

  if (errors.count === 0) {
    console.log('All test for identifier.js passed')
  } else {
    console.log(`identifier.js has ${errors.count} errors`)
  }

  return errors.count
}

export default identifierTests