import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountActions } from "@/features/auth";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Defence in depth — middleware already guards /account.
  if (!user) redirect("/sign-in");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-muted-foreground text-sm">{user.email}</p>
      </header>
      <AccountActions />
    </main>
  );
}
