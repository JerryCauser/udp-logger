import dgram from 'node:dgram'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { once } from 'node:events'
import { tryCountErrorHook, assertTry, checkResults } from './_main.js'
import UDPLoggerClient from '../src/client.js'
import UDPLoggerSocket from '../src/socket.js'
import {
  generateId,
  ID_SIZE,
  parseId,
  setChunkMetaInfo,
  SEED_SIZE,
  SEED_N_TOTAL_OFFSET,
  DATE_SIZE
} from '../src/identifier.js'

/** TODO we've tested already identifier
 * create client
 * create socket and pass simple serializer and formatter
 * [x] send message and receive it correctly
 * [x] send big message and receive it correctly
 *
 * [] send incorrect message. handle warning "compile"
 * [] send not all chunks. handle warning "missing"
 * [] after all send one more message and everything is working

 * [] test with encryption 'string'
 * [] test with encryption 'function'
 */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * @returns {Promise<Socket & {stop: (() => Promise<void>)}>}
 */
const createUDPClient = async () => {
  const socket = Object.create(
    dgram.createSocket({ type: 'udp4', reuseAddr: true })
  )

  socket.stop = async () => {
    socket.removeAllListeners()
    socket.close()
    await once(socket, 'close')
  }

  return socket
}

/**
 *
 * @param {UDPLoggerWriter} _
 * @param {string|undefined|null} encoding
 * @param {'buffer'|'string'} dataType
 * @returns {Promise<number>}
 */
