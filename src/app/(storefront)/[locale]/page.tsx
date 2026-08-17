import { notFound } from "next/navigation";
import { isLocale, toPublicPath } from "@/core/i18n";
import { CinematicScroll } from "@/features/cinematic-scroll";
import { getDictionary } from "@/features/i18n";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);

  return (
    <CinematicScroll
      search={{
        action: toPublicPath("/properties", locale),
        label: dict.home.searchLabel,
        placeholder: dict.home.searchPlaceholder,
        submitLabel: dict.home.searchSubmit,
      }}
    />
  );
}
