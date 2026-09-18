/**
 * CRC32-IEEE (полином 0xEDB88320) — контрольная сумма файлов вложений,
 * которую требует схема (tFileChecksum: 8 hex-символов).
 */

let table: Uint32Array | null = null;

function getTable(): Uint32Array {
  if (table) return table;
  table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

export function crc32(data: Uint8Array): number {
  const t = getTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = t[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Контрольная сумма в формате схемы: 8 hex-символов в верхнем регистре. */
export function crc32Hex(data: Uint8Array): string {
  return crc32(data).toString(16).toUpperCase().padStart(8, '0');
}
