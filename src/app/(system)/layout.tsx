import type { Metadata } from "next";
import { RootShell, baseMetadata } from "@/app/_shell/root-shell";

/**
 * Root layout for the unlocalised app routes — `/account`, `/sign-in`,
 * `/examples`, and the catch-all 404. These are excluded from the locale tree
 * in `src/proxy.ts`, so they are English and say so.
 *
 * Kept out of search results: an account screen or a sign-in form has nothing
 * to offer a search engine, and the storefront is what should rank.
 */

export const metadata: Metadata = {
  ...baseMetadata,
  alternates: { canonical: "/" },
  robots: { index: false, follow: false },
};

export default function SystemLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RootShell lang="en">{children}</RootShell>;
}
