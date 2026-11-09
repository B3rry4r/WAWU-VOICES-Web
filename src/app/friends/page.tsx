import { Suspense } from "react";
import { FriendsScreen } from "@/features/friends/FriendsScreen";

export const metadata = { title: "Your friends" };

export default function FriendsPage() {
  return (
    <Suspense>
      <FriendsScreen />
    </Suspense>
  );
}
