# UDP Logger 

Server and Client for udp logging with possibility to encrypt data.

- Fast — almost zero overhead above UDP to send messages
- Built-in encryption for sensitive logs
- Zero-dependency
- ESM and CJS

## Install

```bash
npm i --save udp-logger
```

## Description

### class `UDPLoggerClient`
Extends `EventEmitter`

#### Arguments:
- `options` `<object>` – optional
  - `type` `<'udp4' | 'udp6'>` – optional. **Default** `'udp4'`
  - `port` `<string | number>` – optional. **Default** `44002`
  - `host` `<string>` – optional. **Default** `'127.0.0.1'` or `'::1'`
  - `packetSize` `<number>` – optional. Number of bytes in each packet (chunk). **Default** `1280`
  - `isAsync` `<boolean>` – optional. Enables delayed message sending. Useful if you don't want to wait even a some `ns` in your business flow for logging. **Default** `false`
  - `encryption` `<string> | <(payload: Buffer) => Buffer>` – optional. **Default** `undefined`
    - if passed `string` - will be applied `aes-256-ctr` encryption with passed string as a secret, so it should be 32char long;
    - if passed `function` - will be used that function to encrypt every message;
    - if passed `undefined` - will not use any kind of encryption.
  - `serializer` `<(payload: any) => Buffer>` - optional. **Default** `v8.serialize`
    - Used v8.serialize, but you could use something like [bson][1], or great [avsc][2] if you could make all your logs are perfectly typed. Or you even can use `JSON.stringify/JSON.parse` if your logs are simple. It will be faster than v8 serialize/deserialize. Check this [Binary serialization comparison][3], it is cool.

#### Methods:
- `log (...args: any)`: `<void>` – just log whatever you need.

#### Events:
- `'ready'`: `<void>` – emitted when client "establish" udp connection. But you are not required to wait it and just start using it. I exposed it for debugging issues. Just start `log`

### Usage
```javascript
// Simple example with encryption
import { UDPLoggerClient } from 'udp-logger'

const logger = new UDPLoggerClient({
  port: 44002,
  // encryption: (buf) => buf.map(byte => byte ^ 83) // not safe at all, but better than nothing
  encryption: '11223344556677889900aabbccddeeff'
})

logger.log('Hello, world!')
logger.log(new Error('Goodbye, world...'))
```

```javascript
// Example of several levels of logging with encryption
import { UDPLoggerClient } from 'udp-logger'

const encryption = '11223344556677889900aabbccddeeff'

const logs = new UDPLoggerClient({ port: 45001, encryption })
const errors = new UDPLoggerClient({ port: 45002, encryption })
const statistics = new UDPLoggerClient({ port: 45003, encryption })

const logger = {
  log: logs.log,
  error: errors.log,
  stat: statistics.log
}

logger.log('logger created')

export default logger
```

---

### class `UDPLoggerServer`
Extends `EventEmitter`

It is a simple wrapper around [`UDPLoggerSocket`][socket] and [`UDPLoggerWriter`][writer] created to simplify rapid start

#### Arguments:
- `options` `<object>` – **required**
  - `dirName` `<string>` – **required**. Folder where will be created log file.
  - `fileName` `<string>` – optional. **Default** `'udp-port-${port}.log'`,
  - `encoding` `<string>` — optional. Encoding for writer to your disk. **Default** `'utf8'`,
  - `flags` `string` – optional. More info about flags you can check [here][4]. **Default** `'a'`
  - `type` `<'udp4' | 'udp6'>` – optional. **Default** `'udp4'`
  - `port` `<string | number>` – optional. **Default** `44002`
  - `host` `<string>` – optional **Default** `'127.0.0.1'` or `'::1'`
  - `decryption` `<string> | <(payload: Buffer) => Buffer>` – optional. For more details check [UDPLoggerSocket Arguments Section][socket] **Default** `undefined`
  - `deserializer` `<(payload: Buffer) => any>` - optional. For more details check [UDPLoggerSocket Arguments Section][socket] **Default** `v8.deserialize`
  - `formatMessage` `(data: any, date:Date, id:number|string) => string | Buffer | Uint8Array`  - optional. **Default** `DEFAULT_MESSAGE_FORMATTER` from constants

