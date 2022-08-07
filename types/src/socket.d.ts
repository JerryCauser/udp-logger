/// <reference types="node" />
import { Buffer } from "node:buffer"
import UdpSocket from "./udp-socket"

export default UdpLoggerSocket

export interface UdpLoggerSocketOptions {
  deserializer?: (payload: Buffer) => any
  formatMessage?: (
    data: any,
    date: Date,
    id: number | string
  ) => string | Buffer | Uint8Array
}

declare class UdpLoggerSocket extends UdpSocket {
  constructor(options?: UdpLoggerSocketOptions)
}
