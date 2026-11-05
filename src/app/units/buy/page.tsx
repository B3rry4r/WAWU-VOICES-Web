import { Suspense } from "react";
import { BuyUnitsScreen } from "@/features/units/BuyUnitsScreen";

export const metadata = { title: "Get Voice Units" };

export default function BuyUnitsPage() {
  return (
    <Suspense>
      <BuyUnitsScreen />
    </Suspense>
  );
}
