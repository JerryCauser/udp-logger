import UDPLoggerSocket, { UDPLoggerSocketOptions } from './socket'
import UDPLoggerWriter, { UDPLoggerWriterOptions } from './writer'

export default UDPLoggerServer
// @ts-expect-error
export interface UDPLoggerServerOptions
  extends UDPLoggerSocketOptions,
  UDPLoggerWriterOptions {}

declare class UDPLoggerServer {
  constructor (options: UDPLoggerServerOptions)
  socket: UDPLoggerSocket
  writer: UDPLoggerWriter
  start (): Promise<UDPLoggerServer>
  stop (): Promise<UDPLoggerServer>
}
