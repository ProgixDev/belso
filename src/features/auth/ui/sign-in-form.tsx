"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { safeRedirectPath } from "@/lib/redirect";
import { CredentialsSchema } from "../schema";

/**
 * Minimal functional auth form (sign in / sign up). Intentionally plain — visual
 * design lands in the design phase. The browser Supabase client sets the auth
 * cookies; the middleware keeps the session fresh and guards protected routes.
 */
export function SignInForm() {
  const router = useRouter();
  const next = safeRedirectPath(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = CredentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid credentials");
      return;
    }
    setError(null);
    setPending(true);
    const supabase = createClient();
    const { error: authError } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword(parsed.data)
        : await supabase.auth.signUp(parsed.data);
    setPending(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "sign-in" ? "Welcome back" : "Create account"}
      </h1>
      <Input
        type="email"
        placeholder="Email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Email"
      />
      <Input
        type="password"
        placeholder="Password"
        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        aria-label="Password"
      />
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {mode === "sign-in" ? "Sign in" : "Sign up"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
      >
        {mode === "sign-in" ? "New here? Create an account" : "Have an account? Sign in"}
      </Button>
    </form>
  );
}
