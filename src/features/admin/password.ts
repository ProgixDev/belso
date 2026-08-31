import { type ScryptOptions, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Passwords for the three people who run the back-office.
 *
 * `scrypt` from `node:crypto`, with its parameters stored beside every hash so
 * raising the cost later does not invalidate the rows written before. ADR-0011
 * records why this rather than argon2 (a native dependency with per-platform
 * artefacts, for three accounts) and why this rather than an auth library.
 *
 * **No `server-only` here, unlike the rest of this slice.** This module holds
 * no secret and reads no environment: it is arithmetic over a string. It has to
 * stay importable by `scripts/admin-user.mjs`, which runs under plain `node`
 * over SSH and is the only way an account is ever created — and `server-only`
 * throws on import outside a React Server Component, which would make the
 * provisioning script impossible for no gain.
 */

/**
 * `promisify(scrypt)` picks the three-argument overload and then rejects the
 * options object, so the wrapper is written out rather than inferred.
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/**
 * ~85ms and 32MB per hash on a developer machine, two to three times that on
 * the VPS's shared cores.
 *
 * That cost is the entire mechanism, so it is worth being explicit about the
 * budget: three users, a rate limit of five attempts per account per quarter
 * hour, and no public sign-up. Nothing here can be driven hard enough for the
 * memory cost to matter to the storefront sharing the box.
 *
 * `maxmem` has to be raised: `scrypt` needs slightly more than `128 * N * r`
 * bytes, which at these parameters is exactly Node's 32MB default, so leaving
 * it out fails with "Invalid scrypt params" — a message that sounds like the
 * parameters are wrong when the ceiling is.
 */
const PARAMS = { N: 32768, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const MAX_MEM = 64 * 1024 * 1024;

/** `scrypt$N$r$p$salt$key`, all base64. Self-describing, so it can be re-read. */
const FORMAT = "scrypt";

async function derive(
  password: string,
  salt: Buffer,
  params: { N: number; r: number; p: number },
): Promise<Buffer> {
  return scryptAsync(password, salt, KEY_LENGTH, { ...params, maxmem: MAX_MEM });
}

/** Hash a new password. Used by `scripts/admin-user.mjs` and nothing else. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);

  return [
    FORMAT,
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/**
 * Verify a password against a stored hash.
 *
 * Derived with **the parameters recorded in the row**, not today's constants,
 * which is the whole point of storing them: raising the cost is then a change
 * to `PARAMS` and nothing else, and every existing account keeps working until
 * its owner next sets a password.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== FORMAT) return false;

  const [, n, r, p, salt, key] = parts as [string, string, string, string, string, string];
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Number.isInteger(params.N) || !Number.isInteger(params.r) || !Number.isInteger(params.p)) {
    return false;
  }

  const expected = Buffer.from(key, "base64");
  if (expected.length !== KEY_LENGTH) return false;

  const actual = await derive(password, Buffer.from(salt, "base64"), params);

  // Constant time. A byte-by-byte `equals` leaks how much of the key matched,
  // which over enough attempts is the key.
  return timingSafeEqual(actual, expected);
}

/**
 * A hash of a password nobody knows, verified against when the email is unknown.
 *
 * **This is the whole of the enumeration defence, and it is a timing defence,
 * not a wording one.** Returning the same message for "no such account" and
 * "wrong password" is necessary and not sufficient: without this, the unknown
 * email returns in a millisecond and the real one takes a quarter of a second,
 * so the response time answers the question the message refused to. On a
 * three-person agency that is the difference between knowing the client's own
 * address is an account and guessing.
 *
 * Started at module load rather than computed on first use, so the first
 * unknown email does not pay for the initialisation and stand out by exactly
 * the amount this exists to hide. Generated rather than committed, so it can
 * never drift from `PARAMS`.
 */
const dummyHash = hashPassword(randomBytes(32).toString("base64"));

/** Spend the same time as a real verify, then fail. Always returns `false`. */
export async function verifyAgainstDummy(password: string): Promise<false> {
  await verifyPassword(password, await dummyHash);
  return false;
}
