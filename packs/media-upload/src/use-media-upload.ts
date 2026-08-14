"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSignedUrl } from "./actions";
import { ALLOWED_TYPES, BUCKET, MAX_BYTES } from "./schema";

type State = "idle" | "uploading" | "done" | "error";

/**
 * Browser upload straight to private Storage under the user's own folder. The
 * upload uses the browser Supabase client (carries the session), and RLS enforces
 * that the path's first segment is the caller's uid — so a user can only write
 * their own folder. Preview comes back as a short-lived signed URL.
 */
export function useMediaUpload() {
  const [state, setState] = useState<State>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
      setError("Unsupported file type.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("File is too large.");
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in to upload.");
      return;
    }

    setState("uploading");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `${user.id}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, file, { contentType: file.type, upsert: false });
    if (upErr) {
      setState("error");
      setError(upErr.message);
      return;
    }
    setPath(objectPath);

    const signed = await getSignedUrl(objectPath);
    setPreviewUrl(signed.ok ? signed.value : null);
    setState("done");
  };

  return { state, previewUrl, path, error, upload };
}
