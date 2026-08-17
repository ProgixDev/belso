import { Suspense } from "react";
import { SignInForm } from "@/features/auth";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-6 py-16">
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
