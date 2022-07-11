export function generateId (): Buffer
export function setChunkMetaInfo (
  id: Buffer,
  total: number,
  index: number
): void
export function parseId (buffer: Buffer): [Date, string, number, number]
export const ID_SIZE: 16
