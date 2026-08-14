import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("allows a same-origin relative path", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("/a/b?c=1")).toBe("/a/b?c=1");
  });

  it("rejects absolute and protocol-relative URLs (open-redirect)", () => {
    expect(safeRedirectPath("https://evil.example/steal")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
  });

  it("falls back safely on empty / malformed input", () => {
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath(undefined, "/home")).toBe("/home");
    expect(safeRedirectPath("not a url")).toBe("/");
  });
});
