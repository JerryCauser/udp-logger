import { Buffer } from "node:buffer"

export function generateId (): Buffer
export function setChunkMetaInfo (
  id: Buffer,
  total: number,
  index: number
): void
export function parseId (buffer: Buffer): [Date, string, number, number]
export const DATE_SIZE: number
export const INCREMENTAL_SIZE: number
export const TIME_META_SIZE: number
export const RANDOM_SIZE: number
export const SEED_SIZE: number
export const COUNTER_TOTAL_SIZE: number
export const COUNTER_INDEX_SIZE: number
export const ID_SIZE: number
export const SEED_N_TOTAL_OFFSET: number
