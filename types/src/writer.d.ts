import { Writable, WritableOptions } from 'node:stream'

export default UDPLoggerWriter

export interface UDPLoggerWriterOptions extends WritableOptions {
  filePath: string
  encoding?: string
  flags?: string
}

declare class UDPLoggerWriter extends Writable {
  constructor (options: UDPLoggerWriterOptions)
  get path(): string
  get fd(): number
  get bytesWritten(): number
  get pending(): boolean
}
