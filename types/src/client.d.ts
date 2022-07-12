import { Buffer } from "node:buffer"

export interface UDPLoggerClientOptions {
  type?: string
  port?: number
  host?: string
  /**
   * in bytes
   */
  packetSize?: number
  /**
   * enable or not delayed message sent
   */
  isAsync?: boolean
  /**
   * if passed string - will be applied aes-256-ctr encryption with passed string as secret;
   * if passed function - will be used that function to encrypt every message;
   */
  encryption?: string | ((payload: Buffer) => Buffer)
  serializer?: (data: any) => Buffer
  captureRejections?: boolean // for reason that we do not have EventEmitterOptions I wrote it directly here
}

declare class UDPLoggerClient {
  constructor (options?: UDPLoggerClientOptions)
  log: (...args: any) => void
}

export default UDPLoggerClient
