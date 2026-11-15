import { SurveyScreen } from "@/features/surveys/SurveyScreen";

export const metadata = { title: "Sponsored Survey" };

export default function Page({ params }: { params: { id: string } }) {
  return <SurveyScreen id={params.id} />;
}
