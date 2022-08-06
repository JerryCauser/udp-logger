/// <reference types="node" />
import { Buffer } from "node:buffer"
import UdpClient from "./udp-client"

export interface UdpLoggerClientOptions {
  /**
   * disables/enables delayed message sending
   */
  sync?: boolean
  serializer?: (data: any) => Buffer
}

declare class UdpLoggerClient extends UdpClient {
  constructor (options?: UdpLoggerClientOptions)
  log (...args: any[]): void
}

export default UdpLoggerClient
