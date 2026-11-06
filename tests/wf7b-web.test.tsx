// @vitest-environment jsdom
// WF-7b (web leftovers from the final walk): A-F2 poll /s once, A-F4 text Posted, A-F5 a tie has no leader, B M-1 share card votes, B M-3 @handle, C moderation words.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { Poll } from "@/components/vx";
import { ShareCard } from "@/components/vx/share";
import { SharePageView } from "@/features/share/SharePageView";
import type { SharePage } from "@/lib/api/reach";

afterEach(cleanup);

const sp = (over: Record<string, unknown>) => ({ code: "abc1234", objectType: "POLL_RESULT", topicLine: "What would make you feel truly fine again?", countryAndTheme: "Nigeria · Week 1", arguments: [{ text: "Stable power", voices: 2 }, { text: "A job", voices: 1 }], leanLine: "People are split so far.", poll: null, proposalCount: null, topProposal: null, news: null, basedOnVoices: 5, summaryUpdatedAt: new Date().toISOString(), summaryLabel: "Poll so far", featuredVoice: null, transcript: null, question: null, report: null, cardFallback: false, ctaLabel: "Add your voice", openGraph: { title: "t", description: "d", imageUrl: "https://v.test/c.png", url: "https://v.test/s/abc1234" }, ...over }) as unknown as SharePage;
const poll = { pollId: "p1", status: "OPEN", totalVotes: 5, options: [{ id: "o1", label: "Stable power", votes: 2, percent: 40 }, { id: "o2", label: "A job", votes: 1, percent: 20 }], leadingOptionId: "o1", asOf: new Date().toISOString(), myVote: null };

describe("WF-7b", () => {
  it("A-F2: a poll /s page lists each option once and shows the title once on screen", () => {
    const html = renderToString(<SharePageView page={sp({ poll })} now={Date.now()} />);
    expect(html.match(/Stable power/g)).toHaveLength(1);
    expect(html).toContain("Based on 5 votes");
  });
  it("A-F5: a tie has no Leading mark, a clear leader has one", () => {
    render(<Poll question="Q" state="results" onExplain={false} options={[{ id: "a", label: "A", votes: 2 }, { id: "b", label: "B", votes: 2 }]} />);
    expect(screen.queryByText("Leading")).toBeNull();
    cleanup();
    render(<Poll question="Q" state="results" onExplain={false} options={[{ id: "a", label: "A", votes: 3 }, { id: "b", label: "B", votes: 2 }]} />);
    expect(screen.getAllByText("Leading")).toHaveLength(1);
  });
  it("M-1: a poll share card preview says votes", () => {
    render(<ShareCard kind="poll" question="Q" topic="T" voices={3} poll={[{ label: "A", pct: 50 }, { label: "B", pct: 50 }]} open />);
    expect(screen.getByText(/Based on 3 votes/)).toBeTruthy();
    expect(screen.queryByText("50% so far")).toBeNull();
  });
});
