import { ReportScreen } from "@/features/talk/ReportScreen";

export const metadata = { title: "Report" };

export default function ReportPage({ params }: { params: { type: string; id: string } }) {
  return <ReportScreen type={params.type} id={params.id} />;
}
