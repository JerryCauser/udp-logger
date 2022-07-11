export const DEFAULT_SERIALIZER: (data: any) => Buffer

export interface UDPLoggerClientOptions {
  type?: string
  port?: number
  host?: string
  packetSize?: number
  isAsync?: boolean
  encryption?: {
    algorithm?: string
    secret: string
  }
  serializer?: (data: any) => Buffer
  captureRejections?: boolean // for reason that we do not have EventEmitterOptions I wrote it directly here
}

declare class UDPLoggerClient {
  constructor (options: UDPLoggerClientOptions)
  log: (...args: any) => void
}

export default UDPLoggerClient
