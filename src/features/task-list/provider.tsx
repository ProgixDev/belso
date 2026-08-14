"use client";

import { createContext, useContext, useState } from "react";
import { useStore } from "zustand";
import { createTaskListStore, type TaskListState, type TaskListStore } from "./store";
import type { Task } from "./types";

const TaskListStoreContext = createContext<TaskListStore | null>(null);

type TaskListStoreProviderProps = {
  children: React.ReactNode;
  initialTasks?: Task[];
};

/** Creates one store instance per mount — RSC pages seed it via initialTasks. */
export function TaskListStoreProvider({ children, initialTasks = [] }: TaskListStoreProviderProps) {
  // Lazy useState keeps exactly one store per mounted provider (SSR-request safe).
  const [store] = useState<TaskListStore>(() => createTaskListStore(initialTasks));
  return <TaskListStoreContext.Provider value={store}>{children}</TaskListStoreContext.Provider>;
}

/** Always subscribe through a selector — whole-store subscriptions fail review. */
export function useTaskListStore<T>(selector: (state: TaskListState) => T): T {
  const store = useContext(TaskListStoreContext);
  if (!store) {
    throw new Error("useTaskListStore must be used within a TaskListStoreProvider.");
  }
  return useStore(store, selector);
}
