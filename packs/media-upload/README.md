# Pack: media-upload (web)

Upload files from the browser to a **private** Supabase Storage bucket, with **per-user folders**
enforced by RLS and **short-lived signed URLs** for reads. Logic-first; UI is a shadcn placeholder.
**Key-free**.

## What you get

- `use-media-upload.ts` — `"use client"` hook: validates type/size, uploads straight to Storage
  under `<uid>/...` with the browser client, returns a signed preview URL.
- `actions.ts` — `getSignedUrl` (private read), `listMyMedia`, `deleteMedia` (Server Actions).
- `ui/upload-form.tsx` — **placeholder** file input + preview.
- `app/media/page.tsx` — thin route hosting the uploader.
- `supabase/0010_media.sql` — creates the **private** `user-media` bucket + owner-scoped RLS on
  `storage.objects` (first path segment must equal the caller's uid).

## Install

```
/add-feature media-upload
# apply supabase/0010_media.sql, then:
supabase db reset
```

No keys, no native deps.

## Security

The bucket is **private** (`public = false`). The browser uploads directly, but RLS restricts every
object to a folder named after the owner's uid — a user can't write to or read anyone else's folder
even though the upload happens client-side. Images render via **signed URLs** (default 1h TTL), never
public URLs. This mirrors the Expo `media-upload` pack and the backend security pattern in
`docs/architecture/backend.md`.
