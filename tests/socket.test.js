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

  const defaultPort = 45003
  const defaultSerializer = (buf) => buf
  const defaultDeserializer = (buf) => buf
  const defaultFormatMessage = (buf) => buf

  const SMALL_PACKET_SIZE = 300
  const BIG_PACKET_SIZE = 300

  /**
   * @param {UDPLoggerSocketOptions} options
   * @param {function?} options.deserializer
   * @param {function?} options.formatMessage
   * @returns {Promise<UDPLoggerSocket & {messages:Buffer[], stop: (() => Promise<void>)}>}
   */
  const createUDPSocket = async ({
    port = defaultPort,
    deserializer = defaultDeserializer,
    formatMessage = defaultFormatMessage,
    ...opts
  } = {}) => {
    const socket = new UDPLoggerSocket({
      ...opts,
      deserializer,
      formatMessage
    })

    const error = await Promise.race([
      once(socket, 'ready'),
      once(socket, 'error')
    ])

    /** @type {Buffer[]} */
    socket.messages = []

    socket.on('data', (buffer) => socket.messages.push(buffer))

    if (error instanceof Error) throw Error

    /** @type {(() => Promise<void>)} */
    socket.stop = async () => {
      socket.removeAllListeners()
      socket.close()
      await once(socket, 'close')
    }

    return socket
  }

  function checkMessage (caseAlias, message, results, {
    id,
    date,
    total,
    index,
    payload
  }) {
    // eslint-disable-next-line no-unused-vars
    const [messageDate, messageId, messageTotal, messageIndex] = parseId(message.subarray(0, ID_SIZE))

    assertTry(
      () =>
        assert.strictEqual(
          messageDate.getTime(),
          date,
          `${caseAlias} Message date invalid`
        ),
      results
    )

    assertTry(
      () =>
        assert.deepStrictEqual(
          messageId,
          id,
          `${caseAlias} Message ID invalid`
        ),
      results
    )

    assertTry(
      () =>
        assert.strictEqual(
          messageTotal,
          total,
          `${caseAlias} Message total isn't same as expected`
        ),
      results
    )
    assertTry(
      () =>
        assert.strictEqual(
          messageIndex,
          index,
          `${caseAlias} Message index isn't same as expected`
        ),
      results
    )

    assertTry(
      () =>
        assert.deepStrictEqual(
          message.subarray(ID_SIZE),
          payload,
          `${caseAlias} received message should be the same as sent one`
        ),
      results
    )
  }

  async function testSocketSmall () {
    const caseAlias = `${alias} sending small message ->`
    const results = { fails: [] }

    const client = await createUDPClient()
    const socket = await createUDPSocket({
      port: defaultPort,
      packetSize: SMALL_PACKET_SIZE
    })
    const chunk = crypto.randomBytes(SMALL_PACKET_SIZE)

    const dateNow = Date.now()
    const payloadId = generateId()
    payloadId.writeUintBE(dateNow, 0, DATE_SIZE)
    chunk.set(payloadId, 0)
    setChunkMetaInfo(chunk, 0, 0)

    client.send(chunk, defaultPort)

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

    checkMessage(caseAlias, socket.messages[0], results, {
      id: payloadId,
      date: dateNow,
      total: 0,
      index: 0,
      payload: chunk.subarray(ID_SIZE)
    })

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
    console.log(`${caseAlias} passed`)
  }

  async function testSocketLarge () {
    const caseAlias = `${alias} sending large message ->`
    const results = { fails: [] }

    const client = await createUDPClient()
    const socket = await createUDPSocket({
      port: defaultPort,
      packetSize: BIG_PACKET_SIZE
    })
    const chunk1 = crypto.randomBytes(BIG_PACKET_SIZE)
    const chunk2 = crypto.randomBytes(BIG_PACKET_SIZE)

    const dateNow = Date.now()
    const payloadId = generateId()
    payloadId.writeUintBE(dateNow, 0, DATE_SIZE)

    chunk1.set(payloadId, 0)
    setChunkMetaInfo(chunk1, 1, 0)

    chunk2.set(payloadId, 0)
    setChunkMetaInfo(chunk2, 1, 1)

    client.send(chunk1, defaultPort)
    await delay(0)
    client.send(chunk2, defaultPort)

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

    checkMessage(caseAlias, socket.messages[0], results, {
      id: payloadId,
      date: dateNow,
      total: 1,
      index: 0,
      payload: chunk1.subarray(ID_SIZE)
    })

    checkMessage(caseAlias, socket.messages[1], results, {
      id: payloadId,
      date: dateNow,
      total: 1,
      index: 1,
      payload: chunk2.subarray(ID_SIZE)
    })

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
  }

  async function testSocketWarning () {
    const caseAlias = `${alias} handling compile warning ->`
    const results = { fails: [] }

    const jsonData = { a: '1234567890', b: 1, c: true, d: { a: -1 }, e: [0, 'b'], f: null }

    /**
     * @param {any} obj
     * @returns {Buffer}
     */
    const serializer = (obj) => {
      return Buffer.from(JSON.stringify(jsonData), 'utf8')
    }

    /**
     * @param {Buffer} buf
     * @returns {any}
     */
    const deserializer = (buf) => {
      return JSON.parse(buf.toString('utf8'))
    }

    const client = await createUDPClient()
    const socket = await createUDPSocket({
      gcExpirationTime: 10,
      gcIntervalTime: 5,
      deserializer,
      port: defaultPort,
      packetSize: SMALL_PACKET_SIZE
    })

    const dateNow = Date.now()
    const payloadId = generateId()
    payloadId.writeUintBE(dateNow, 0, DATE_SIZE)

    const dataIncorrect = serializer(jsonData).subarray(0, -1)
    const chunkIncorrect = Buffer.concat([payloadId, dataIncorrect])
    setChunkMetaInfo(chunkIncorrect, 0, 0)

    let compileWarningAppeared = false

    socket.once('warning', error => {
      if (error.message === 'compile_message_error') {
        compileWarningAppeared = true
      }
    })

    client.send(chunkIncorrect, defaultPort)

    await Promise.race([
      delay(5),
      once(socket, 'warning')
    ])

    assertTry(
      () =>
        assert.strictEqual(
          socket.messages.length,
          0,
          `${caseAlias} messages length invalid`
        ),
      results
    )

    assertTry(
      () =>
        assert.strictEqual(
          compileWarningAppeared,
          true,
          `${caseAlias} Incorrect message should raise compile warning`
        ),
      results
    )

    const dataCorrect = serializer(jsonData)
    const chunkCorrect = Buffer.concat([payloadId, dataCorrect])
    setChunkMetaInfo(chunkCorrect, 0, 0)

    await delay(5)

    assertTry(
      () =>
        assert.strictEqual(
          socket.messages.length,
          1,
          `${caseAlias} messages length invalid`
        ),
      results
    )

    checkMessage(caseAlias, socket.messages[0], results, {
      id: payloadId,
      date: dateNow,
      total: 0,
      index: 0,
      payload: dataCorrect
    })

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
    console.log(`${caseAlias} passed`)
  }

  const errors = tryCountErrorHook()

  await errors.try(testSocketSmall)
  await errors.try(testSocketLarge)
  await errors.try(testSocketWarning)

  if (errors.count === 0) {
    console.log('[socket.js] All test for passed\n')
  } else {
    console.log(`[socket.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default socketTest
