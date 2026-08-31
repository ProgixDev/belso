"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Locale, defaultLocale, locales } from "@/core/i18n";
import {
  removePhotographAction,
  reorderPhotographsAction,
  saveAltTextAction,
  uploadPhotographAction,
} from "../admin-actions";
import type { EditorListing } from "../admin-repository";

/**
 * The gallery: upload, order, and say what each photograph shows (AC-6).
 *
 * **Uploaded one file per request, in a loop that awaits.** Dragging in fifteen
 * camera files is a hundred and twenty megabytes; sent as one submission that
 * is a body buffered in memory on a two-core box that also runs Postgres and
 * the client's n8n, and the upload of one listing would take the public site
 * down with it. One at a time bounds the memory to a single frame, gives her a
 * count as it goes, and matches the resizing being sequential for the same
 * reason.
 *
 * It carries `version` and re-reads it after every step. Each of these actions
 * moves the listing's version — they all touch `property_media`, whose triggers
 * touch the parent — so a second action using the version the page was loaded
 * with would be refused as a concurrent edit by the person doing both.
 */

const MESSAGES: Record<string, string> = {
  notAnImage: "Ce fichier n’est pas une image que nous pouvons utiliser.",
  tooLarge: "Cette image dépasse 16 Mo. Réduisez-la avant de l’envoyer.",
  conflict: "Ce bien a été modifié entre-temps. Rechargez la page.",
  missing: "Cette photographie n’existe plus.",
  invalid: "L’envoi a échoué.",
  unavailable: "La base de données n’a pas répondu.",
};

const CAPTION_LABEL: Record<Locale, string> = {
  fr: "Description (français)",
  en: "Description (English)",
};

