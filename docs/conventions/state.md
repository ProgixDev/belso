# State Conventions (Zustand)

## Decide where state lives — in this order

1. **Server** (database, API) — anything persistent. Fetched in RSC, mutated via server actions.
2. **URL** (`searchParams`) — filters, tabs, pagination, anything shareable/bookmarkable.
3. **Component** (`useState`) — local, ephemeral (an open dropdown).
4. **Feature store (Zustand)** — UI state shared across components _within one feature_: optimistic lists, wizards, selection sets.
5. **Never global app state by default.** A cross-feature store is an architectural decision (ADR required).

## The SSR-safe store pattern (mandatory)

Module-level stores are shared across requests on the server and leak data between users. Every store is therefore a **factory + React context provider**, instantiated per request:

```ts
// src/features/task-list/store.ts
import { createStore } from "zustand";
import { devtools } from "zustand/middleware";

type TaskListState = {
  tasks: Task[];
  addTask: (title: string) => void;
  toggleTask: (id: string) => void;
};

export function createTaskListStore(initial: Task[] = []) {
  return createStore<TaskListState>()(
    devtools((set) => ({
      tasks: initial,
      addTask: (title) =>
        set((s) => ({ tasks: [...s.tasks, newTask(title)] }), undefined, "task-list/add"),
      toggleTask: (id) =>
        set(
          (s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }),
          undefined,
          "task-list/toggle",
        ),
    })),
  );
}
```

A `Provider` + `useTaskListStore(selector)` hook wrap it (see `src/features/task-list/` for the canonical implementation). RSC pages pass initial data into the provider.

## Rules

- **Always select**: `useTaskListStore((s) => s.tasks)` — never subscribe to the whole store.
- Actions live **inside** the store and are named for devtools (`"feature/action"`). Components never call `set` directly.
- Store holds client/UI state only — it is not a server cache. Don't copy fetched data into a store unless you're managing optimistic updates on it.
- Keep stores flat; derive computed values in selectors or components, don't store them.
- Persisting to storage (`persist` middleware) is opt-in per store and reviewed (privacy: see appsec persona).
- Test stores headlessly: create the store in the test, call actions, assert state (`store.getState()`), no React needed.
