/**
 * Generates YardFlow POS brand assets as solid-color PNGs (no external deps).
 * Brand green: #146b4d → rgb(20, 107, 77)
 * Run from apps/pos:  node scripts/generate-assets.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// ─── CRC32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = (CRC_TABLE[(crc ^ b) & 0xff] ?? 0) ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0);
}

// ─── PNG chunk ───────────────────────────────────────────────────────────────
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

// ─── Solid-color PNG ─────────────────────────────────────────────────────────
function solidPNG(width, height, r, g, b) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);   // 8-bit depth
  ihdr.writeUInt8(2, 9);   // RGB
  ihdr.writeUInt8(0, 10);  // deflate
  ihdr.writeUInt8(0, 11);  // no filter
  ihdr.writeUInt8(0, 12);  // no interlace

  // Build one scanline then repeat; solid color compresses to nearly nothing
  const scanline = Buffer.allocUnsafe(1 + width * 3);
  scanline[0] = 0; // filter: None
  for (let x = 0; x < width; x++) {
    scanline[1 + x * 3] = r;
    scanline[2 + x * 3] = g;
    scanline[3 + x * 3] = b;
  }
  const rows = Buffer.concat(Array.from({ length: height }, () => scanline));
  const compressed = deflateSync(rows, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Brand palette ───────────────────────────────────────────────────────────
const GREEN = [20, 107, 77];   // #146b4d  (green-800)

mkdirSync('assets', { recursive: true });

// App icon  1024×1024
writeFileSync('assets/icon.png', solidPNG(1024, 1024, ...GREEN));
console.log('✓ assets/icon.png');

// Adaptive icon foreground  1024×1024
writeFileSync('assets/adaptive-icon.png', solidPNG(1024, 1024, ...GREEN));
console.log('✓ assets/adaptive-icon.png');

// Splash  1200×1200 (Expo scales; solid brand green)
writeFileSync('assets/splash.png', solidPNG(1200, 1200, ...GREEN));
console.log('✓ assets/splash.png');

console.log('\nAssets written to apps/pos/assets/');
