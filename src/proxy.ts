import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Refresh the Supabase session on every request and gate protected routes.
 * The matcher skips static assets and images for performance.
 *
 * Named `proxy` per the Next 16 file convention — `middleware` is deprecated.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
