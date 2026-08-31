import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The one place in this application where a path segment from a URL reaches the
 * filesystem (AC-6).
 *
 * So the tests that matter are the refusals. Next decodes percent-escapes
 * before a route handler sees `params`, which is why the encoded forms are
 * exercised as their *decoded* values — checking the raw string for `../` would
 * pass every one of these and defend nothing.
 */

const mocks = vi.hoisted(() => ({ mediaRoot: "" }));
vi.mock("@/core/env", () => ({
  get mediaRoot() {
    return mocks.mediaRoot;
  },
}));

let root: string;
let parent: string;
const ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

beforeAll(async () => {
  parent = await mkdtemp(join(tmpdir(), "belso-route-"));
  root = join(parent, "media");
  mocks.mediaRoot = root;

  await mkdir(join(root, ID), { recursive: true });
  await writeFile(join(root, ID, "master.webp"), Buffer.from("RIFF....WEBP", "utf8"));
  await writeFile(join(root, ID, "original.jpeg"), Buffer.from("original bytes", "utf8"));

  // A secret one directory above the media root, which is what every traversal
  // below is reaching for.
  await writeFile(join(parent, "secret.txt"), "the password");

  // A sibling whose name merely starts with the root's — the case a
  // `startsWith` without a trailing separator lets through.
  await mkdir(`${root}-evil`, { recursive: true });
  await writeFile(join(`${root}-evil`, "master.webp"), "not ours");
});

afterAll(async () => {
  await rm(parent, { recursive: true, force: true });
  await rm(`${root}-evil`, { recursive: true, force: true });
});

const call = async (file: string[]) => {
  const { GET } = await import("./route");
  return GET(new Request("http://localhost/media"), { params: Promise.resolve({ file }) });
};

describe("serving a photograph", () => {
  it("serves the master it was asked for", async () => {
    const response = await call([ID, "master.webp"]);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
  });

  it("marks it immutable, because the URL contains the id it was written under", async () => {
    const response = await call([ID, "master.webp"]);

    /*
     * Honest rather than optimistic: re-processing a photograph mints a new
     * UUID and therefore a new URL, so the bytes at this one genuinely never
     * change. `immutable` on a URL that can change is a promise broken by a
     * cache purge nobody can perform on a visitor's browser.
     */
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("refusals", () => {
  it("refuses the original, which still carries the camera's GPS", async () => {
    /*
     * The file exists and sits beside the one that is served. It is kept so
     * derivatives can be rebuilt, and it is not published: a camera writes the
     * location it was standing in, and for a private residence that is the
     * address.
     */
    expect((await call([ID, "original.jpeg"])).status).toBe(404);
  });

  it.each([
    [["..", "..", "etc", "passwd"], "the classic"],
    [[ID, "../../secret.txt"], "escaping from a legitimate directory"],
    [["..%2F..%2Fsecret.txt", "master.webp"], "still encoded — never a real path"],
    [["../secret.txt"], "one segment, so refused on shape alone"],
    [[ID, "..", "..", "secret.txt"], "too many segments"],
    [[".", "master.webp"], "a relative directory that is not a UUID"],
    [["", "master.webp"], "an empty directory segment"],
  ])("refuses %s (%s)", async (file) => {
    expect((await call(file as string[])).status).toBe(404);
  });

  it("refuses the decoded forms, which are what the handler actually receives", async () => {
    /*
     * Next percent-decodes before `params` exists, so these are the strings the
     * handler sees when somebody requests `%2E%2E%2F%2E%2E%2Fsecret.txt`.
     * Testing the encoded spelling alone would prove nothing about the code
     * path that runs.
     */
    for (const decoded of ["../../secret.txt", "..\\..\\secret.txt", "../secret.txt"]) {
      expect((await call([ID, decoded])).status).toBe(404);
      expect((await call([decoded, "master.webp"])).status).toBe(404);
    }
  });

  it("refuses a sibling directory whose name starts with the root's", async () => {
    /*
     * `/tmp/x/media-evil` against a root of `/tmp/x/media`: a `startsWith`
     * without the trailing separator lets this through, and it is the one
     * traversal that survives an allow-list on the *file* name.
     */
    expect((await call([`../${"media-evil"}`, "master.webp"])).status).toBe(404);
  });

  it("refuses a file it did not write, even inside a real directory", async () => {
    await writeFile(join(root, ID, "shell.sh"), "#!/bin/sh");

    // The allow-list is on the name, so a file that arrives in this directory
    // by any other route is still not addressable.
    expect((await call([ID, "shell.sh"])).status).toBe(404);
  });

  it("refuses a directory that is not a UUID", async () => {
    await mkdir(join(root, "public"), { recursive: true });
    await writeFile(join(root, "public", "master.webp"), "x");

    expect((await call(["public", "master.webp"])).status).toBe(404);
  });
});
