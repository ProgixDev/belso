"use server";

import { createClient } from "@/lib/supabase/server";
import { BUCKET } from "./schema";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * A short-lived signed URL to view a private object. Files are NOT public, so
 * this is the only way to render them. Default TTL 1h; lower for sensitive media.
 * RLS still applies — you can only sign URLs for your own folder.
 */
export async function getSignedUrl(path: string, expiresInSeconds = 3600): Promise<Result<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return { ok: false, error: error?.message ?? "Could not sign URL." };
  return { ok: true, value: data.signedUrl };
}

/** List the current user's uploaded files (RLS limits this to their own folder). */
export async function listMyMedia(): Promise<Result<string[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(user.id, { sortBy: { column: "created_at", order: "desc" } });
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: (data ?? []).map((f) => `${user.id}/${f.name}`) };
}

/** Delete one of the user's files (RLS prevents touching anyone else's). */
export async function deleteMedia(path: string): Promise<Result<true>> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  return error ? { ok: false, error: error.message } : { ok: true, value: true };
}
