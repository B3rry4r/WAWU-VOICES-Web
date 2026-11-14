// A full SharePage answer for the share page tests (a question), open or not yet open.
export const SHARE_OPENS = Date.parse("2026-11-14T23:00:00Z");
export function sharePageBody(open: boolean) {
  return {
    code: "c1", objectType: "QUESTION", topicLine: "How do you feel about Nigeria right now?", countryAndTheme: "Nigeria", arguments: [], leanLine: null, poll: null,
    proposalCount: null, topProposal: null, news: null, basedOnVoices: 0, summaryUpdatedAt: "2026-11-14T05:00:00Z", summaryLabel: "x", featuredVoice: null, transcript: null,
    question: { id: "q9", kind: "DAILY", status: open ? "LIVE" : "SCHEDULED", startsAt: new Date(SHARE_OPENS).toISOString(), text: "How do you feel about Nigeria right now?", voicesCount: 0 },
    report: null, cardFallback: false, ctaLabel: "Add your voice",
    openGraph: { title: "x", description: "x", imageUrl: "http://x/c.png", url: "http://x/s/c1" },
  };
}
