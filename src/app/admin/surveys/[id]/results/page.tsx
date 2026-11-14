import { AdminSurveyResultsPage } from "@/features/admin/SurveyResultsPage";

export default function Page({ params }: { params: { id: string } }) {
  return <AdminSurveyResultsPage id={params.id} />;
}
