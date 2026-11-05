import { WeeklyPage } from "@/features/reach/WeeklyPage";

export const metadata = { title: "Weekly report" };

export default function Page({ params }: { params: { reportId: string } }) {
  return <WeeklyPage reportId={params.reportId} />;
}
