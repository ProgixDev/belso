import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class names with Tailwind-aware conflict resolution. The only sanctioned way to build conditional className strings. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
