"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signInAction } from "../actions";
import type { SignInError, SignInResult } from "../types";

/**
 * The back-office sign-in form.
 *
 * **French copy, written here rather than passed in**, unlike the storefront's
 * forms. The back-office is French-only for three people at one agency (spec
 * 011); threading labels through props to support a second language nobody will
 * ever read would be ceremony, and the moment there is a second language this
 * is the smallest file to revisit.
 *
 * A real `<form action>` with `useActionState`, so it submits before hydration
 * — the same reason the enquiry form is built this way.
 */

const MESSAGES: Record<SignInError, string> = {
  /*
   * One sentence for three different situations — unknown email, wrong
   * password, disabled account — and that is the requirement, not a shortcut
   * (AC-9). Naming which one it was would tell anybody with a login page which
   * addresses have accounts here.
   */
  credentials: "Adresse e-mail ou mot de passe incorrect.",
  throttled: "Trop de tentatives. Réessayez dans un quart d’heure.",
  unconfigured: "L’espace de gestion n’est pas configuré. Prévenez le développeur.",
  generic: "La connexion a échoué. Réessayez dans un instant.",
};

function SubmitButton() {
  // `useFormStatus` reads the status of the form it is *inside*, which is why
  // this is its own component rather than a branch in the parent.
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Connexion…" : "Se connecter"}
    </Button>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [result, formAction] = useActionState<SignInResult | null, FormData>(signInAction, null);

  return (
    <form action={formAction} className="flex w-full flex-col gap-5">
      {/*
       * Where to go after signing in. Revalidated in the action — this is a
       * hidden field in a form anybody can post, so the proxy having checked it
       * on the way in proves nothing about what comes back out.
       */}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field id="admin-email" label="Adresse e-mail" required>
        {(props) => (
          <Input
            {...props}
            name="email"
            type="email"
            autoComplete="username"
            defaultValue={result?.email ?? ""}
            // The first field of a page whose only purpose is this form.
            autoFocus
          />
        )}
      </Field>

      <Field id="admin-password" label="Mot de passe" required>
        {(props) => (
          <Input {...props} name="password" type="password" autoComplete="current-password" />
        )}
      </Field>

      {result ? (
        /*
         * On the form rather than on a field, because naming a field would
         * answer the question the message refuses to: an error under the email
         * box says the address is the problem, which says the account exists.
         *
         * `role="alert"` so a screen reader announces it. Without one the page
         * changes silently and the only signal is visual.
         */
        <p role="alert" className="text-destructive text-sm">
          {MESSAGES[result.error]}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
