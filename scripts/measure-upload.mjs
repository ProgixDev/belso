#!/usr/bin/env node
/**
 * Time the photograph pipeline — the editor's slowest path (spec 011, T26).
 *
 * **The number this exists to stop people assuming.** Publishing a listing with
 * a full gallery runs `storeImage` fifteen times, sequentially, and each call
 * decodes a camera-sized JPEG, rotates it by its EXIF, resizes it to 2560px and
 * re-encodes it as WebP. That is the most CPU the application ever spends on
 * one person's behalf, and it happens on a box with two shared cores that also
 * runs Postgres and the client's n8n. `plan.md` records the risk; this measures
 * it.
 *
 * Sequential on purpose, because the application is: `media.ts` processes
 * uploads one at a time rather than in parallel, so that a gallery upload
 * cannot take the storefront down with it. Measuring them in parallel would
 * report a number the product never produces.
 *
 * **This measures the machine it runs on, which is not the VPS.** Nothing is
 * deployed there yet, so the honest use of this script is: run it here, get a
 * single-core ratio, and multiply. Do not quote the local number as the
 * client's.
 *
 *   openssl speed -evp sha256 -seconds 2        # here, and over ssh on the VPS
 *
 * Compare the 16384-byte column. On 31/08/2026 that was 2,176,622k here against
 * 1,776,877k on the VPS — a single core about 1.2x slower.
 *
 * **Do not use `dd | sha256sum` for this**, which is the obvious thing to reach
 * for and is wrong: it timed the VPS at less than half the local wall clock,
 * because on Windows it measures Git Bash's pipe and process overhead rather
 * than the processor. A benchmark that runs in one process is the point.
 *
 * And treat even the honest ratio as rough. SHA-256 is hardware-accelerated on
 * both sides and image codecs are a different workload; more importantly the
 * VPS's two cores are *shared* with Postgres and the client's n8n, so a number
 * measured on an idle box is a floor, not a promise.
 *
 * Usage: pnpm measure:upload [count]
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const count = Number(process.argv[2] ?? 15);
if (!Number.isInteger(count) || count < 1) {
  console.error("measure-upload: count must be a positive integer");
  process.exit(1);
}

const root = await mkdtemp(join(tmpdir(), "belso-measure-"));
process.env.MEDIA_ROOT = root;

// Imported after MEDIA_ROOT is set: `core/env` resolves it at module load.
const { storeImage } = await import("../src/features/properties/media.ts");

/**
 * A photograph the size a camera produces, from real photographic content.
 *
 * **Not a generated solid colour, which is the trap this function exists to
 * avoid.** `media.test.ts` builds its fixture with `sharp({create})` and a flat
 * background, which is right for that file — it asserts on dimensions and EXIF,
 * and the pixels are irrelevant. It is wrong here. A flat image compresses to
 * about a tenth of a megabyte and both decode and WebP encode finish in a
 * fraction of the time real detail takes. Measuring it reported 205 ms per
 * photograph, a best case the product never produces, which would have been
 * quoted at the client as the real number.
 *
 * So the fixture is one of the site's own stock photographs, enlarged to camera
 * dimensions. Enlarging does not invent detail, so this still understates a
 * native 6000px capture a little — but it is the same order, and it errs in the
 * direction of caution rather than flattery.
 */
async function cameraPhotograph(width = 6000, height = 4000) {
  const source = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "public",
    "design",
    "stock",
    "reveal-interior.jpg",
  );

  return sharp(await readFile(source))
    .resize({ width, height, fit: "cover" })
    .withExif({ IFD0: { Copyright: "Belso", Make: "TestCam" } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

function summarise(times) {
  const sorted = [...times].sort((a, b) => a - b);
  const total = times.reduce((sum, t) => sum + t, 0);
  return {
    total,
    mean: total / times.length,
    // The median, because one GC pause drags a mean around and the median is
    // what a photograph typically costs.
    median: sorted[Math.floor(sorted.length / 2)],
    slowest: sorted[sorted.length - 1],
  };
}

try {
  console.log(`measure-upload: building a 6000x4000 fixture…`);
  const original = await cameraPhotograph();
  console.log(`  fixture: ${(original.length / 1024 / 1024).toFixed(1)} MB\n`);

  // One warm-up, discarded: the first call pays for libvips initialising, which
  // a real server has already done by the time the client uploads anything.
  await storeImage(original);

  const times = [];
  for (let i = 0; i < count; i++) {
    const started = performance.now();
    await storeImage(original);
    times.push(performance.now() - started);
  }

  const { total, mean, median, slowest } = summarise(times);

  console.log(`measure-upload: ${count} photographs, processed sequentially\n`);
  console.log(`  per photograph  median ${median.toFixed(0)} ms · mean ${mean.toFixed(0)} ms`);
  console.log(`  slowest         ${slowest.toFixed(0)} ms`);
  console.log(`  whole gallery   ${(total / 1000).toFixed(1)} s\n`);
  console.log(`  This machine only. Scale by the VPS CPU ratio before quoting it.`);
} finally {
  await rm(root, { recursive: true, force: true });
}