#### Fields: 
- `socket`: `<UDPLoggerSocket>` – instance of socket. You have access to it if you need it.
- `writer`: `<UDPLoggerWriter>` – instance of writer. You have access to it if you need it.

#### Methods:
- `start ()`: `<Promise<UDPLoggerServer>>`
- `stop ()`: `<Promise<UDPLoggerServer>>`

#### Events:
- `'ready'`: `<void>` – emitted when server started
- `'close'`: `<void>` – emitted when server closed
- `'error'`: `<Error~object>` – emitted when some error occurs in `socket` or `writer`. Requires you to handle errors on instance of servers.
- `'warning'`: `<any>` – emitted when warning occurs. For more details check [UDPLoggerSocket Events Sections][socket]

### Usage
```javascript
import { UDPLoggerServer } from 'udp-logger'

const server = new UDPLoggerServer({
  dirName: '/var/logs/my-app',
  fileName: 'my-app.log',
  port: 44002,
  // decryption: (buf) => buf.map(byte => byte ^ 83) // not safe at all, but better than nothing
  decryption: '11223344556677889900aabbccddeeff'
})

server.on('error', /*some handler for error, console.error or restart server*/)

await server.start()

console.log('log udp server started')
```

---

### class `UDPLoggerSocket`
Extends `Readable` Stream

It is a UDP socket in `readable stream` form.

#### Arguments:
- `options` `<object>` – **required**
  - `type` `<'udp4' | 'udp6'>` – optional. **Default** `'udp4'`
  - `port` `<string | number>` – optional. **Default** `44002`
  - `host` `<string>` – optional **Default** `'127.0.0.1'` or `'::1'`
  - `decryption` `<string> | <(payload: Buffer) => Buffer>` – optional. **Default** `undefined`
    - if passed `string` - will be applied `aes-256-ctr` decryption with passed string as a secret, so it should be 32char long;
    - if passed `function` - will be used that function to decrypt every message;
    - if passed `undefined` - will not use any kind of decryption.
  - `deserializer` `<(payload: Buffer) => any>` - optional. **Default** `v8.deserialize`
    - Used v8.deserialize, but you could use something like [bson][1], or great [avsc][2] if you could make all your logs are perfectly typed. Or you even can use `JSON.stringify/JSON.parse` if your logs are simple. It will be faster than v8 serialize/deserialize. Check this [Binary serialization comparison][3], it is cool.
  - `formatMessage` `(data: any, date:Date, id:number|string) => string | Buffer | Uint8Array`  - optional. **Default** `DEFAULT_MESSAGE_FORMATTER` from constants

#### Fields:
- `port`: `<number>`
- `address`: `<string>`

#### Events:
All `Readable` events of course and:

##### Event: `'ready'`
Emitted when socket started and ready to receive data.

##### Event: `'message'`
Emitted right after message was compiled and formatted. Can be used for creating some business logic based on logs (for example push some data into google statistics)
  - `message` `<string>` - message
  - `ctx` `<object>`
    - `body` `<any>` - deserialized delivered body
    - `date` `<Date>`
    - `id` `<string>`

##### Event: `'warning'`
Emitted when warning occurs.
 - `payload` `<object | Error>`
   - `message` `<string>`
   - `id` `<string>` – optional
   - `date` `<Date>` – optional

Message may be:
   - `missing_message` – when some messages didn't receive all chunks and got expired.
   - `compile_message_error` – when some messages failed to be compiled from chunks.

### Usage
```javascript

```

---

### class `UDPLoggerWriter`
Extends `Writable` Stream


---


[1]: https://github.com/mongodb/js-bson
[2]: https://github.com/mtth/avsc
[3]: https://github.com/Adelost/javascript-serialization-benchmark
[4]: https://nodejs.org/api/fs.html#file-system-flags
[server]: #class-udploggerserver
[socket]: #class-udploggersocket
[writer]: #class-udploggerwriter
