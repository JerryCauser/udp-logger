# Udp Logger 
[![npm](https://img.shields.io/npm/v/udp-logger)](https://www.npmjs.com/package/udp-logger)
[![tests](https://img.shields.io/github/workflow/status/JerryCauser/udp-logger/tests?label=tests&logo=github)](https://github.com/JerryCauser/udp-logger/actions/workflows/tests.yml)
[![LGTM Grade](https://img.shields.io/lgtm/grade/javascript/github/JerryCauser/udp-logger)](https://lgtm.com/projects/g/JerryCauser/udp-logger)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![GitHub](https://img.shields.io/github/license/JerryCauser/udp-logger)](https://github.com/JerryCauser/udp-logger/blob/master/LICENSE)

Socket and Client for udp logging with possibility to encrypt data.

- Fast — little overhead above UDP to send messages
- Secure — built-in encryption for sensitive logs
- Simple — used well-known Node streams to manipulate and move data 
- ESM and CJS

## Install

```bash
npm i --save udp-logger
```

## Fast Start

```javascript
//app.js
import { logger } from 'udp-logger'

function main () {
  /* ... */
  logger.log('some data to log')
  /* ... */
}

main()
```

```javascript
//logger-client.js
import { UdpLoggerClient } from 'udp-logger'

export const logger = new UdpLoggerClient({ encryption: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff' })
```

```javascript
//logger-server.js
import { UdpLoggerServer } from 'udp-logger'

const server = new UdpLoggerServer({
  filePath: './my-app.log',
  decryption: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
})

await server.start()
```

After just start the logger server `node logger-server.js` and start your app `node app.js`. That's all and everything works.

## Documentation

### class `UdpLoggerClient`
Extends [`EventEmitter`][node-eventemitter]

#### Arguments:
- `options` `<object>` – optional
  - `type` `<'udp4' | 'udp6'>` – optional. **Default** `'udp4'`
  - `port` `<string | number>` – optional. **Default** `44002`
  - `host` `<string>` – optional. **Default** `'127.0.0.1'` or `'::1'`
  - `packetSize` `<number>` – optional. Number of bytes in each packet (chunk). **Default** `1280`
  - `isAsync` `<boolean>` – optional. Enables delayed message sending. Useful if you don't want to wait even for some `ns` in your business flow for logging. **Default** `false`
  - `encryption` `<string> | <(payload: Buffer) => Buffer>` – optional. **Default** `undefined`
    - if passed `string` - will be applied `aes-256-ctr` encryption with passed string as a secret, so it should be `64char` long;
    - if passed `function` - will be used that function to encrypt every message;
    - if passed `undefined` - will not use any kind of encryption.
  - `serializer` `<(payload: any) => Buffer>` - optional. **Default** `v8.serialize`
    - Used v8.serialize, but you could use something like [bson][js-bson], or great [avsc][avsc] if you could make all your logs are perfectly typed. Or you even can use `JSON.stringify/JSON.parse` if your logs are simple. It will be faster than v8 serialize/deserialize. Check this [Binary serialization comparison][javascript-serialization-benchmark], it is cool.

#### Methods:
- `log (...args: any)`: `<void>` – just log whatever you need.

#### Events:
- `'ready'`: `<void>` – emitted when the client "establishes" udp connection.

#### Usage
##### Simple example with encryption
```javascript
import { UdpLoggerClient } from 'udp-logger'

const logger = new UdpLoggerClient({
  port: 44002,
  // encryption: (buf) => buf.map(byte => byte ^ 83) // not safe at all, but better than nothing
  encryption: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
})

logger.log('Hello, world!')
logger.log(new Error('Goodbye, world...'))
```

##### Example of several levels of logging with encryption
```javascript
import { UdpLoggerClient } from 'udp-logger'

const encryption = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'

const logs = new UdpLoggerClient({ port: 45001, encryption })
const errors = new UdpLoggerClient({ port: 45002, encryption })
const statistics = new UdpLoggerClient({ port: 45003, encryption })

const logger = {
  log: logs.log,
  error: errors.log,
  stat: statistics.log
}

logger.log('logger created')

export default logger
```

---

### class `UdpLoggerServer`
Extends [`EventEmitter`][node-eventemitter]

It is a simple wrapper around [`UdpLoggerSocket`][socket] and [`UdpLoggerWriter`][writer] created to simplify rapid start

#### Arguments:
- `options` `<object>` – optional
  - `filePath` `<string>` – optional. Supports absolute and relative paths. If passed relative path then will use `process.cwd()` as a base path. **Default** `./udp-port-${port}.log`
  - `encoding` `<string>` — optional. Encoding for writer to your disk. **Default** `'utf8'`,
  - `flags` `<string>` – optional. More info about flags you can check on [NodeJS File System Flags][node-file-system-flags]. **Default** `'a'`
  - `type` `<'udp4' | 'udp6'>` – optional. **Default** `'udp4'`
  - `port` `<string> | <number>` – optional. **Default** `44002`
  - `host` `<string>` – optional **Default** `'127.0.0.1'` or `'::1'`
  - `decryption` `<string> | <(payload: Buffer) => Buffer>` – optional. For more details check [UdpLoggerSocket Arguments Section][socket] **Default** `undefined`
  - `deserializer` `<(payload: Buffer) => any>` - optional. For more details check [UdpLoggerSocket Arguments Section][socket] **Default** `v8.deserialize`
  - `formatMessage` `<(data:any, date:Date, id:number|string) => string | Buffer | Uint8Array>`  - optional. **Default** `DEFAULT_MESSAGE_FORMATTER` from constants

#### Fields: 
- `socket`: `<UdpLoggerSocket>` – instance of [socket][socket].
- `writer`: `<UdpLoggerWriter>` – instance of [writer][writer].

#### Methods:
- `start ()`: `<Promise<UdpLoggerServer>>`
- `stop ()`: `<Promise<UdpLoggerServer>>`

#### Events:
- `'ready'`: `<void>` – emitted when server started
- `'close'`: `<void>` – emitted when server closed
- `'error'`: `<Error~object>` – emitted when some error occurs in `socket` or `writer`. Requires you to handle errors on instance of server.
- `'warning'`: `<any>` – emitted when warning occurs. For more details check [UdpLoggerSocket Events Sections][socket-event-warning]

#### Usage
```javascript
import { UdpLoggerServer } from 'udp-logger'

const server = new UdpLoggerServer({
  filePath: './my-app.log',
  port: 44002,
  // decryption: (buf) => buf.map(byte => byte ^ 83) // not safe at all, but better than nothing
  decryption: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
})

await server.start()

console.log('log udp server started')
```

---

### class `UdpLoggerSocket`
Extends [`Readable` Stream][node-readable]

It is a UDP socket in `readable stream` form.

#### Arguments:
- `options` `<object>` – **required**
  - `type` `<'udp4' | 'udp6'>` – optional. **Default** `'udp4'`
  - `port` `<string | number>` – optional. **Default** `44002`
  - `host` `<string>` – optional **Default** `'127.0.0.1'` or `'::1'`
  - `decryption` `<string> | <(payload: Buffer) => Buffer>` – optional. **Default** `undefined`
    - if passed `string` - will be applied `aes-256-ctr` decryption with passed string as a secret, so it should be `64char` long;
    - if passed `function` - will be used that function to decrypt every message;
    - if passed `undefined` - will not use any kind of decryption.
  - `deserializer` `<(payload: Buffer) => any>` - optional. **Default** `v8.deserialize`
    - Used v8.deserialize, but you could use something like [bson][js-bson], or great [avsc][avsc] if you could make all your logs are perfectly typed. Or you even can use `JSON.stringify/JSON.parse` if your logs are simple. It will be faster than v8 serialize/deserialize. Check this [Binary serialization comparison][javascript-serialization-benchmark], it is cool.
  - `formatMessage` `<(data: any, date:Date, id:number|string) => string | Buffer | Uint8Array>`  - optional. **Default** `DEFAULT_MESSAGE_FORMATTER` from constants
  - `gcIntervalTime` `<number>` — optional. How often instance will check internal buffer to delete expired messages (in ms). **Default** `5000` 
  - `gcExpirationTime` `<number>`— optional. How long chunks can await all missing chunks in internal buffer (in ms). **Default** `10000`

#### Fields:
- `port`: `<number>`
- `address`: `<string>`

#### Events:
All `Readable` events of course and:

##### Event: `'ready'`
Emitted when socket started and ready to receive data.

##### Event: `'message'`
Emitted right after a message was compiled and formatted. Can be used for creating some business logic based on logs (for example pushing some data into google statistics)
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

A message might be:
   - `missing_message` – when some messages didn't receive all chunks and got expired.
   - `compile_message_error` – when some messages failed to be compiled from chunks.

#### Usage
##### Example how to use pure socket as async generator
```javascript
import { UdpLoggerSocket } from 'udp-logger'

const socket = new UdpLoggersocket({
  port: 44002,
  // decryption: (buf) => buf.map(byte => byte ^ 83) // not safe at all, but better than nothing
  decryption: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
})

for await (const message of socket) {
  /*handle messages*/
}
```

##### Example how to use socket and use [UdpLoggerWriter][writer]
```javascript
import { UdpLoggerSocket, UdpLoggerWriter } from 'udp-logger'

const socket = new UdpLoggersocket()
const writer = new UdpLoggerWriter({ filePath: './my-app.log' })

socket.pipe(writer)
```


##### Example with [file-stream-rotator][https://github.com/rogerc/file-stream-rotator]
```javascript
import { UdpLoggerSocket, UdpLoggerWriter } from 'udp-logger'

const socket = new UdpLoggersocket()
const fileStreamWithRotating = (await import('file-stream-rotator'))
        .getStream({ filename: '/tmp/test-%DATE%.log', frequency: 'daily', verbose: false, date_format: 'YYYY-MM-DD' })

socket.pipe(fileStreamWithRotating)
```
---

### class `UdpLoggerWriter`
Extends [`Writable` Stream][node-writable]

`UdpLoggerWriter` handles file moving, renaming, etc.. and keeps working after all. Usable if you will use any kind of logrotating ([linux logrotate][linux-logrotate] for example) 

#### Arguments:
- `options` `<object>` – **required**
  - `filePath` `<string>` – **required**. Supports absolute and relative paths. If passed relative path then will use `process.cwd()` as a base path
  - `encoding` `<string>` — optional. Encoding for writer to your disk. **Default** `'utf8'`
  - `flags` `string` – optional. More info about flags you can check on [NodeJS File System Flags][node-file-system-flags]. **Default** `'a'`

#### Fields:
- `path`: `<string>`
- `fd`: `<number>`
- `bytesWritten`: `<number>`
- `pending`: `<boolean>`

#### Events:
- `'ready'`: `<void>` – emitted when write stream ready

 
#### Usage
##### Example how to use socket and use [UdpLoggerSocket][socket]

```javascript
import { UdpLoggerSocket, UdpLoggerWriter } from 'udp-logger'

const socket = new UdpLoggersocket()
const writer = new UdpLoggerWriter({ filePath: './my-app.log' })

socket.pipe(writer)
```
---


### Additional Exposed variables and functions
#### function `DEFAULT_MESSAGE_FORMATTER(data, date, id)`
 - `data` `<any[]>` — deserialized arguments of `log` function from [`UdpLoggerClient`][client]
 - `date` `<Date>`
 - `id` `<string>`
 - Returns: `<Buffer>` | `<string>` | `<Uint8Array>`

Default format function to write logs. Underhood it uses [util-inspect][node-util-inspect] function. For more info, you can check the source files.

#### constant `DEFAULT_PORT`
- `<number>` : `44002`
---

There are `_identifier` and `_constants` exposed also, but they are used for internal needs. They could be removed in next releases, so it is not recommended to use it in your project.  

---

License ([MIT](LICENSE))

[js-bson]: https://github.com/mongodb/js-bson
[avsc]: https://github.com/mtth/avsc
[javascript-serialization-benchmark]: https://github.com/Adelost/javascript-serialization-benchmark
[node-file-system-flags]: https://nodejs.org/api/fs.html#file-system-flags
[node-eventemitter]: https://nodejs.org/api/events.html#class-eventemitter
[node-readable]: https://nodejs.org/api/stream.html#class-streamreadable
[node-writable]: https://nodejs.org/api/stream.html#class-streamwritable
[node-util-inspect]: https://nodejs.org/api/util.html#utilinspectobject-options
[client]: #class-udploggerclient
[server]: #class-udploggerserver
[socket]: #class-udploggersocket
[writer]: #class-udploggerwriter
[constants]: src/constants.js
[socket-event-warning]: #event-warning
[linux-logrotate]: https://linux.die.net/man/8/logrotate
