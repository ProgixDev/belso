"use client";

import { Button } from "@/components/ui/button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold">The task list hit a problem.</h1>
      <p className="text-muted-foreground text-sm">
        Your tasks are safe. Try again — if it keeps failing, let the team know.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
