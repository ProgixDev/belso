import { z } from "zod";

export const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  done: z.boolean(),
});

export type Task = z.infer<typeof taskSchema>;