async function socketTest (_) {
  const alias = '  socket.js: '

  const port = 45003
  const defaultSerializer = (buf) => buf
  const defaultDeserializer = (buf) => buf
  const defaultFormatMessage = (buf) => buf

  const SMALL_PACKET_SIZE = 300
  const BIG_PACKET_SIZE = 300

  /**
   * @param {object} options
   * @param {number} options.port
   * @param {string|function?} options.decryption
   * @param {function?} options.deserializer
   * @param {function?} options.formatMessage
   * @returns {Promise<UDPLoggerSocket & {messages:Buffer[], stop: Function<Promise<void>>}>}
   */
  const createUDPSocket = async ({
    port,
    packetSize,
    type = 'udp4',
    decryption,
    deserializer = defaultDeserializer,
    formatMessage = defaultFormatMessage
  } = {}) => {
    const socket = new UDPLoggerSocket({
      port,
      type,
      packetSize,
      deserializer,
      formatMessage,
      decryption
    })

    const error = await Promise.race([
      once(socket, 'ready'),
      once(socket, 'error')
    ])

    /** @type {Buffer[]} */
    socket.messages = []

    socket.on('data', (buffer) => socket.messages.push(buffer))

    if (error instanceof Error) throw Error

    /** @type {Function<Promise<void>>} */
    socket.stop = async () => {
      socket.removeAllListeners()
      socket.close()
      await once(socket, 'close')
    }

    return socket
  }

  async function testSocketSmall () {
    const caseAlias = `${alias} sending small message ->`
    const results = { fails: [] }

    const client = await createUDPClient()
    const socket = createUDPSocket({ port, packetSize: SMALL_PACKET_SIZE })
    const payload = crypto.randomBytes(SMALL_PACKET_SIZE)

    const dateNow = Date.now()
    const payloadId = generateId()
    payload.set(payloadId, 0)
    payload.writeUintBE(dateNow, 0, DATE_SIZE)
    setChunkMetaInfo(payload, 0, 0)

    client.send(payload, port)

    await delay(5)

    assertTry(
      () =>
        assert.strictEqual(
          socket.messages.length,
          1,
          `${caseAlias} 1 message should be received by socket`
        ),
      results
    )

    // eslint-disable-next-line no-unused-vars
    const [messageDate, __id, total, index] = parseId(
      socket.messages[0].subarray(0, ID_SIZE)
    )

    assertTry(
      () =>
        assert.strictEqual(
          messageDate.getTime(),
          dateNow,
          `${caseAlias} Message date invalid`
        ),
      results
    )

    assertTry(
      () =>
        assert.deepStrictEqual(
          __id,
          payloadId,
          `${caseAlias} Message ID invalid`
        ),
      results
    )

    assertTry(
      () =>
        assert.strictEqual(
          total,
          0,
          `${caseAlias} Message total isn't same as expected`
        ),
      results
    )
    assertTry(
      () =>
        assert.strictEqual(
          index,
          0,
          `${caseAlias} Message index isn't same as expected`
        ),
      results
    )

    assertTry(
      () =>
        assert.deepStrictEqual(
          socket.messages[0].subarray(ID_SIZE),
          payload,
          `${caseAlias} received message should be the same as sent one`
        ),
      results
    )

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
    console.log(`${caseAlias} passed`)
  }

  async function testSocketLarge () {
    const caseAlias = `${alias} sending large message ->`
    const results = { fails: [] }

    const client = await createUDPClient()
    const socket = createUDPSocket({ port, packetSize: BIG_PACKET_SIZE })
    const payload1 = crypto.randomBytes(BIG_PACKET_SIZE)
    const payload2 = crypto.randomBytes(BIG_PACKET_SIZE)

    const dateNow = Date.now()
    const payloadId = generateId()

    payload1.set(payloadId, 0)
    payload1.writeUintBE(dateNow, 0, DATE_SIZE)
    setChunkMetaInfo(payload1, 1, 0)

    payload2.set(payloadId, 0)
    payload2.writeUintBE(dateNow, 0, DATE_SIZE)
    setChunkMetaInfo(payload2, 1, 1)

    client.send(payload1, port)
    await delay(0)
    client.send(payload2, port)

    await delay(5)

    assertTry(
      () =>
        assert.strictEqual(
          socket.messages.length,
          2,
          `${caseAlias} 2 messages should be received by socket`
        ),
      results
    )

    // eslint-disable-next-line no-unused-vars
    const [messageDate1, id1, total1, index1] = parseId(
      socket.messages[0].subarray(0, ID_SIZE)
    )

    assertTry(
      () =>
        assert.strictEqual(
          total1,
          1,
          `${caseAlias} Message One total isn't as expected`
        ),
      results
    )
    assertTry(
      () =>
        assert.strictEqual(
          index1,
          0,
          `${caseAlias} Message One index isn't as expected`
        ),
      results
    )

    const [messageDate2, id2, total2, index2] = parseId(
      socket.messages[1].subarray(0, ID_SIZE)
    )

    assertTry(
      () =>
        assert.strictEqual(
          total2,
          1,
          `${caseAlias} Message Two total isn't as expected`
        ),
      results
    )
    assertTry(
      () =>
        assert.strictEqual(
          index2,
          1,
          `${caseAlias} Message Two index isn't as expected`
        ),
      results
    )

    assertTry(
      () =>
        assert.strictEqual(
          messageDate1.getTime(),
          dateNow,
          `${caseAlias} Message date invalid`
        ),
      results
    )

    assertTry(
      () =>
        assert.strictEqual(
          messageDate2.getTime(),
          messageDate1.getTime(),
          `${caseAlias} Message dates for all chunks should be the same`
        ),
      results
    )

    assertTry(
      () =>
        assert.strictEqual(
          id1,
          id2,
          `${caseAlias} Message IDs for all chunks should be the same`
        ),
      results
    )

    assertTry(
      () =>
        assert.deepStrictEqual(
          socket.messages[0].subarray(ID_SIZE),
          payload1,
          `${caseAlias} received Message One should be the same as sent one`
        ),
      results
    )

    assertTry(
      () =>
        assert.deepStrictEqual(
          socket.messages[1].subarray(ID_SIZE),
          payload2,
          `${caseAlias} received Message One should be the same as sent one`
        ),
      results
    )

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
  }

  const errors = tryCountErrorHook()

  await errors.try(testSocketSmall)
  await errors.try(testSocketLarge)

  if (errors.count === 0) {
    console.log('[socket.js] All test for passed\n')
  } else {
    console.log(`[socket.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default socketTest
