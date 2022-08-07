/// <reference types="node" />
import { Buffer } from "node:buffer"

export interface UdpClientOptions {
  type?: string
  port?: number
  host?: string
  /**
   * in bytes
   */
  packetSize?: number
  /**
   * if passed string - will be applied aes-256-ctr encryption with passed string as secret;
   * if passed function - will be used that function to encrypt every message;
   * if passed nothing - will not use any kind of encryption.
   */
  encryption?: string | ((payload: Buffer) => Buffer)
  captureRejections?: boolean // for reason that we do not have EventEmitterOptions I wrote it directly here
}

declare class UdpClient {
  constructor (options?: UdpClientOptions)
  send (buffer: Buffer): void
}

export default UdpClient
