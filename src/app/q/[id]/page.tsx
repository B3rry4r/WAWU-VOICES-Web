import { QuestionScreen } from "@/features/talk/QuestionScreen";

export const metadata = { title: "Question" };

export default function QuestionPage({ params }: { params: { id: string } }) {
  return <QuestionScreen id={params.id} />;
}
