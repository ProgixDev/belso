"use server";

import { createClient } from "@/lib/supabase/server";
import { SendInputSchema } from "./schema";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Send a message. Validated server-side; RLS guarantees the sender is a member
 * and `sender_id` defaults to auth.uid() (a client can't forge another sender).
 */
export async function sendMessage(input: { conversationId: string; body: string }): Promise<Result> {
  const parsed = SendInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid message" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    conversation_id: parsed.data.conversationId,
    body: parsed.data.body,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Start (or reuse) a 1:1 conversation with another user. */
export async function createDirectConversation(otherUserId: string): Promise<Result & { id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: conv, error } = await supabase
    .from("conversations")
    .insert({ is_group: false })
    .select("id")
    .single();
  if (error || !conv) return { ok: false, error: error?.message ?? "Could not create conversation." };

  const { error: memberError } = await supabase.from("conversation_members").insert([
    { conversation_id: conv.id, user_id: user.id },
    { conversation_id: conv.id, user_id: otherUserId },
  ]);
  if (memberError) return { ok: false, error: memberError.message };
  return { ok: true, id: conv.id };
}

/** Mark the conversation read up to now (for unread badges). */
export async function markRead(conversationId: string): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { error } = await supabase
    .from("conversation_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
