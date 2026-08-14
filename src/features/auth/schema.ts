import { z } from "zod";

/** Auth input contract — validated at the edge before any network call. */
export const CredentialsSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type Credentials = z.infer<typeof CredentialsSchema>;
