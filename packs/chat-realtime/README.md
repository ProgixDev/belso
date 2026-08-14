# Pack: chat-realtime (web)

Supabase Realtime DMs + group chat for Next.js. Server Components render the initial messages; a
client hook subscribes to live INSERTs; Server Actions send/read. Member-scoped RLS. Logic-first;
UI is a shadcn placeholder. **Key-free**.

## What you get

- `data.ts` — `listConversations()`, `getMessages(id)` — server reads for SSR (RLS: members only).
- `actions.ts` — `sendMessage`, `createDirectConversation`, `markRead` (Server Actions, validated).
- `use-conversation.ts` — `"use client"` hook: seeds from the SSR page, then subscribes to Realtime
  and appends new messages (RLS applies to the stream, deduped).
- `ui/message-thread.tsx` — **placeholder** thread + send box.
- `app/chat/[id]/page.tsx` — thin route: server-renders the first page, client takes over live.
- `supabase/0010_chat.sql` — conversations/members/messages, member-scoped RLS via a SECURITY
  DEFINER helper (avoids recursive RLS), and the Realtime publication.

## Install

```
/add-feature chat-realtime
# apply supabase/0010_chat.sql, then:
supabase db reset && supabase test db
```

No keys — Realtime is on the free tier.

## Security

`sender_id` defaults to `auth.uid()` and RLS requires the sender to be a member, so a client can't
forge a message or post into a conversation it isn't in. The Realtime stream is filtered by the same
RLS, so a subscriber only receives messages for its own conversations. This is the web mirror of the
Expo `chat-realtime` pack — same schema, same policies.
