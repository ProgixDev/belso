import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-muted-foreground font-mono text-sm">nextjs-skeleton</p>
        <h1 className="text-4xl font-semibold tracking-tight">
          A codebase that explains itself — to people and to agents.
        </h1>
        <p className="text-muted-foreground max-w-prose">
          Specs drive features, docs carry the knowledge, gates enforce the taste, and every change
          ships with screenshot evidence. Start with the example feature, then read the operating
          model.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Example feature</CardTitle>
            <CardDescription>
              The canonical slice: SSR-safe store, animated UI, e2e evidence.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/examples/tasks" className={cn(buttonVariants())}>
              Open the task list
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Operating model</CardTitle>
            <CardDescription>
              How work flows here: ground, plan, implement, verify, encode.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground font-mono text-sm">
            AGENTS.md · docs/INDEX.md · specs/
          </CardContent>
        </Card>
      </div>

      <footer className="text-muted-foreground text-sm">
        Run <code className="font-mono">pnpm verify</code> before every PR — it is the same gate CI
        runs.
      </footer>
    </main>
  );
}
