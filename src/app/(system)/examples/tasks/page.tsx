import type { Metadata } from "next";
import Link from "next/link";
import { TaskList, TaskListStoreProvider, type Task } from "@/features/task-list";

export const metadata: Metadata = {
  title: "Tasks example",
};

// In a real project this comes from the data layer; the page stays an RSC either way.
const seedTasks: Task[] = [
  { id: "seed-1", title: "Read AGENTS.md", done: true },
  { id: "seed-2", title: "Skim docs/INDEX.md", done: false },
  { id: "seed-3", title: "Ship a feature through a spec", done: false },
];

export default function TasksPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 py-16">
      <TaskListStoreProvider initialTasks={seedTasks}>
        <TaskList />
      </TaskListStoreProvider>
      <Link href="/" className="text-muted-foreground text-sm underline-offset-4 hover:underline">
        Back to home
      </Link>
    </main>
  );
}
