#!/usr/bin/env node
/**
 * Time the catalogue's server render (spec 010, T23).
 *
 * A data-layer swap that quietly costs 200ms is a regression even with every
 * test green, and nothing in the suite would notice. This measures
 * time-to-first-byte, which for a streamed RSC page is the shell — the honest
 * proxy for "how long the server took before the visitor saw anything".
 *
 * Reports the median as well as the mean: one GC pause or one cold connection
 * drags a ten-sample mean around, and the median is what a visitor typically
 * gets.
 *
 * Usage: node scripts/measure-render.mjs <label> [paths...]
 */
const label = process.argv[2] ?? "run";
const paths = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["/fr/biens", "/fr/biens?q=riad", "/fr/biens?sort=priceDesc", "/fr"];

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SAMPLES = 12;

/**
 * Both numbers, because on this page one of them lies.
 *
 * `first` is time-to-first-byte. `complete` is time until the whole document
 * has streamed — which for a suspended RSC page is when the listings are
 * actually in it.
 *
 * Measured against fixtures the two are nearly identical: the data resolves in
 * a microtask, React never emits the `loading.tsx` fallback, and the first
 * flush already carries all twenty cards. Measured against Postgres the page
 * genuinely suspends, so the shell leaves immediately and TTFB *improves* while
 * the visitor waits exactly as long — or longer — to see a listing.
 *
 * Reporting TTFB alone would therefore have shown the swap making the
 * catalogue faster. It does not.
 */
async function sample(url) {
  const started = performance.now();
  const response = await fetch(url);
  const reader = response.body.getReader();
  await reader.read();
  const first = performance.now() - started;

  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.length;
  }
  const complete = performance.now() - started;

  return { first, complete, bytes, status: response.status };
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

console.log(`\n${label}`);
console.log("  path                     first byte   complete    bytes  status");

for (const path of paths) {
  const url = `${BASE}${path}`;
  // Warm: the first request after a boot pays for lazy module loading and, with
  // a database, for opening the pool.
  for (let i = 0; i < 3; i++) await sample(url);

  const first = [];
  const complete = [];
  let status = 0;
  let bytes = 0;

  for (let i = 0; i < SAMPLES; i++) {
    const result = await sample(url);
    first.push(result.first);
    complete.push(result.complete);
    status = result.status;
    bytes = result.bytes;
  }

  console.log(
    `  ${path.padEnd(24)} ${median(first).toFixed(0).padStart(8)}ms ${median(complete)
      .toFixed(0)
      .padStart(9)}ms ${String(Math.round(bytes / 1024)).padStart(7)}K   ${status}`,
  );
}
