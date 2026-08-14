import { z } from "zod";

export const BUCKET = "user-media";

/** Allowed image content types — keep the surface small and known. */
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

/** Max upload size (8 MB). Tune for your product. */
export const MAX_BYTES = 8 * 1024 * 1024;

export const MediaPathSchema = z.string().min(3);
export type MediaPath = z.infer<typeof MediaPathSchema>;
