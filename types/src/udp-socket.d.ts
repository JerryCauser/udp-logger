/// <reference types="node" />
import { Buffer } from "node:buffer"
import { Readable } from "node:stream"

export default UdpSocket

export interface UdpSocketOptions {
  type?: 'udp4'|'udp6'
  port?: number
  host?: string
  /**
   * if passed string - will be applied aes-256-ctr encryption with passed string as secret;
   * if passed function - will be used that function to encrypt every message;
   * if passed nothing - will not use any kind of encryption
   */
  decryption?: string | ((payload: Buffer) => Buffer)
  /**
   * how often instance will check internal buffer to delete expired messages
   */
  gcIntervalTime?: number
  /**
   *  how long chunks can await all missing chunks in internal buffer
   */
  gcExpirationTime?: number
}

declare class UdpSocket extends Readable {
  constructor(options?: UdpSocketOptions)
  get address(): string | null | undefined
  get port(): number
}
