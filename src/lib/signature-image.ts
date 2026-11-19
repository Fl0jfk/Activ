import { inflateSync } from "zlib";
import { SIGNATURE_DATA_URL_PREFIX } from "@/lib/membership-bulletin";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_DECODED_BYTES = 750_000;
const MIN_DIMENSION = 60;
const MAX_PIXELS = 6_000_000;
/** Nombre minimal de pixels différents du fond pour considérer qu'un tracé existe. */
const MIN_INK_PIXELS = 60;

export const SIGNATURE_ERROR_MESSAGE = "Signature manquante ou invalide. Signez à nouveau dans l'encadré.";

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Vérifie qu'une signature est bien une image PNG non vide : décode le PNG (sans interlacement)
 * et compte les pixels qui diffèrent du fond. Refuse les images vides, trop petites ou piégées.
 */
export function inspectSignatureDataUrl(dataUrl: string): { ok: true } | { ok: false; message: string } {
  const invalid = { ok: false as const, message: SIGNATURE_ERROR_MESSAGE };
  try {
    if (!dataUrl.startsWith(SIGNATURE_DATA_URL_PREFIX)) return invalid;
    const bytes = Buffer.from(dataUrl.slice(SIGNATURE_DATA_URL_PREFIX.length), "base64");
    if (bytes.length < 100 || bytes.length > MAX_DECODED_BYTES) return invalid;
    if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return invalid;

    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = -1;
    let interlace = 0;
    const idat: Buffer[] = [];
    let offset = 8;
    let sawEnd = false;
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const type = bytes.toString("latin1", offset + 4, offset + 8);
      const start = offset + 8;
      const end = start + length;
      if (end + 4 > bytes.length) return invalid;
      if (type === "IHDR") {
        if (length !== 13) return invalid;
        width = bytes.readUInt32BE(start);
        height = bytes.readUInt32BE(start + 4);
        bitDepth = bytes[start + 8]!;
        colorType = bytes[start + 9]!;
        interlace = bytes[start + 12]!;
      } else if (type === "IDAT") {
        idat.push(bytes.subarray(start, end));
      } else if (type === "IEND") {
        sawEnd = true;
        break;
      }
      offset = end + 4;
    }

    const channels = CHANNELS[colorType];
    if (!sawEnd || !channels || idat.length === 0 || interlace !== 0) return invalid;
    if (width < MIN_DIMENSION || height < MIN_DIMENSION / 2 || width * height > MAX_PIXELS) return invalid;
    if (![1, 2, 4, 8, 16].includes(bitDepth)) return invalid;

    const bitsPerPixel = channels * bitDepth;
    const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
    const bytesPerPixel = Math.max(1, bitsPerPixel >> 3);
    const expected = height * (rowBytes + 1);
    const raw = inflateSync(Buffer.concat(idat), { maxOutputLength: expected + 16 });
    if (raw.length < expected) return invalid;

    // Défiltrage des lignes puis comparaison de chaque pixel avec celui du coin supérieur gauche.
    let previous = Buffer.alloc(rowBytes);
    let current = Buffer.alloc(rowBytes);
    let reference: Buffer | null = null;
    let inkPixels = 0;
    for (let y = 0; y < height; y += 1) {
      const rowStart = y * (rowBytes + 1);
      const filter = raw[rowStart]!;
      for (let x = 0; x < rowBytes; x += 1) {
        const value = raw[rowStart + 1 + x]!;
        const left = x >= bytesPerPixel ? current[x - bytesPerPixel]! : 0;
        const up = previous[x]!;
        const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel]! : 0;
        let decoded: number;
        switch (filter) {
          case 0:
            decoded = value;
            break;
          case 1:
            decoded = value + left;
            break;
          case 2:
            decoded = value + up;
            break;
          case 3:
            decoded = value + ((left + up) >> 1);
            break;
          case 4:
            decoded = value + paeth(left, up, upLeft);
            break;
          default:
            return invalid;
        }
        current[x] = decoded & 0xff;
      }
      if (!reference) reference = Buffer.from(current.subarray(0, bytesPerPixel));
      const pixelStep = bitsPerPixel >= 8 ? bytesPerPixel : 1;
      for (let x = 0; x + pixelStep <= rowBytes; x += pixelStep) {
        for (let k = 0; k < pixelStep; k += 1) {
          if (current[x + k] !== reference[k % reference.length]) {
            inkPixels += 1;
            break;
          }
        }
      }
      [previous, current] = [current, previous];
    }

    return inkPixels >= MIN_INK_PIXELS ? { ok: true } : invalid;
  } catch {
    return invalid;
  }
}
