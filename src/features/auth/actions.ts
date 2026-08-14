"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Sign the current user out and return to the sign-in screen. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

/**
 * Permanently delete the current user and their data. Auth is the caller's
 * session (cookie); deletion uses the service-role admin client. FK ON DELETE
 * CASCADE removes profiles/notes/subscriptions. (Required by privacy law and a
 * good default — the web equivalent of the mobile store deletion requirement.)
 */
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return { error: "Could not delete the account. Please try again." };
  }

  await supabase.auth.signOut();
  redirect("/sign-in");
}
