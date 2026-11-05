// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act, type ReactElement } from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/discover",
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));
// Never resolves: the screens stay in their first render, which is what must match the server's.
vi.mock("@/lib/api/client", () => ({ apiFetch: () => new Promise(() => {}), ApiError: class extends Error {} }));

import { AppShell } from "@/components/shell/AppShell";
import { DiscoverScreen } from "@/components/feed/DiscoverScreen";
import { PersonPage } from "@/features/profile/PersonPage";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { cleanup(); window.localStorage.clear(); document.body.innerHTML = ""; });

/** Server HTML is made for a guest (the server has no browser storage); then a signed-in person hydrates it. */
async function hydrateSignedIn(el: () => ReactElement) {
  window.localStorage.clear();
  const html = renderToString(el());
  window.localStorage.setItem("voices-web-session", JSON.stringify({ accessToken: "t", refreshToken: "r" }));
  const box = document.createElement("div");
  box.innerHTML = html;
  document.body.appendChild(box);
  const errors: string[] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...a) => { errors.push(a.map(String).join(" ")); });
  await act(async () => { hydrateRoot(box, el(), { onRecoverableError: (e) => errors.push(String(e)) }); });
  spy.mockRestore();
  return errors;
}

describe("first client render matches the server render for a signed-in person (no React #423)", () => {
  it("the shell", async () => { expect(await hydrateSignedIn(() => <AppShell>x</AppShell>)).toEqual([]); });
  it("Discover", async () => { expect(await hydrateSignedIn(() => <DiscoverScreen />)).toEqual([]); });
  it("a person's page", async () => { expect(await hydrateSignedIn(() => <PersonPage segment="ada.okafor" />)).toEqual([]); });
});
