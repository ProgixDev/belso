import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { mediaRoot } from "@/core/env";

/**
 * Turning what the photographer sent into what the website serves.
 *
 * The client drags in full-size camera files — 6000 pixels wide, eight
 * megabytes, sometimes with the GPS coordinates of the villa in the EXIF. Three
 * things have to happen to each one, and the order matters:
 *
 * 1. **The original is written untouched.** It is the only copy the agency has
 *    of that frame at full size, and every derivative can be rebuilt from it.
 *    Nothing here may ever be the reason a photograph cannot be re-processed.
 * 2. **One derivative**, at most 2560px on its long edge, WebP. Not a ladder of
 *    six sizes: `next/image` resizes on demand from whatever it is given, and
 *    the master exists so that it is not resizing an eight-megabyte JPEG on a
 *    two-core box on every cache miss.
 * 3. **EXIF is stripped from the derivative.** A camera writes the location it
 *    was standing in, and for a private residence that is the address —
 *    published, on a public URL, to anyone who reads the file's metadata. The
 *    original keeps it, because the original is never served.
 *
 * **Processed one at a time**, deliberately: see `processUpload`.
 */

/** The long edge of the served master. */
const MAX_EDGE = 2560;

/** WebP quality. 82 is where the difference stops being visible on photographs. */
const QUALITY = 82;

/**
 * What we will decode, by magic bytes rather than by the name the browser sent.
 *
 * A file called `villa.jpg` is a claim, not a fact, and `Content-Type` on a
 * multipart part is attacker-controlled. `sharp` would refuse to decode
 * something that is not an image anyway — the point of checking first is to
 * refuse before handing an unknown blob to a native image library, which is
 * where decoder vulnerabilities live.
 */
const SIGNATURES: readonly { type: string; bytes: readonly number[]; offset?: number }[] = [
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { type: "image/webp", bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  { type: "image/avif", bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
  { type: "image/tiff", bytes: [0x49, 0x49, 0x2a, 0x00] },
];

export class UnsupportedImageError extends Error {
  constructor() {
    super("That file is not an image we can use.");
    this.name = "UnsupportedImageError";
  }
}

/** The type of an image, read from its own first bytes. Null when unrecognised. */
export function sniffImageType(buffer: Buffer): string | null {
  for (const { type, bytes, offset = 0 } of SIGNATURES) {
    if (buffer.length < offset + bytes.length) continue;
    if (bytes.every((byte, i) => buffer[offset + i] === byte)) return type;
  }
  return null;
}

export type StoredImage = {
  /** Stable id, also the directory both files live in. */
  id: string;
  /** The path the site serves, as stored in `property_media.url`. */
  url: string;
  /** The **derivative's** dimensions, measured rather than assumed. */
  width: number;
  height: number;
};

/**
 * Store one photograph, and return what the catalogue needs to know about it.
 *
 * **Sequential by contract, not by accident.** A fifteen-photograph upload is
 * fifteen decodes and fifteen encodes; run in parallel on a two-core box that
 * also runs Postgres and the client's n8n, one save would starve the public
 * site for the length of it. The caller loops and awaits — `Promise.all` here
 * would be a plausible-looking optimisation that turns a slow save into an
 * outage.
 *
 * Files are laid out one directory per image, so the original and the master
 * share a prefix and removing a photograph is removing a directory.
 */
export async function storeImage(original: Buffer): Promise<StoredImage> {
  const type = sniffImageType(original);
  if (!type) throw new UnsupportedImageError();

  const id = randomUUID();
  const directory = join(mediaRoot, id);
  await mkdir(directory, { recursive: true });

  /*
   * The original first, and under a name of our choosing.
   *
   * **The uploaded filename is not a parameter of this function**, which is the
   * simplest way to guarantee it never becomes part of a path. A browser will
   * send `../../etc/passwd` as a filename if asked to, along with null bytes
   * and three hundred characters of Unicode, and the only thing it could
   * contribute here is an extension — which is better taken from the bytes.
   */
  const extension = type.split("/")[1] ?? "bin";
  await writeFile(join(directory, `original.${extension}`), original);

  /*
   * `rotate()` with no argument applies the EXIF orientation and then drops it.
   * Without it, a portrait photograph taken on a phone is stored rotated: the
   * pixels are landscape and only the metadata says otherwise — metadata this
   * pipeline is about to strip.
   *
   * `withoutEnlargement` so a small photograph is not upscaled into blur.
   * Metadata is not copied, which is what removes the GPS coordinates.
   */
  const master = sharp(original, { failOn: "error" })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: QUALITY });

  const { data, info } = await master.toBuffer({ resolveWithObject: true });
  await writeFile(join(directory, "master.webp"), data);

  return {
    id,
    url: `/media/${id}/master.webp`,
    // Measured from what was actually written. Computing them from the input
    // and the ratio is how a rotated photograph ends up with its dimensions
    // transposed, which `next/image` then reserves the wrong space for.
    width: info.width,
    height: info.height,
  };
}
