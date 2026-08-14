import { devtools } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { Task } from "./types";

/**
 * Vanilla store factory — the mandatory SSR-safe pattern (docs/conventions/state.md):
 * instantiated per request/mount by provider.tsx, never as a module-level singleton
 * (those leak state across server requests). Tests use this factory headlessly.
 */

export type TaskListState = {
  tasks: Task[];
  addTask: (title: string) => void;
  toggleTask: (id: string) => void;
  clearDone: () => void;
};

export type TaskListStore = ReturnType<typeof createTaskListStore>;

export function createTaskListStore(initialTasks: Task[] = []) {
  return createStore<TaskListState>()(
    devtools(
      (set) => ({
        tasks: initialTasks,
        addTask: (title) => {
          const trimmed = title.trim();
          if (!trimmed) return; // AC-3: blank titles are a no-op
          set(
            (state) => ({
              tasks: [...state.tasks, { id: crypto.randomUUID(), title: trimmed, done: false }],
            }),
            undefined,
            "task-list/addTask",
          );
        },
        toggleTask: (id) =>
          set(
            (state) => ({
              tasks: state.tasks.map((task) =>
                task.id === id ? { ...task, done: !task.done } : task,
              ),
            }),
            undefined,
            "task-list/toggleTask",
          ),
        clearDone: () =>
          set(
            (state) => ({ tasks: state.tasks.filter((task) => !task.done) }),
            undefined,
            "task-list/clearDone",
          ),
      }),
      { name: "task-list" },
    ),
  );
}
