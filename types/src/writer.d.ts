import { Writable } from 'node:stream'

export default UdpLoggerWriter

export interface UdpLoggerWriterOptions {
  filePath: string
  encoding?: string
  flags?: string
}

declare class UdpLoggerWriter extends Writable {
  constructor (options: UdpLoggerWriterOptions)
  get path(): string
  get fd(): number
  get bytesWritten(): number
  get pending(): boolean
}
