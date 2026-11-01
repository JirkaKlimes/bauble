/// <reference path="../../.dev/pb_data/types.d.ts" />

// PocketBase decodes the whole image to make a thumbnail. A small file can
// declare a huge canvas (20000 x 20000 px is 1.6 GB decoded), so images are
// checked from their header before they are stored.
const MAX_SIDE = 6000;
const MAX_PIXELS = 24e6;
const HEAD_BYTES = 256 * 1024; // JPEG frame headers come after EXIF, which is at most 64 KiB

const be16 = (b, i) => (b[i] << 8) | b[i + 1];
const be32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const le16 = (b, i) => b[i] | (b[i + 1] << 8);
const le24 = (b, i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b, i, n) => String.fromCharCode.apply(null, b.slice(i, i + n));

function jpegSize(b) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    const frame = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    if (frame) return { w: be16(b, i + 7), h: be16(b, i + 5) };
    i += 2 + be16(b, i + 2);
  }
  return null;
}

function webpSize(b) {
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") return { w: le16(b, 26) & 0x3fff, h: le16(b, 28) & 0x3fff };
  if (chunk === "VP8L") return { w: 1 + (b[21] | ((b[22] & 0x3f) << 8)), h: 1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10)) };
  if (chunk === "VP8X") return { w: 1 + le24(b, 24), h: 1 + le24(b, 27) };
  return null;
}

/** Width and height from the header of a JPEG, PNG, GIF or WebP, or null. */
function size(b) {
  if (b.length < 30) return null;
  if (b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return { w: be32(b, 16), h: be32(b, 20) };
  if (ascii(b, 0, 4) === "GIF8") return { w: le16(b, 6), h: le16(b, 8) };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return webpSize(b);
  if (b[0] === 0xff && b[1] === 0xd8) return jpegSize(b);
  return null;
}

function acceptable(bytes) {
  const s = size(bytes);
  return !!s && s.w > 0 && s.h > 0 && s.w <= MAX_SIDE && s.h <= MAX_SIDE && s.w * s.h <= MAX_PIXELS;
}

function headOf(file) {
  const r = file.reader.open();
  try { return toBytes(r, HEAD_BYTES); } finally { r.close(); }
}

/** Responds 400 when a new upload in `field` is not an image of a sane size. */
function guardUpload(e, field) {
  for (const f of e.record.getUnsavedFiles(field)) {
    if (!acceptable(headOf(f))) {
      return e.json(400, { status: 400, code: "image_too_large", message: "The image is too large or not a supported format." });
    }
  }
  return e.next();
}

module.exports = { acceptable, guardUpload };
