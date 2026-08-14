import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MessageSchema, ConversationSchema, type Message, type Conversation } from "./schema";

/** Conversations the current user belongs to (RLS: member-scoped). For SSR lists. */
export async function listConversations(): Promise<Conversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, is_group, title, created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((c) => ConversationSchema.parse(c));
}

/** Initial message page for a thread (RLS: members only). Render on the server. */
export async function getMessages(conversationId: string, limit = 50): Promise<Message[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data.map((m) => MessageSchema.parse(m));
}
