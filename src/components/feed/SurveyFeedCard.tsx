"use client";
import { useEffect, useRef } from "react";
import { SponsoredSurvey } from "@/components/vx";
import { aboutMinutes } from "@/features/surveys/logic";
import { recordSurveyEvent, type SurveyCard } from "@/lib/api/surveys";

/**
 * The Sponsored Survey card in the Home feed. Nothing is drawn when there is no survey (the placement call returned null or failed).
 * A VIEW is counted once per card per visit to the page, and only when at least half of the card is on screen (not when it mounts, and not
 * if the person never scrolls to it). The button opens the survey, where START is counted.
 */
export function SurveyFeedCard({ survey }: { survey: SurveyCard | null | undefined }) {
  const box = useRef<HTMLDivElement | null>(null);
  const sent = useRef<string | null>(null);
  const id = survey?.id;
  useEffect(() => {
    const el = box.current;
    if (!id || !el || sent.current === id) return;
    // A browser with no IntersectionObserver cannot say the card was seen, so nothing is counted.
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (sent.current === id) return;
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) {
          sent.current = id;
          io.disconnect();
          void recordSurveyEvent(id, "VIEW");
        }
      },
      { threshold: [0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [id]);
  if (!survey) return null;
  return (
    <div ref={box}>
      <SponsoredSurvey
        brand={survey.brandName}
        question={survey.title}
        questions={survey.questionCount}
        minutes={aboutMinutes(survey.questionCount)}
        href={`/surveys/${survey.id}`}
        cta="Start the survey"
      />
    </div>
  );
}
