import { Suspense } from "react";
import { ResetPassword } from "@/features/entry/ResetPassword";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}
