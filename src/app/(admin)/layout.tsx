import type { Metadata } from "next";
import { RootShell, baseMetadata } from "@/app/_shell/root-shell";

/**
 * Root layout for the back-office.
 *
 * **A third root, rather than living under `(system)`,** which is where the
 * plan put it. `(system)` renders `RootShell lang="en"`, and `<html lang>` is
 * set by whichever root layout owns the tree — a nested layout cannot change
 * it. The back-office is French (spec 011), so under `(system)` every page of
 * it would announce French prose as English, and a screen reader would read
 * “Se connecter” with an English voice.
 *
 * That is not a new pattern: `root-shell.tsx` already explains that there are
 * two roots because only the `[locale]` segment knows its language. This is the
 * same argument for a third, and the alternative — threading a `lang` prop up
 * through a layout that sits above the one that knows — is the thing that
 * comment says does not work.
 *
 * `noindex` for the obvious reason, and `robots.ts` says the same thing again
 * so a crawler that never fetches the page still knows.
 */

export const metadata: Metadata = {
  ...baseMetadata,
  title: { default: "Espace de gestion", template: "%s · Espace de gestion" },
  alternates: { canonical: "/" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootShell lang="fr">{children}</RootShell>;
}
