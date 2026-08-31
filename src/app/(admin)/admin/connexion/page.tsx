import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/features/admin";
import { isEditorConfigured } from "@/core/db";
import { currentSession } from "@/core/session";
import { ADMIN_PREFIX, safeAdminPath } from "@/core/session-cookie";

export const metadata: Metadata = { title: "Connexion" };

/**
 * The one back-office address that is not gated, and the only one that may not
 * be — gating the sign-in page is how a redirect loop is built.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.next;
  /*
   * Validated here as well as in the proxy and again in the action. That is
   * three times for one value, and it is not belt-and-braces: each of the three
   * receives it from a different place — the proxy from the URL it is
   * redirecting, this page from the query string a visitor can type, the action
   * from a form field anybody can post — and none of them can vouch for the
   * others.
   */
  const next = safeAdminPath(typeof raw === "string" ? raw : null);

  // Already signed in: send her where she was going rather than showing a form
  // she does not need.
  if (await currentSession()) redirect(next ?? ADMIN_PREFIX);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl">Espace de gestion</h1>
        <p className="text-muted-foreground text-sm">
          Réservé à l’équipe Belso. Connectez-vous pour gérer le catalogue.
        </p>
      </div>

      {isEditorConfigured() ? (
        <SignInForm next={next ?? undefined} />
      ) : (
        /*
         * No `DATABASE_EDITOR_URL`. The storefront is unaffected and still
         * serving (ADR-0010), so this says what is actually wrong instead of
         * offering a form that can only ever fail.
         */
        <p role="alert" className="text-destructive text-sm">
          L’espace de gestion n’est pas configuré sur ce serveur. Le site public fonctionne
          normalement ; prévenez le développeur.
        </p>
      )}
    </main>
  );
}
