import { Suspense } from "react";
import { SignIn } from "@/features/entry/SignIn";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
