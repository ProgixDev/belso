"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOut, deleteAccount } from "../actions";

/**
 * Sign-out + the required account-deletion path. Deletion is irreversible, so it
 * is confirmed first and runs as a server action (service-role admin delete).
 */
export function AccountActions() {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Button variant="secondary" disabled={pending} onClick={() => startTransition(() => signOut())}>
        Sign out
      </Button>
      <Button
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (
            window.confirm(
              "Permanently delete your account and all your data? This cannot be undone.",
            )
          ) {
            startTransition(() => {
              void deleteAccount();
            });
          }
        }}
      >
        Delete account
      </Button>
      <p className="text-muted-foreground text-sm">
        Deleting your account removes all your data permanently.
      </p>
    </div>
  );
}
