// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RecordingTimeCard } from "@/features/speak/parts";

afterEach(cleanup);
describe("the recording time card (V-46)", () => {
  it("shows the free-post length only while a free post is left", () => {
    const { unmount } = render(<RecordingTimeCard freeLeft={1} total={2} freeSeconds={60} offers={[]} />);
    expect(screen.getByText("Up to a minute")).toBeTruthy();
    unmount();
    render(<RecordingTimeCard freeLeft={0} total={2} freeSeconds={60} offers={[]} />);
    expect(screen.queryByText("Up to a minute")).toBeNull();
  });
});
