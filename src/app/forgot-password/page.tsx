import { Suspense } from "react";
import { ForgotPassword } from "@/features/entry/ForgotPassword";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPassword />
    </Suspense>
  );
}
