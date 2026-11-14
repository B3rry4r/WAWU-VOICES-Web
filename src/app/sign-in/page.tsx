import { Suspense } from "react";
import { SignIn } from "@/features/entry/SignIn";

export const metadata = { title: "Sign in", alternates: { canonical: "/sign-in" } };

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
