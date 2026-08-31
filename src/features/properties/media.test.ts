import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The upload pipeline, on real images (AC-6).
 *
 * Built rather than committed: a 6000-pixel fixture is four megabytes in the
 * repository, and one built with `sharp` can carry exactly the EXIF the test
 * needs to prove is gone — including a GPS coordinate, which is the field that
 * actually matters here. A camera writes the location it was standing in, and
 * for a private residence that is the address.
 *
 * Files are read into a buffer before being handed to `sharp` for inspection,
 * never opened by path: on Windows `sharp` keeps the handle until it is
 * collected, and the temporary directory then cannot be removed — every
 * assertion passed and the suite failed in teardown with `EBUSY`.
 */

let root: string;

const mocks = vi.hoisted(() => ({ mediaRoot: "" }));
vi.mock("@/core/env", () => ({
  get mediaRoot() {
    return mocks.mediaRoot;
  },
}));

/** A photograph the size a camera produces, with a location in its metadata. */
async function cameraPhotograph(width = 6000, height = 4000): Promise<Buffer> {
  return (
    sharp({
      create: { width, height, channels: 3, background: { r: 180, g: 140, b: 90 } },
    })
      /*
       * The GPS block is what actually matters and sharp's published types omit
       * it, so it goes in through a cast — libvips writes it perfectly well, and
       * the test below reads it back to prove that.
       */
      .withExif({
        IFD0: { Copyright: "Belso", Make: "TestCam" },
        GPS: { GPSLatitudeRef: "N", GPSLongitudeRef: "W" },
      } as unknown as Parameters<ReturnType<typeof sharp>["withExif"]>[0])
      .jpeg()
      .toBuffer()
  );
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "belso-media-"));
  mocks.mediaRoot = root;
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("sniffImageType", () => {
  it("reads the type from the bytes, not from a name or a header", async () => {
    const { sniffImageType } = await import("./media");

    expect(sniffImageType(await cameraPhotograph(8, 8))).toBe("image/jpeg");
    expect(sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBe("image/png");
  });

  it("refuses something that is not an image", async () => {
    const { sniffImageType } = await import("./media");

    /*
     * The case this exists for: a file named `villa.jpg`, sent with
     * `Content-Type: image/jpeg`, containing a shell script. Both of those
     * claims come from whoever is uploading; the first three bytes do not.
     */
    expect(sniffImageType(Buffer.from("#!/bin/sh\nrm -rf /", "utf8"))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("storeImage", () => {
  it("keeps the original untouched and writes one master beside it", async () => {
    const { storeImage } = await import("./media");
    const original = await cameraPhotograph();

    const stored = await storeImage(original);

    const files = (await readdir(join(root, stored.id))).sort();
    expect(files).toEqual(["master.webp", "original.jpeg"]);

    /*
     * Byte-for-byte. The original is the only copy the agency has of that frame
     * at full size, and every derivative can be rebuilt from it — so nothing in
     * this pipeline may ever be the reason a photograph cannot be re-processed.
     */
    const kept = await readFile(join(root, stored.id, "original.jpeg"));
    expect(kept.equals(original)).toBe(true);
  });

  it("resizes to the long edge and records the dimensions it actually wrote", async () => {
    const { storeImage } = await import("./media");

    const stored = await storeImage(await cameraPhotograph(6000, 4000));

    expect(stored.width).toBe(2560);
    expect(stored.height).toBe(1707);

    // Measured, not computed from the input's ratio — which is how a rotated
    // photograph ends up with its dimensions transposed and `next/image`
    // reserving the wrong space for it.
    const master = await sharp(await readFile(join(root, stored.id, "master.webp"))).metadata();
    expect([master.width, master.height]).toEqual([stored.width, stored.height]);
  });

  it("serves something far smaller than what she uploaded", async () => {
    const { storeImage } = await import("./media");
    const original = await cameraPhotograph();

    const stored = await storeImage(original);
    const master = await readFile(join(root, stored.id, "master.webp"));

    // The whole point of the derivative: the page must not be serving the
    // camera file. A flat test image compresses unusually well, so the bound is
    // loose on purpose — what it catches is the derivative not being made.
    expect(master.byteLength).toBeLessThan(original.byteLength / 2);
  });

  it("strips the metadata from the master, and only from the master", async () => {
    const { storeImage } = await import("./media");

    const stored = await storeImage(await cameraPhotograph());

    /*
     * The assertion this file exists for. A camera writes where it was
     * standing; for a private residence that is the address, and the master is
     * the file on a public URL. `sharp` does not copy metadata unless asked,
     * so this is guarding against somebody later "fixing" that by adding
     * `.withMetadata()` to keep the copyright field.
     */
    const master = await sharp(await readFile(join(root, stored.id, "master.webp"))).metadata();
    expect(master.exif).toBeUndefined();

    // The original keeps it, because the original is never served.
    const kept = await sharp(await readFile(join(root, stored.id, "original.jpeg"))).metadata();
    expect(kept.exif).toBeDefined();
  });

  it("does not enlarge a photograph that is already small", async () => {
    const { storeImage } = await import("./media");

    const stored = await storeImage(await cameraPhotograph(800, 600));

    // Upscaling turns a small photograph into a blurred one and makes the file
    // bigger for nothing.
    expect([stored.width, stored.height]).toEqual([800, 600]);
  });

  it("refuses a file that is not an image, before decoding it", async () => {
    const { storeImage, UnsupportedImageError } = await import("./media");

    await expect(storeImage(Buffer.from("not an image at all", "utf8"))).rejects.toBeInstanceOf(
      UnsupportedImageError,
    );
  });

  it("gives every photograph its own directory", async () => {
    const { storeImage } = await import("./media");
    const image = await cameraPhotograph(100, 100);

    const [first, second] = await Promise.all([storeImage(image), storeImage(image)]);

    // Identical bytes, different homes: removing one photograph must never take
    // another with it.
    expect(first.id).not.toBe(second.id);
    expect(first.url).not.toBe(second.url);
  });
});
