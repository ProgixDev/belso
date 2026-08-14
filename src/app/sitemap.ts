import type { MetadataRoute } from "next";
import { site } from "@/core/site";

/** Add a row per public, indexable route. Keep auth/account/api out. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: site.url, lastModified: new Date(), changeFrequency: "weekly", priority: 1 }];
}
