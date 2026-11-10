// @vitest-environment jsdom
// Bundle H, H1: typing a query on /search and pressing Enter (a soft navigation) never renders a result that is not there.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let qs = "";
let rerenderApp: () => void = () => undefined;
const push = vi.fn((href: string) => {
  qs = href.split("?")[1] ?? "";
  rerenderApp();
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/search",
  useSearchParams: () => new URLSearchParams(qs),
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => <a href={href} {...r}>{children}</a> }));

import { SearchScreen } from "@/components/feed/SearchScreen";
import { ShellSlotsContext } from "@/components/shell/ShellSlots";

function App() {
  const barEl = document.getElementById("bar") as HTMLElement;
  const railEl = document.getElementById("rail") as HTMLElement;
  return (
    <ShellSlotsContext.Provider value={{ barEl, railEl, claimBar: () => () => undefined, hideTabs: () => () => undefined }}>
      <SearchScreen />
    </ShellSlotsContext.Provider>
  );
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const RESULT = {
  totals: { questions: 1, voices: 0, people: 0 },
  questions: [{ id: "q1", text: "Are prices fair where you live?", voiceCount: 3, voicesCount: 3, endsAt: null, status: "OPEN", category: null, proposalCount: 0 }],
  answers: [],
  people: [],
};

beforeEach(() => {
  qs = "";
  document.body.innerHTML = '<div id="bar"></div><div id="rail"></div>';
  push.mockClear();
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const u = String(input);
    if (u.includes("/search")) return json(RESULT);
    if (u.includes("/questions/trending")) return json({ items: [] });
    return new Response("{}", { status: 404, headers: { "content-type": "application/json" } });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("H1 search submit", () => {
  it("types a query and submits: results show, nothing throws", async () => {
    const errors: unknown[] = [];
    const onErr = (e: ErrorEvent) => errors.push(e.error);
    window.addEventListener("error", onErr);
    const view = render(<App />);
    rerenderApp = () => view.rerender(<App />);
    await waitFor(() => expect(screen.getByText("Type at least 2 letters to find questions, voices and people.")).toBeTruthy());
    // wait for the empty-state load to settle, as a person would
    await new Promise((r) => setTimeout(r, 30));
    const box = screen.getByPlaceholderText("Search questions, voices and handles");
    await userEvent.type(box, "prices{enter}");
    expect(push).toHaveBeenCalledWith("/search?q=prices");
    await waitFor(() => expect(screen.getByText("Are prices fair where you live?")).toBeTruthy());
    expect(errors).toEqual([]);
    window.removeEventListener("error", onErr);
  });
});

describe("H1 useLoad never hands back another query's result", () => {
  it("on the render right after its inputs change the answer is loading, not the old data", async () => {
    const { renderHook } = await import("@testing-library/react");
    const { useLoad } = await import("@/components/feed/useLoad");
    const seen: string[] = [];
    const { rerender } = renderHook(
      ({ q }: { q: string }) => {
        const r = useLoad(async () => q, [q]);
        seen.push(`${q}:${r.state}${r.state === "ready" ? `:${r.data}` : ""}`);
        return r;
      },
      { initialProps: { q: "a" } },
    );
    await waitFor(() => expect(seen).toContain("a:ready:a"));
    seen.length = 0;
    rerender({ q: "b" });
    // the first render with q = b must not be ready with a's data
    expect(seen[0]).toBe("b:loading");
    await waitFor(() => expect(seen).toContain("b:ready:b"));
    expect(seen).not.toContain("b:ready:a");
  });
});
