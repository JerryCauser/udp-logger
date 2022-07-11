import { Writable, WritableOptions } from 'node:stream'

export default UDPLoggerWriter

export interface UDPLoggerWriterOptions extends WritableOptions {
  dirName: string
  fileName: string
  encoding?: string
  flags?: string
}

declare class UDPLoggerWriter extends Writable {
  constructor (options: UDPLoggerWriterOptions)
}
