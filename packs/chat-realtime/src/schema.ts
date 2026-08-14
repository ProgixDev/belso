import { z } from "zod";

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  sender_id: z.string().uuid(),
  body: z.string().min(1).max(4000),
  created_at: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  is_group: z.boolean(),
  title: z.string().nullable(),
  created_at: z.string(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

/** Validated input for sending — trimmed, length-bounded (mirrors the DB check). */
export const SendInputSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1, "Message is empty").max(4000),
});
