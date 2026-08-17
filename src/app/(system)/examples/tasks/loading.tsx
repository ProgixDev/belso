export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-6">
      <div className="w-full max-w-md space-y-3" aria-busy="true" aria-label="Loading tasks">
        <div className="bg-muted h-8 w-32 animate-pulse rounded-md" />
        <div className="bg-muted h-40 w-full animate-pulse rounded-xl" />
      </div>
    </main>
  );
}
