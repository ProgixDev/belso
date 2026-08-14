import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges conditional classes and resolves Tailwind conflicts", () => {
    expect(cn("p-2", false && "hidden", "p-4")).toBe("p-4");
    expect(cn("text-sm", undefined, "font-medium")).toBe("text-sm font-medium");
  });
});
