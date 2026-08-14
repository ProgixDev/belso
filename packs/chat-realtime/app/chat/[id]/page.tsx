import { getMessages, MessageThread } from "@/features/chat";

/**
 * DESIGN: replace after the Claude Design pass. Thin route: render the initial
 * messages on the server (RLS), then the client thread takes over with Realtime.
 */
export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const initialMessages = await getMessages(id);
  return (
    <main className="container mx-auto h-[80vh] py-8">
      <MessageThread conversationId={id} initialMessages={initialMessages} />
    </main>
  );
}
