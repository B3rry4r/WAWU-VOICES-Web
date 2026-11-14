// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const recordShareEvent = vi.fn((..._a: unknown[]) => Promise.resolve());
vi.mock("@/lib/api/reach", () => ({ recordShareEvent: (...a: unknown[]) => recordShareEvent(...a) }));
vi.mock("@/lib/api/auth", () => ({ isSignedIn: () => false }));

import { noteRecordingStarted, notePublished, rememberShareVisit } from "@/features/share/share-visit";
import { LinkOpened } from "@/features/share/ShareActions";

beforeEach(() => { window.sessionStorage.clear(); recordShareEvent.mockClear(); });
afterEach(cleanup);

describe("V-FIX-D: recording_started and published_from_link, once each, only after a share link", () => {
  it("sends nothing in a visit that did not come by a share link", () => {
    noteRecordingStarted();
    notePublished();
    expect(recordShareEvent).not.toHaveBeenCalled();
  });

  it("the recorder starting sends recording_started once; a second start in the same visit sends nothing", () => {
    rememberShareVisit("abc1234");
    noteRecordingStarted();
    noteRecordingStarted();
    expect(recordShareEvent.mock.calls).toEqual([["abc1234", "recording_started"]]);
  });

  it("the first post sends published_from_link once", () => {
    rememberShareVisit("abc1234");
    noteRecordingStarted();
    notePublished();
    notePublished();
    expect(recordShareEvent.mock.calls).toEqual([["abc1234", "recording_started"], ["abc1234", "published_from_link"]]);
  });

  it("opening the share page remembers the link for the tab (a /speak page reached later still counts)", () => {
    render(<LinkOpened code="xyz9876" />);
    recordShareEvent.mockClear();
    noteRecordingStarted();
    expect(recordShareEvent.mock.calls).toEqual([["xyz9876", "recording_started"]]);
  });

  it("a code of the wrong shape is never kept, and a visit keeps its first link until it has published", () => {
    rememberShareVisit("not a code");
    noteRecordingStarted();
    expect(recordShareEvent).not.toHaveBeenCalled();
    rememberShareVisit("first111");
    rememberShareVisit("abc1234");
    rememberShareVisit("second2");
    noteRecordingStarted();
    expect(recordShareEvent.mock.calls).toEqual([["abc1234", "recording_started"]]);
  });

  it("blocked storage sends nothing and throws nothing", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => { rememberShareVisit("abc1234"); noteRecordingStarted(); notePublished(); }).not.toThrow();
    expect(recordShareEvent).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
