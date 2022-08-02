import crypto from 'node:crypto'
import assert from 'node:assert'
import dgram from 'node:dgram'
import { once } from 'node:events'
import { tryCountErrorHook } from './_main.js'

/**
 * [x] here we need to create pure datagram server and handle message from client
 * [x] it should be sent and received almost at same time
 * [x] date info should be correct
 * [x] it should contain the correct data for single message
 * [x] separated messages should be correctly joined
 * [x] index and total should be correct
 */

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * @param {number} port
 * @returns {Promise<Socket & {messages:Buffer[], stop: (() => Promise<void>)}>}
 */
const createUDPSocket = async (port) => {
  const socket = Object.create(dgram.createSocket({ type: 'udp4', reuseAddr: true }))
  socket.bind(port, '127.0.0.1')

  const error = await Promise.race([
    once(socket, 'listening'),
    once(socket, 'error')
  ])

  socket.messages = []

  socket.on('message', (buffer) => socket.messages.push(buffer))

  if (error instanceof Error) throw Error

  socket.stop = async () => {
    socket.removeAllListeners()
    socket.close()
    await once(socket, 'close')
  }

  return socket
}

async function clientTest (UDPLoggerClient, identifier) {
  const { ID_SIZE, parseId } = identifier
  const alias = '  client.js:'

  async function testClientSmall () {
    const caseAlias = `${alias} client sending small message ->`
    const socket = await createUDPSocket(45002)
    const client = new UDPLoggerClient({ port: 45002, packetSize: 300, serializer: ([buf]) => buf })
    const payload = crypto.randomBytes(300 - ID_SIZE)

    await once(client, 'ready')

    const dateBeforeSent = Date.now()
    client.log(payload)

    await delay(5)

    assert.strictEqual(
      socket.messages.length,
      1,
      `${caseAlias} 1 message should be received by socket`
    )

    // eslint-disable-next-line no-unused-vars
    const [messageDate, id, total, index] = parseId(socket.messages[0].subarray(0, ID_SIZE))

    assert.ok(
      messageDate >= dateBeforeSent && messageDate <= Date.now(),
      `${caseAlias} Message date invalid ${new Date().toISOString()} but should be ${new Date(dateBeforeSent).toISOString()}±5ms`
    )

    assert.strictEqual(total, 0, `${caseAlias} Message total isn't same as expected`)
    assert.strictEqual(index, 0, `${caseAlias} Message index isn't same as expected`)

    assert.deepStrictEqual(
      socket.messages[0].subarray(ID_SIZE),
      payload,
      `${caseAlias} received message should be the same as sent one`
    )

    await socket.stop()

    console.log(`${caseAlias} passed`)
  }

  async function testClientLarge () {
    const caseAlias = `${alias} client sending large message ->`
    const socket = await createUDPSocket(45003)
    const client = new UDPLoggerClient({ port: 45003, packetSize: 300, serializer: ([buf]) => buf })
    const payload = crypto.randomBytes((300 - ID_SIZE) * 2)

    await once(client, 'ready')

    client.log(payload)

    await delay(5)

    assert.strictEqual(
      socket.messages.length,
      2,
      `${caseAlias} 2 messages should be received by socket`
    )

    // eslint-disable-next-line no-unused-vars
    const [msgOneDate, id1, msgOneTotal, msgOneIndex] = parseId(socket.messages[0].subarray(0, ID_SIZE))

    assert.strictEqual(msgOneTotal, 1, `${caseAlias} Message One total isn't same as expected`)
    assert.strictEqual(msgOneIndex, 0, `${caseAlias} Message One index isn't same as expected`)

    // eslint-disable-next-line no-unused-vars
    const [msgTwoDate, id2, msgTwoTotal, msgTwoIndex] = parseId(socket.messages[1].subarray(0, ID_SIZE))

    assert.strictEqual(msgTwoTotal, 1, `${caseAlias} Message Two total isn't same as expected`)
    assert.strictEqual(msgTwoIndex, 1, `${caseAlias} Message Two index isn't same as expected`)

    assert.deepStrictEqual(id1, id2, `${caseAlias} All chunks should share same ID`)
    assert.deepStrictEqual(msgOneDate, msgTwoDate, `${caseAlias} All chunks should share same Date`)

    assert.deepStrictEqual(
      Buffer.concat([
        socket.messages[0].subarray(ID_SIZE),
        socket.messages[1].subarray(ID_SIZE)
      ]),
      payload,
      `${caseAlias} received united message should be the same as sent one`
    )

    await socket.stop()

    console.log(`${caseAlias} passed`)
  }

  const errors = tryCountErrorHook()

  await errors.try(testClientSmall)
  await errors.try(testClientLarge)

  if (errors.count === 0) {
    console.log('[client.js] All test for passed\n')
  } else {
    console.log(`[client.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default clientTest
