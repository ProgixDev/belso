import type { Metadata } from "next";
import { Archivo, Cormorant_Garamond, Geist, Geist_Mono } from "next/font/google";
import { MotionProvider } from "@/components/motion";
import { site } from "@/core/site";
import "../globals.css";

/**
 * The one `<html>`/`<body>` shell, shared by the two root layouts.
 *
 * There are two roots because `<html lang>` has to name the language of the
 * document, and only the `[locale]` segment knows it — a single root layout
 * nests *above* that segment and can never see it, which left French pages
 * claiming `lang="en"` (T1.7a). Route groups let `(storefront)` and `(system)`
 * each own a root, so the storefront can pass the locale down while the
 * unlocalised app routes stay English.
 *
 * Fonts are instantiated here, once: `next/font` dedupes by call site, so
 * calling it in both layouts would ship two copies of the same face.
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Navigation face. A classical serif against the grotesque brand face is the
 * register a private estate agency is read in — and it is the typographic form
 * of the site's own line, "where heritage meets home".
 *
 * Set mixed-case rather than in caps: Cormorant's whole character is in its
 * ascenders and its lowercase, and letterspaced caps flatten it into something
 * anonymous.
 */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Display face for the cinematic landing scene (matches the Claude Design source).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

/** Metadata common to both roots. Each root spreads this and adds its own. */
export const baseMetadata: Metadata = {
  metadataBase: new URL(site.url),
  applicationName: site.name,
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  openGraph: {
    type: "website",
    siteName: site.name,
    title: site.name,
    description: site.description,
    url: site.url,
  },
  twitter: {
    card: "summary_large_image",
    title: site.name,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export function RootShell({
  lang,
  dir = "ltr",
  children,
}: Readonly<{
  lang: string;
  dir?: "ltr" | "rtl";
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.name,
    url: site.url,
    description: site.description,
  };

  return (
    <html lang={lang} dir={dir} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${cormorant.variable} font-sans antialiased`}
      >
        <script
          type="application/ld+json"
          // JSON-LD is static, app-controlled data — safe to inline.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/*
         * Scroll reveals start hidden, and that start state is server-rendered.
         * Without this, a visitor with JavaScript off would find most of the
         * site invisible rather than merely unanimated.
         */}
        <noscript>
          <style>{`[data-reveal]{opacity:1 !important;transform:none !important}`}</style>
        </noscript>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
