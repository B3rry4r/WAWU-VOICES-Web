"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, TopicChip } from "@/components/vx";
import { getCategories } from "@/lib/api/feed";
import { apiFetch } from "@/lib/api/client";
import { Failed, Loading } from "./parts";
import { useLoad } from "./useLoad";

const MIN = 3;

/** Pick topics (step 1 of 2): at least 3, with an alerts switch per chosen topic. Saved with PUT /me/categories. */
export function TopicsScreen() {
  const router = useRouter();
  const load = useLoad(getCategories, []);
  const [chosen, setChosen] = useState<string[]>([]);
  const [alerts, setAlerts] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (load.state === "loading") return <Loading />;
  if (load.state === "error") return <Failed load={load} />;
  const cats = load.data.items;
  const toggle = (id: string, on: boolean) => setChosen((c) => (on ? [...c, id] : c.filter((x) => x !== id)));
  const ok = chosen.length >= MIN;
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch("/me/categories", { method: "PUT", authed: true, body: { categories: chosen.map((categoryId) => ({ categoryId, alertsOn: alerts[categoryId] ?? true })) } });
      router.push("/join/profile");
    } catch {
      setErr("We could not save your topics. Try again.");
      setBusy(false);
    }
  };
  return (
    <>
      <div className="flex items-center justify-between">
        <Link href="/join/verify" className="text-[14px] font-semibold no-underline" aria-label="Back">Back</Link>
        <span aria-label="Step 1 of 2" className="text-[14px] text-[var(--ink-2)]">1 of 2</span>
      </div>
      <h1 className="m-0 mt-4 font-display text-[28px] font-normal leading-8">What do you want to talk about?</h1>
      <p className="mt-2 text-[15px] text-[var(--ink-2)]">Pick at least 3. We use them to fill your Home. Today&apos;s question shows for everyone.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Topics">
        {cats.map((c) => (
          <TopicChip key={c.id} label={c.name} selected={chosen.includes(c.id)} onClick={(on) => toggle(c.id, on)} />
        ))}
      </div>
      {chosen.length ? (
        <section className="mt-6">
          <h2 className="font-display text-[18px] font-normal">Category alerts</h2>
          <p className="mt-1 text-[14px] text-[var(--ink-2)]">Get told when a new question lands in a topic you picked.</p>
          <ul className="m-0 mt-2 grid list-none gap-2 p-0">
            {cats.filter((c) => chosen.includes(c.id)).map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-3">
                <span>{c.name}</span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={`Alerts for ${c.name}`}
                  checked={alerts[c.id] ?? true}
                  onChange={(e) => setAlerts({ ...alerts, [c.id]: e.target.checked })}
                />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-[var(--ink-2)]">Change or turn off alerts any time in Settings.</p>
        </section>
      ) : null}
      {err ? <p role="alert" className="mt-3 text-[14px] text-[var(--danger)]">{err}</p> : null}
      <div className="mt-6">
        <Button variant="primary" size="l" block disabled={!ok || busy} onClick={save}>
          {ok ? `Continue with ${chosen.length} topics` : `Pick ${MIN - chosen.length} more`}
        </Button>
      </div>
    </>
  );
}
