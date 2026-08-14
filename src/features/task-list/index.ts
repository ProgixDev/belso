/**
 * Public API of the task-list slice — the only file other layers may import
 * (docs/architecture/module-boundaries.md).
 */
export { TaskList } from "./components/task-list";
export { TaskListStoreProvider } from "./provider";
export type { Task } from "./types";
