"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConversation } from "../use-conversation";
import { type Message } from "../schema";

/**
 * DESIGN: replace after the Claude Design pass. Functional placeholder thread:
 * server-rendered initial messages + live Realtime updates + send box.
 */
export function MessageThread({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: Message[];
}) {
  const { messages, error, send } = useConversation(conversationId, initialMessages);
  const [draft, setDraft] = useState("");

  const onSend = async () => {
    if (!draft.trim()) return;
    await send(draft);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <ul className="flex-1 space-y-2 overflow-y-auto">
        {messages.map((m) => (
          <li key={m.id} className="rounded-md bg-muted p-2 text-sm">
            {m.body}
          </li>
        ))}
      </ul>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void onSend();
        }}
      >
        <Input
          data-testid="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
        />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
