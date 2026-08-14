import { describe, expect, it } from "vitest";
import { createTaskListStore } from "./store";

// Headless store tests — the factory pattern makes React unnecessary here.
describe("task-list store", () => {
  it("adds a task with the trimmed title (AC-1)", () => {
    const store = createTaskListStore();
    store.getState().addTask("  Write the spec  ");
    const tasks = store.getState().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.title).toBe("Write the spec");
    expect(tasks[0]?.done).toBe(false);
    expect(tasks[0]?.id).toBeTruthy();
  });

  it("ignores blank or whitespace-only titles (AC-3)", () => {
    const store = createTaskListStore();
    store.getState().addTask("");
    store.getState().addTask("   ");
    expect(store.getState().tasks).toHaveLength(0);
  });

  it("toggles done state and keeps other tasks untouched (AC-2)", () => {
    const store = createTaskListStore([
      { id: "a", title: "First", done: false },
      { id: "b", title: "Second", done: false },
    ]);
    store.getState().toggleTask("a");
    expect(store.getState().tasks.find((t) => t.id === "a")?.done).toBe(true);
    expect(store.getState().tasks.find((t) => t.id === "b")?.done).toBe(false);
    store.getState().toggleTask("a");
    expect(store.getState().tasks.find((t) => t.id === "a")?.done).toBe(false);
  });

  it("clearDone removes only completed tasks (AC-4)", () => {
    const store = createTaskListStore([
      { id: "a", title: "Done one", done: true },
      { id: "b", title: "Open one", done: false },
    ]);
    store.getState().clearDone();
    expect(store.getState().tasks).toEqual([{ id: "b", title: "Open one", done: false }]);
  });

  it("seeds from initial tasks", () => {
    const store = createTaskListStore([{ id: "a", title: "Seeded", done: false }]);
    expect(store.getState().tasks).toHaveLength(1);
  });
});
