import { Buffer } from "node:buffer"

export function DEFAULT_MESSAGE_FORMATTER (
  data: any[],
  date: Date,
  id: number | string
): string | Buffer | Uint8Array
export const DEFAULT_DESERIALIZER: (buffer: Buffer) => any
export const DEFAULT_SERIALIZER: (data: any) => Buffer
export const DEFAULT_ENCRYPT_FUNCTION: (payload: Buffer, secret: Buffer) => Buffer
export const DEFAULT_DECRYPT_FUNCTION: (payload: Buffer, secret: Buffer) => Buffer
export const DEFAULT_PORT: 44002
export const IV_SIZE: 16
