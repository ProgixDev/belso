import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-muted-foreground font-mono text-sm">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">This page could not be found.</h1>
      <p className="text-muted-foreground max-w-prose">
        The page you’re looking for doesn’t exist or may have moved.
      </p>
      <Link href="/" className={cn(buttonVariants({ variant: "default" }), "mt-2")}>
        Go home
      </Link>
    </main>
  );
}
