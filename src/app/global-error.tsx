"use client";

/**
 * Root error boundary — catches errors in the root layout itself, so it must
 * render its own <html>/<body>. Keep it dependency-light. Wire your error
 * tracker's capture here (e.g. Sentry.captureException(error)).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Something went wrong.</h1>
          <p className="text-muted-foreground max-w-prose">
            An unexpected error occurred. You can try again, or head back home.
          </p>
          <button
            type="button"
            onClick={reset}
            className="bg-primary text-primary-foreground mt-2 inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
