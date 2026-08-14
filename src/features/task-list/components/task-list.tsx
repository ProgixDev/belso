"use client";

import { useState } from "react";
import { AnimatePresence, listItem, m } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTaskListStore } from "../provider";

export function TaskList() {
  const tasks = useTaskListStore((state) => state.tasks);
  const addTask = useTaskListStore((state) => state.addTask);
  const toggleTask = useTaskListStore((state) => state.toggleTask);
  const clearDone = useTaskListStore((state) => state.clearDone);
  const [title, setTitle] = useState("");

  const remaining = tasks.filter((task) => !task.done).length;
  const doneCount = tasks.length - remaining;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    addTask(title);
    setTitle("");
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <label htmlFor="new-task" className="sr-only">
            New task title
          </label>
          <Input
            id="new-task"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs doing?"
            required
          />
          <Button type="submit">Add</Button>
        </form>

        {tasks.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Nothing here yet — add your first task above.
          </p>
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {tasks.map((task) => (
                <m.li key={task.id} {...listItem} layout className="flex items-center gap-3">
                  <input
                    id={`task-${task.id}`}
                    type="checkbox"
                    checked={task.done}
                    onChange={() => toggleTask(task.id)}
                    className="accent-primary size-4"
                  />
                  <label
                    htmlFor={`task-${task.id}`}
                    className={task.done ? "text-muted-foreground text-sm line-through" : "text-sm"}
                  >
                    {task.title}
                  </label>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <p aria-live="polite" className="text-muted-foreground text-sm">
          {remaining === 0 ? "You’re all caught up." : `${remaining} remaining`}
        </p>
        <Button variant="outline" size="sm" onClick={clearDone} disabled={doneCount === 0}>
          Clear done
        </Button>
      </CardFooter>
    </Card>
  );
}
