import { Buffer } from "node:buffer"
import { Readable, ReadableOptions } from "node:stream"

export default UDPLoggerSocket
export interface UDPLoggerSocketOptions extends ReadableOptions {
  type?: 'udp4'|'udp6'
  port?: number
  host?: string
  /**
   * if passed string - will be applied aes-256-ctr encryption with passed string as secret;
   * if passed function - will be used that function to encrypt every message;
   */
  decryption?: string | ((payload: Buffer) => Buffer)
  deserializer?: (payload: Buffer) => any
  formatMessage?: (
    data: any,
    date: Date,
    id: number | string
  ) => string | Buffer | Uint8Array,
  /** how often instance will check internal buffer to delete expired messages */
  gcIntervalTime?: number,
  /** how long chunks can await all missing chunks in internal buffer */
  gcExpirationTime?: number
}

declare class UDPLoggerSocket extends Readable {
  constructor(options: UDPLoggerSocketOptions)
  get address(): string | null | undefined
  get port(): number
}
