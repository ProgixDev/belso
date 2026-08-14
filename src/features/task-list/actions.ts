"use server";

import { z } from "zod";
import { taskSchema } from "./types";

/**
 * Painted-door stub (docs/process/painted-door.md): validates like a real action,
 * mutates nothing. Real projects replace the body with persistence — the signature,
 * validation, and result shape are already production-grade.
 */

const saveTasksInput = z.object({
  tasks: z.array(taskSchema).max(500),
});

type SaveTasksResult = { ok: true; count: number } | { ok: false; error: string };

export async function saveTasksAction(input: unknown): Promise<SaveTasksResult> {
  const parsed = saveTasksInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Tasks payload failed validation." };
  }
  // Painted door: no persistence in the skeleton. Replace with a database write.
  return { ok: true, count: parsed.data.tasks.length };
}
