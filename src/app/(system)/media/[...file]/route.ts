import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { mediaRoot } from "@/core/env";

/**
 * Serves the photographs the back-office uploaded.
 *
 * A route handler rather than `public/`, because Next serves that directory
 * from a manifest computed at build time: a photograph written at runtime is a
 * photograph nothing will serve until the next deploy. In production
 * `MEDIA_ROOT` is a mounted volume that survives a container rebuild.
 *
 * **This is the one place in the application where a path segment from a URL
 * reaches the filesystem**, so it is written as three independent refusals
 * rather than one clever check. Any of them alone would probably do; the point
 * is that a mistake in one is not the end of it.
 */

/**
 * Only files this pipeline itself writes.
 *
 * `media.ts` produces exactly two names, in a directory named by a UUID. Naming
 * them here means the handler can only ever address its own output — a path
 * that is not `<uuid>/master.webp` is refused before any filesystem call
 * happens, so traversal has nothing to work with even if the checks below were
 * wrong.
 *
 * **`original.*` is deliberately not on this list.** The original keeps its
 * EXIF, and a camera writes the location it was standing in — for a private
 * residence, the address. It is kept so derivatives can be rebuilt, and it is
 * not published.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SERVED = new Map([["master.webp", "image/webp"]]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string[] }> },
): Promise<Response> {
  const { file } = await params;

  // 1. The shape. Two segments, a UUID and a name we produced.
  if (file.length !== 2) return new Response("Not found", { status: 404 });
  const [directory, name] = file as [string, string];

  const type = SERVED.get(name);
  if (!type || !UUID.test(directory)) return new Response("Not found", { status: 404 });

  /*
   * 2. The resolved path is inside the root.
   *
   * Belt and braces after the allow-list, and cheap. `resolve` collapses `..`
   * and any encoding the router has already decoded for us — Next decodes
   * percent-escapes before we see them, which is exactly why checking the raw
   * string for "../" is not enough and this compares the *result* instead.
   *
   * The trailing separator matters: without it, a sibling directory whose name
   * merely starts with the root's — `/var/lib/belso-media-evil` against
   * `/var/lib/belso-media` — passes `startsWith`.
   */
  const root = resolve(mediaRoot);
  const path = resolve(join(root, directory, name));
  if (!path.startsWith(root + sep)) return new Response("Not found", { status: 404 });

  // 3. It exists and is a file. A directory or a symlink to one is not served.
  const info = await stat(path).catch(() => null);
  if (!info?.isFile()) return new Response("Not found", { status: 404 });

  /*
   * Immutable, for a year. The URL contains a UUID minted when the file was
   * written and the file at that URL never changes — re-processing a
   * photograph produces a new id. That is what makes `immutable` honest here
   * rather than a promise we will have to break with a cache purge.
   */
  // Streamed rather than read into memory: these are 2560px photographs, and
  // buffering one per request on a two-core box is how a gallery page becomes
  // a memory spike.
  const body = Readable.toWeb(createReadStream(path)) as ReadableStream<Uint8Array>;

  return new Response(body, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(info.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      // The file is ours and its type is fixed above, but the header costs
      // nothing and this is a handler that returns bytes from disk.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
