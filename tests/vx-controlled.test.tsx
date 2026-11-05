// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnswerCard, Composer, Poll, ProposalCard, Switch, AdSlot, WeeklyReportCard } from "@/components/vx";

afterEach(cleanup);
const author = { handle: "@a", name: "A" };

describe("vx controlled props", () => {
  it("Poll: onConfirm gets the option, closed says so, 1 vote is singular", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onSelect = vi.fn();
    const { rerender } = render(<Poll question="Q?" options={[{ id: "a", label: "Yes", votes: 1 }, { id: "b", label: "No", votes: 0 }]} selected="a" onSelect={onSelect} onConfirm={onConfirm} voted={false} />);
    fireEvent.click(screen.getByText("No"));
    expect(onSelect).toHaveBeenCalledWith("b");
    fireEvent.click(screen.getByText("Vote"));
    fireEvent.click(screen.getByText("Confirm vote"));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("a"));
    expect(screen.queryByText("1 vote")).toBeNull();
    rerender(<Poll question="Q?" closed voted options={[{ id: "a", label: "Yes", votes: 1 }]} selected="a" onSelect={onSelect} />);
    expect(screen.getByText("Poll closed")).toBeTruthy();
    expect(screen.queryByText("Open poll")).toBeNull();
    expect(screen.getAllByText("1 vote").length).toBeGreaterThan(0);
  });
  it("AnswerCard: controlled like and react ask, never self-toggle; 1 reaction is singular", () => {
    const onLike = vi.fn();
    const onReact = vi.fn();
    const onTray = vi.fn();
    render(<AnswerCard author={author} time="1m" text="hi" liked={false} likeCount={2} onLike={onLike} reaction={null} onReact={onReact} trayOpen onTrayChange={onTray} reactionCounts={{ Powerful: 1 }} />);
    fireEvent.click(screen.getByLabelText("Like, 2 likes"));
    expect(onLike).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText("Like, 2 likes").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("1 reaction")).toBeTruthy();
    fireEvent.click(screen.getByText("Powerful", { selector: "span" }));
    expect(onReact).toHaveBeenCalledWith("Powerful");
    expect(onTray).toHaveBeenCalledWith(false);
  });
  it("Composer: controlled value, onSubmit, meter off", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(<Composer value="abc" onChange={onChange} onSubmit={onSubmit} meter={false} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abcd" } });
    expect(onChange).toHaveBeenCalledWith("abcd");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("abc");
    fireEvent.click(screen.getByText("Post"));
    expect(onSubmit).toHaveBeenCalledWith("abc");
    expect(document.querySelector(".vx-free")).toBeNull();
  });
  it("ProposalCard stance, Switch, AdSlot onWhy false, Weekly share and hidden PDF", () => {
    const sup = vi.fn();
    const sw = vi.fn();
    const open = vi.fn();
    const share = vi.fn();
    render(
      <>
        <ProposalCard author="x" time="1m" text="t" supports={3} stance="support" onSupport={sup} />
        <Switch checked={false} onChange={sw} label="S" />
        <AdSlot brand="B" headline="H" onWhy={false} cta={false} />
        <AdSlot variant="banner" brand="B2" headline="H2" onOpen={open} />
        <WeeklyReportCard week="w" moodLine="m" mood={[]} themes={[]} voices={1} votes={1} onShare={share} />
      </>,
    );
    expect(screen.getByText("Support").closest("button")?.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByText("Support"));
    expect(sup).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("switch"));
    expect(sw).toHaveBeenCalledWith(true);
    expect(screen.queryByText("Why this ad?")).toBeNull();
    fireEvent.click(screen.getByText("Open"));
    expect(open).toHaveBeenCalled();
    fireEvent.click(screen.getByText("Share"));
    expect(share).toHaveBeenCalled();
    expect(screen.queryByText("Download PDF")).toBeNull();
  });
});