export function PhotographManager({ listing }: { listing: EditorListing }) {
  /*
   * **The version lives in a ref, not in state**, and that is not a style
   * choice.
   *
   * Every action here moves it — they all touch `property_media`, whose
   * triggers touch the parent row — so each request has to carry the version the
   * previous one produced. State is written asynchronously and read from the
   * render's closure, so a loop uploading fifteen photographs would send the
   * *same* version fifteen times: the first succeeds, the second is refused as
   * a concurrent edit, and she is told somebody else modified the listing while
   * the somebody else is her own previous upload. That is exactly what happened
   * the first time this was driven end to end — one photograph in, fourteen
   * silently abandoned.
   *
   * A ref is read and written synchronously, so the loop stays in step.
   */
  const version = useRef(listing.version);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  /*
   * Captions save on blur, which is the right moment and an invisible one: she
   * types a description, clicks away, and without this has no idea whether it
   * was kept. It is also the only thing a test can wait on before reloading —
   * and the absence of it is why the first end-to-end attempt reloaded the page
   * mid-request and reported the caption lost.
   */
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const media = listing.media;

  /*
   * Every action revalidates, so the server sends a fresh listing and this
   * component re-renders with it. Taking the version from that render keeps the
   * ref honest when something *else* moved it — an edit saved in the form above,
   * for instance — rather than only tracking this component's own writes.
   */
  useEffect(() => {
    version.current = listing.version;
  }, [listing.version]);

  /**
   * Run one action, keep the version, and surface a refusal.
   *
   * **The `catch` is not defensive padding.** These actions are called from
   * event handlers rather than from a `<form action>`, so nothing above them
   * catches a rejection: a thrown error becomes an unhandled promise rejection
   * and the interface simply does nothing, for ever, with no message. That is
   * exactly how this component failed the first time it was driven end to end —
   * fifteen photographs selected, no upload, no error, no server log.
   */
  async function run(action: typeof uploadPhotographAction, data: FormData) {
    data.set("id", listing.id);
    data.set("version", String(version.current));

    setSaved(false);
    try {
      const result = await action(null, data);
      if (result.ok) {
        version.current = result.version;
        setError(null);
        setSaved(true);
        return true;
      }
      setError(MESSAGES[result.error] ?? "L’envoi a échoué.");
    } catch (cause) {
      setError(`L’envoi a échoué : ${cause instanceof Error ? cause.message : "erreur inconnue"}`);
    }
    return false;
  }

  async function upload(files: readonly File[]) {
    setError(null);
    for (const [index, file] of files.entries()) {
      setProgress(`Envoi ${index + 1} sur ${files.length}…`);
      const data = new FormData();
      data.set("photograph", file);
      // Stops at the first refusal rather than sending the remaining fourteen
      // into the same failure.
      if (!(await run(uploadPhotographAction, data))) break;
    }
    setProgress(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function move(mediaId: string, direction: -1 | 1) {
    const order = media.map((item) => item.id);
    const from = order.indexOf(mediaId);
    const to = from + direction;
    if (to < 0 || to >= order.length) return;

    // Swap, then send the whole order: the action writes positions from the
    // list it is given, inside one transaction with the constraint deferred.
    [order[from], order[to]] = [order[to] as string, order[from] as string];

    const data = new FormData();
    for (const id of order) data.append("order", id);
    await run(reorderPhotographsAction, data);
  }

  return (
    <fieldset className="border-border/60 flex flex-col gap-4 rounded-lg border p-5">
      <legend className="px-2 text-sm font-medium">Photographies</legend>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/tiff"
          multiple
          className="max-w-sm"
          disabled={pending}
          onChange={(event) => {
            /*
             * Copied out of the live `FileList` **before** the transition, not
             * read inside it. The handler sets `pending`, which re-renders this
             * input, and the list on the element is not guaranteed to survive
             * that — reading it later found nothing to upload.
             */
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) startTransition(async () => await upload(files));
          }}
        />
        {progress ? (
          <span role="status" className="text-muted-foreground text-sm">
            {progress}
          </span>
        ) : null}
        {!progress && saved ? (
          <span role="status" className="text-muted-foreground text-sm">
            Enregistré.
          </span>
        ) : null}
      </div>

      <p className="text-muted-foreground text-sm">
        Envoyez les fichiers tels que le photographe vous les a donnés. Le site fabrique lui-même la
        taille dont il a besoin ; l’original est conservé.
      </p>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {media.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune photographie pour le moment.</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {media.map((photograph, index) => (
            <li
              key={photograph.id}
              className="border-border/60 flex flex-wrap items-start gap-4 rounded-md border p-3"
            >
              <Image
                src={photograph.url}
                // The editor's own thumbnail, not the public page's — the
                // caption below is what a visitor will hear, and describing it
                // here would put the same words on screen twice.
                alt=""
                width={160}
                height={107}
                className="h-20 w-auto rounded object-cover"
              />

              <div className="flex min-w-56 flex-1 flex-col gap-2">
                {locales.map((locale) => (
                  <label key={locale} className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">{CAPTION_LABEL[locale]}</span>
                    <Input
                      defaultValue={photograph.alt[locale] ?? ""}
                      placeholder={
                        locale === defaultLocale
                          ? "Ce que montre la photographie"
                          : "Optionnel — le français sera utilisé"
                      }
                      onBlur={(event) => {
                        const data = new FormData();
                        data.set("mediaId", photograph.id);
                        data.set("locale", locale);
                        data.set("alt", event.target.value);
                        startTransition(() => void run(saveAltTextAction, data));
                      }}
                    />
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Monter la photographie ${index + 1}`}
                  disabled={index === 0 || pending}
                  onClick={() => startTransition(() => void move(photograph.id, -1))}
                >
                  <span aria-hidden="true">↑</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Descendre la photographie ${index + 1}`}
                  disabled={index === media.length - 1 || pending}
                  onClick={() => startTransition(() => void move(photograph.id, 1))}
                >
                  <span aria-hidden="true">↓</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    const data = new FormData();
                    data.set("mediaId", photograph.id);
                    startTransition(() => void run(removePhotographAction, data));
                  }}
                >
                  Retirer
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </fieldset>
  );
}
