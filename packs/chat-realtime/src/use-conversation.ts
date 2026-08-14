"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageSchema, type Message } from "./schema";
import { sendMessage } from "./actions";

/**
 * Live messages for one conversation. Seed it with the server-rendered initial
 * page (`initial`), then this subscribes to Realtime INSERTs and appends new ones.
 * RLS applies to the stream too — you only receive messages for conversations
 * you're a member of. `send` calls the Server Action.
 */
export function useConversation(conversationId: string, initial: Message[] = []) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const parsed = MessageSchema.safeParse(payload.new);
          if (parsed.success) {
            setMessages((prev) =>
              prev.some((m) => m.id === parsed.data.id) ? prev : [...prev, parsed.data],
            );
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const send = async (body: string) => {
    setError(null);
    const r = await sendMessage({ conversationId, body });
    if (!r.ok) setError(r.error);
  };

  return { messages, error, send };
}
