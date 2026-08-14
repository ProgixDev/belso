import { describe, expect, it } from "vitest";
import { saveTasksAction } from "./actions";

describe("saveTasksAction", () => {
  it("accepts a valid payload and reports the count", async () => {
    const result = await saveTasksAction({
      tasks: [{ id: "a", title: "Ship it", done: false }],
    });
    expect(result).toEqual({ ok: true, count: 1 });
  });

  it("rejects malformed input with a typed error instead of throwing", async () => {
    const result = await saveTasksAction({ tasks: [{ id: "", title: "", done: "nope" }] });
    expect(result.ok).toBe(false);
  });

  it("rejects non-object input", async () => {
    const result = await saveTasksAction("garbage");
    expect(result.ok).toBe(false);
  });
});
