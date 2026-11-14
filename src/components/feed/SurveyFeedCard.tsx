"use client";
import { useEffect, useRef } from "react";
import { SponsoredSurvey } from "@/components/vx";
import { aboutMinutes } from "@/features/surveys/logic";
import { recordSurveyEvent, type SurveyCard } from "@/lib/api/surveys";

/**
 * The Sponsored Survey card in the Home feed. Nothing is drawn when there is no survey (the placement call returned null or failed).
 * A VIEW is counted once, when the card is shown. The button opens the survey, where START is counted.
 */
export function SurveyFeedCard({ survey }: { survey: SurveyCard | null | undefined }) {
  const sent = useRef<string | null>(null);
  const id = survey?.id;
  useEffect(() => {
    if (!id || sent.current === id) return;
    sent.current = id;
    void recordSurveyEvent(id, "VIEW");
  }, [id]);
  if (!survey) return null;
  return (
    <SponsoredSurvey
      brand={survey.brandName}
      question={survey.title}
      questions={survey.questionCount}
      minutes={aboutMinutes(survey.questionCount)}
      href={`/surveys/${survey.id}`}
      cta="Start the survey"
    />
  );
}
