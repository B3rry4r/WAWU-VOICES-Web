import { PersonPage } from "@/features/profile/PersonPage";

export const metadata = { title: "Profile" };

export default function Page({ params }: { params: { handle: string } }) {
  return <PersonPage segment={params.handle} />;
}
