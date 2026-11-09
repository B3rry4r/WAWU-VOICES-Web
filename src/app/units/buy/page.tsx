import { Suspense } from "react";
import { BuyUnitsScreen } from "@/features/units/BuyUnitsScreen";

export const metadata = { title: "Get tokens" };

export default function BuyUnitsPage() {
  return (
    <Suspense>
      <BuyUnitsScreen />
    </Suspense>
  );
}
