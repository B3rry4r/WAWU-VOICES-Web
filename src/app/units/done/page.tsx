import { Suspense } from "react";
import { PaymentDoneScreen } from "@/features/units/PaymentDoneScreen";

export const metadata = { title: "Payment" };

export default function PaymentDonePage() {
  return (
    <Suspense>
      <PaymentDoneScreen />
    </Suspense>
  );
}
