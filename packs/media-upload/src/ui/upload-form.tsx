"use client";

/* eslint-disable @next/next/no-img-element */
import { useMediaUpload } from "../use-media-upload";

/**
 * DESIGN: replace after the Claude Design pass. Functional placeholder: choose a
 * file, it uploads to the user's private folder, preview via signed URL.
 */
export function UploadForm() {
  const { state, previewUrl, error, upload } = useMediaUpload();
  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h2 className="text-lg font-semibold">Upload a photo</h2>
      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Uploaded preview"
          className="h-64 w-full rounded-md object-cover"
        />
      ) : null}
      <input
        data-testid="media-input"
        type="file"
        accept="image/*"
        disabled={state === "uploading"}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      {state === "uploading" ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
