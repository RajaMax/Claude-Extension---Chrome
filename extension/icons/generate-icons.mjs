// Generates Claude-style starburst icons (terracotta rays on transparent bg).
// Run: node generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const COLOR = [0xd9, 0x77, 0x57]; // Claude terracotta
const RAYS = 12;
const SS = 4; // supersampling factor for anti-aliasing

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Is the sample point (x,y) inside the starburst? Returns 1 or 0.
function inBurst(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.hypot(dx, dy);

  const R = size * 0.47; // ray length
  const hub = size * 0.1; // solid center disc
  if (r <= hub) return 1;
  if (r > R) return 0;

  const ang = Math.atan2(dy, dx);
  const step = (Math.PI * 2) / RAYS;
  const nearest = Math.round(ang / step) * step;

  const proj = dx * Math.cos(nearest) + dy * Math.sin(nearest); // along ray
  const perp = Math.abs(dy * Math.cos(nearest) - dx * Math.sin(nearest)); // across ray
  if (proj < 0 || proj > R) return 0;

  const t = proj / R; // 0 at center .. 1 at tip
  const halfWidth = size * 0.075 * (1 - t) + size * 0.004; // taper to a point
  return perp <= halfWidth ? 1 : 0;
}

function alphaAt(px, py, size) {
  let hits = 0;
  for (let sy = 0; sy < SS; sy++) {
    for (let sx = 0; sx < SS; sx++) {
      const x = px + (sx + 0.5) / SS;
      const y = py + (sy + 0.5) / SS;
      hits += inBurst(x, y, size);
    }
  }
  return Math.round((hits / (SS * SS)) * 255);
}

function makePng(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLen = size * 4 + 1;
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const a = alphaAt(x, y, size);
      const p = y * rowLen + 1 + x * 4;
      raw[p] = COLOR[0];
      raw[p + 1] = COLOR[1];
      raw[p + 2] = COLOR[2];
      raw[p + 3] = a;
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [16, 48, 128]) {
  writeFileSync(new URL(`./icon${size}.png`, import.meta.url), makePng(size));
  console.log(`wrote icon${size}.png`);
}
