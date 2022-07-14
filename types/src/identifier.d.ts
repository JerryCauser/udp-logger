import { Buffer } from "node:buffer"

export function generateId (): Buffer
export function setChunkMetaInfo (
  id: Buffer,
  total: number,
  index: number
): void
export function parseId (buffer: Buffer): [Date, string, number, number]
export const DATE_SIZE: number
export const SEED_SIZE: number
export const ID_SIZE: number
