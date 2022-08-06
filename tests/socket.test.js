import dgram from 'node:dgram'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { once } from 'node:events'
import { tryCountErrorHook, assertTry, checkResults } from './_main.js'

/**
 * [x] send message and receive it correctly
 * [x] send big message and receive it correctly
 *
 * [x] send incorrect message. handle warning "compile"
 * [x] send not all chunks. handle warning "missing"
 * [x] after all send one more message and everything is working

 * [x] test with encryption 'string'
 * [x] test with encryption 'function'
 */

const TIMEOUT_SYMBOL = Symbol('timeout')
const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms, TIMEOUT_SYMBOL))

/**
 * @returns {Promise<Socket & {stop: (() => Promise<void>)}>}
 */
const createUdpClient = async () => {
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
 * @param {UdpLoggerSocket} UdpLoggerSocket
 * @param {object} identifier
 * @param {object} constants
 * @returns {Promise<number>}
 */
async function socketTest (UdpLoggerSocket, identifier, constants) {
  const alias = '  socket.js: '

  const { generateId, setChunkMetaInfo, ID_SIZE, DATE_SIZE } = identifier
  const { DEFAULT_ENCRYPT_FUNCTION } = constants

  const DEFAULT_PORT = 45007
  const DEFAULT_DESERIALIZER = (buf) => buf
  const DEFAULT_FORMAT_MESSAGE = (buf) => buf

  const SMALL_PACKET_SIZE = 300
  const BIG_PACKET_SIZE = 300

  /**
   * @param {UdpLoggerSocketOptions} options
   * @param {function?} options.deserializer
   * @param {function?} options.formatMessage
   * @returns {Promise<UdpLoggerSocket & {messages:Buffer[], stop: (() => Promise<void>)}>}
   */
  const createUdpSocket = async ({
    port = DEFAULT_PORT,
    deserializer = DEFAULT_DESERIALIZER,
    formatMessage = DEFAULT_FORMAT_MESSAGE,
    ...opts
  } = {}) => {
    const socket = new UdpLoggerSocket({
      ...opts,
      port,
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
      socket.destroy(null)
      await once(socket, 'close')
    }

    return socket
  }

  function checkMessage (caseAlias, message, results, payload) {
    assertTry(
      () =>
        assert.deepStrictEqual(
          message,
          payload,
          `${caseAlias} received message should be the same as sent one`
        ),
      results
    )
  }

  async function testSocketSmall () {
    const caseAlias = `${alias} sending small message ->`
    const results = { fails: [] }

    const client = await createUdpClient()
    const socket = await createUdpSocket({
      port: DEFAULT_PORT,
      packetSize: SMALL_PACKET_SIZE
    })

    const payload = crypto.randomBytes(SMALL_PACKET_SIZE - ID_SIZE)

    const dateNow = Date.now()
    const payloadId = generateId()
    payloadId.writeUintBE(dateNow, 0, DATE_SIZE)

    const chunk = Buffer.concat([payloadId, payload])
    setChunkMetaInfo(chunk, 0, 0)

    client.send(chunk, DEFAULT_PORT)

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

    checkMessage(caseAlias, socket.messages[0], results, payload)

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
  }

  async function testSocketLarge () {
    const caseAlias = `${alias} sending large message ->`
    const results = { fails: [] }

    const client = await createUdpClient()
    const socket = await createUdpSocket({
      port: DEFAULT_PORT,
      packetSize: BIG_PACKET_SIZE
    })

    const payload1 = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)
    const payload2 = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)

    const dateNow = Date.now()
    const payloadId = generateId()
    payloadId.writeUintBE(dateNow, 0, DATE_SIZE)

    const chunk1 = Buffer.concat([payloadId, payload1])
    const chunk2 = Buffer.concat([payloadId, payload2])

    setChunkMetaInfo(chunk1, 1, 0)
    setChunkMetaInfo(chunk2, 1, 1)

    client.send(chunk1, DEFAULT_PORT)
    await delay(0)
    client.send(chunk2, DEFAULT_PORT)

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

    checkMessage(
      caseAlias,
      socket.messages[0],
      results,
      Buffer.concat([payload1, payload2])
    )

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
  }

  async function testSocketWarningCompile () {
    const caseAlias = `${alias} handling compile warning with 'objectMode': true ->`
    const results = { fails: [] }

    const jsonData = {
      a: '1234567890',
      b: 1,
      c: true,
      d: { a: -1 },
      e: [0, 'b'],
      f: null
    }

    /**
     * @param {any} obj
     * @returns {Buffer}
     */
    const serializer = (obj) => {
      return Buffer.from(JSON.stringify(obj), 'utf8')
    }

    /**
     * @param {Buffer} buf
     * @returns {any}
     */
    const deserializer = (buf) => {
      return JSON.parse(buf.toString('utf8'))
    }

    const client = await createUdpClient()
    const socket = await createUdpSocket({
      objectMode: true,
      gcExpirationTime: 10,
      gcIntervalTime: 5,
      deserializer,
      port: DEFAULT_PORT,
      packetSize: SMALL_PACKET_SIZE
    })

    const dateNow = Date.now()
    const payloadId = generateId()
    payloadId.writeUintBE(dateNow, 0, DATE_SIZE)

    const dataIncorrect = serializer(jsonData).subarray(0, -1)
    const chunkIncorrect = Buffer.concat([payloadId, dataIncorrect])
    setChunkMetaInfo(chunkIncorrect, 0, 0)

    let compileWarningAppeared = false

    socket.once('warning', (error) => {
      if (error.message === 'compile_message_error') {
        compileWarningAppeared = true
      }
    })

    client.send(chunkIncorrect, DEFAULT_PORT)

    await Promise.race([delay(5), once(socket, 'warning')])

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

    client.send(chunkCorrect, DEFAULT_PORT)

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

    checkMessage(caseAlias, socket.messages[0], results, jsonData)

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
  }

  async function testSocketWarningMissing () {
    const caseAlias = `${alias} handling warning Missing ->`
    const results = { fails: [] }

    const client = await createUdpClient()
    const socket = await createUdpSocket({
      gcExpirationTime: 6,
      gcIntervalTime: 3,
      port: DEFAULT_PORT,
      packetSize: BIG_PACKET_SIZE
    })

    const dateNow = Date.now()
    const payloadId = generateId()
    payloadId.writeUintBE(dateNow, 0, DATE_SIZE)

    const payload = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)
    const chunk = Buffer.concat([payloadId, payload])
    setChunkMetaInfo(chunk, 1, 0)

    let missingWarningAppeared = false

    socket.once('warning', (error) => {
      if (error.message === 'missing_message') {
        missingWarningAppeared = true
      }
    })

    client.send(chunk, DEFAULT_PORT)

    const delayResult = await Promise.race([
      delay(10),
      once(socket, 'warning')
    ])

    if (delayResult === TIMEOUT_SYMBOL) await delay(5)

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
          missingWarningAppeared,
          true,
          `${caseAlias} Incorrect message should raise missing warning`
        ),
      results
    )

    const secondChunk = Buffer.concat([payloadId, payload])
    setChunkMetaInfo(chunk, 1, 0)
    setChunkMetaInfo(secondChunk, 1, 1)

    client.send(chunk, DEFAULT_PORT)
    await delay(1)
    client.send(secondChunk, DEFAULT_PORT)

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

    checkMessage(
      caseAlias,
      socket.messages[0],
      results,
      Buffer.concat([payload, payload])
    )

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
  }

  async function testSocketEncFunction () {
    const caseAlias = `${alias} check decryption via Function ->`
    const results = { fails: [] }

    const secret = 0x81

    const enc = (buf) => buf.map((b) => b ^ secret)
    const dec = (buf) => buf.map((b) => b ^ secret)

    const client = await createUdpClient()
    const socket = await createUdpSocket({
      port: DEFAULT_PORT,
      packetSize: BIG_PACKET_SIZE,
      decryption: dec
    })

    const payloadOne = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)
    const payloadTwo = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)

    const dateNow = Date.now()
    const payloadId = generateId()
    payloadId.writeUintBE(dateNow, 0, DATE_SIZE)

    const chunkOne = Buffer.concat([payloadId, payloadOne])
    const chunkTwo = Buffer.concat([payloadId, payloadTwo])

    setChunkMetaInfo(chunkOne, 1, 0)
    setChunkMetaInfo(chunkTwo, 1, 1)

    client.send(enc(chunkOne), DEFAULT_PORT)
    client.send(enc(chunkTwo), DEFAULT_PORT)

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

    checkMessage(
      caseAlias,
      socket.messages[0],
      results,
      Buffer.concat([payloadOne, payloadTwo])
    )

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
  }

  async function testSocketEncString () {
    const caseAlias = `${alias} check decryption via String ->`
    const results = { fails: [] }

    const secret = crypto.randomBytes(32).toString('hex')

    const dec = secret
    const enc = (data) =>
      DEFAULT_ENCRYPT_FUNCTION(data, Buffer.from(secret, 'hex'))

    const client = await createUdpClient()
    const socket = await createUdpSocket({
      port: DEFAULT_PORT,
      packetSize: BIG_PACKET_SIZE,
      decryption: dec
    })

    const payloadOne = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)
    const payloadTwo = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)

    const dateNow = Date.now()
    const payloadId = generateId()
    payloadId.writeUintBE(dateNow, 0, DATE_SIZE)

    const chunkOne = Buffer.concat([payloadId, payloadOne])
    const chunkTwo = Buffer.concat([payloadId, payloadTwo])

    setChunkMetaInfo(chunkOne, 1, 0)
    setChunkMetaInfo(chunkTwo, 1, 1)

    client.send(enc(chunkOne), DEFAULT_PORT)
    client.send(enc(chunkTwo), DEFAULT_PORT)

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

    checkMessage(
      caseAlias,
      socket.messages[0],
      results,
      Buffer.concat([payloadOne, payloadTwo])
    )

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
  }

  const errors = tryCountErrorHook()

  await errors.try(testSocketSmall)
  await errors.try(testSocketLarge)
  await errors.try(testSocketWarningCompile)
  await errors.try(testSocketWarningMissing)
  await errors.try(testSocketEncFunction)
  await errors.try(testSocketEncString)

  if (errors.count === 0) {
    console.log('[socket.js] All test for passed\n')
  } else {
    console.log(`[socket.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default socketTest
