import { Readable, ReadableOptions } from "node:stream";

export default UDPLoggerSocket;
export interface UDPLoggerSocketOptions extends ReadableOptions {
  type?: string;
  port?: number;
  decryption?: {
    algorithm?: string;
    secret?: string;
  };
  collectorInterval?: number;
  deserializer?: (data: Buffer) => any;
  formatMessage?: (
    data: any,
    date: Date,
    id: number | string
  ) => string | Buffer | Uint8Array;
}

declare class UDPLoggerSocket extends Readable {
  constructor(options: UDPLoggerSocketOptions);
  get address(): string | null | undefined;
  get port(): number;
}
