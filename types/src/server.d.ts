import { UdpSocketOptions } from './udp-socket'
import UdpLoggerSocket, { UdpLoggerSocketOptions } from './socket'
import UdpLoggerWriter, { UdpLoggerWriterOptions } from './writer'

export default UdpLoggerServer
// @ts-expect-error
export interface UdpLoggerServerOptions
  extends UdpSocketOptions, UdpLoggerSocketOptions, UdpLoggerWriterOptions {
  filePath?: string
}

declare class UdpLoggerServer {
  constructor (options?: UdpLoggerServerOptions)
  socket: UdpLoggerSocket
  writer: UdpLoggerWriter
  start (): Promise<UdpLoggerServer>
  stop (): Promise<UdpLoggerServer>
}
