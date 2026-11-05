"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon, IconButton, Sheet, Switch as VxSwitch, Tabs, TextField } from "@/components/vx";
import { signOut } from "@/lib/api/auth";
import {
  deleteAccount, getExport, getFollowedCategories, listBlocks, listCategories, requestExport, setFollowedCategories, unblockUser, updateSettings,
  type BlockedUser, type Category, type CategoryFollow, type DataExport, type Me, type Settings,
} from "@/lib/api/profile";
import { DELETE_WORDS, DeletionPending } from "./DeletionPending";
import { LoadError, LoadingBlock, NeedsProfileNotice, Section, SignedOutNotice, errorLine } from "./states";
import { minuteLabel } from "./format";
import { applyTheme, type ThemeChoice } from "./theme";
import { useMe } from "./useMe";
import "./profile.css";

function Switch({ label, detail, checked, onChange, disabled }: { label: string; detail?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="pf-row-item">
      <span className="pf-row-item__txt"><b>{label}</b>{detail ? <span>{detail}</span> : null}</span>
      <VxSwitch checked={checked} disabled={disabled} onChange={onChange} />
    </label>
  );
}

function RowButton({ icon, label, detail, onClick, danger, trailing }: { icon?: Parameters<typeof Icon>[0]["name"]; label: string; detail?: string; onClick: () => void; danger?: boolean; trailing?: ReactNode }) {
  return (
    <button type="button" className={"pf-row-item pf-row-item--btn" + (danger ? " is-danger" : "")} onClick={onClick}>
      {icon ? <Icon name={icon} size={22} /> : null}
      <span className="pf-row-item__txt"><b>{label}</b>{detail ? <span>{detail}</span> : null}</span>
      {trailing ?? <Icon name="chevron-right" size={20} />}
    </button>
  );
}

function CategoryAlertsSheet({ settings, patch, onClose }: { settings: Settings; patch: (p: Partial<Settings>) => void; onClose: () => void }) {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [follows, setFollows] = useState<CategoryFollow[]>([]);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    Promise.all([listCategories(), getFollowedCategories()]).then(([c, f]) => { setCats(c.items); setFollows(f.categories); }, setError);
  }, []);
  async function flip(id: string, on: boolean) {
    const next = follows.map((f) => (f.categoryId === id ? { ...f, alertsOn: on } : f));
    setFollows(next);
    try { await setFollowedCategories(next); } catch (e) { setFollows(follows); setError(e); }
  }
  return (
    <Sheet title="Category alerts" subtitle="We alert you when a new question lands in a topic you follow." onClose={onClose}>
      <div className="pf-card">
        <Switch label="Category alerts" checked={settings.notifyCategoryAlerts} onChange={(v) => patch({ notifyCategoryAlerts: v })} />
        {!cats && !error ? <LoadingBlock rows={1} /> : null}
        {follows.map((f) => {
          const c = cats?.find((x) => x.id === f.categoryId);
          return c ? <Switch key={f.categoryId} label={c.name} checked={f.alertsOn} onChange={(v) => flip(f.categoryId, v)} /> : null;
        })}
      </div>
      {follows.length === 0 && cats ? <p className="pf-hint">Follow topics from Edit profile to get alerts for them.</p> : null}
      {error ? <p className="pf-note pf-note--err" role="alert">{errorLine(error)}</p> : null}
    </Sheet>
  );
}

function BlockedSheet({ onClose, onCount }: { onClose: () => void; onCount: (n: number) => void }) {
  const [items, setItems] = useState<BlockedUser[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const load = useCallback(() => { listBlocks().then((p) => { setItems(p.items); onCount(p.items.length); }, setError); }, [onCount]);
  useEffect(() => { load(); }, [load]);
  async function unblock(id: string) {
    try { await unblockUser(id); setItems((cur) => { const n = (cur ?? []).filter((b) => b.user.id !== id); onCount(n.length); return n; }); } catch (e) { setError(e); }
  }
  return (
    <Sheet title="Blocked accounts" subtitle="Blocking hides you and them from each other." onClose={onClose}>
      {!items && !error ? <LoadingBlock rows={1} /> : null}
      {items && items.length === 0 ? <p className="pf-body">You have not blocked anyone.</p> : null}
      {items?.map((b) => (
        <div key={b.user.id} className="pf-row-item">
          <Link href={`/p/${b.user.id}`} className="pf-row-item__txt" onClick={onClose}><b>{"@" + b.user.handle}</b></Link>
          <Button size="s" variant="secondary" onClick={() => unblock(b.user.id)}>{"Unblock @" + b.user.handle}</Button>
        </div>
      ))}
      {error ? <p className="pf-note pf-note--err" role="alert">{errorLine(error)}</p> : null}
    </Sheet>
  );
}

function ExportRow() {
  const [exp, setExp] = useState<DataExport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const poll = useCallback((tries: number) => {
    getExport().then((e) => {
      setExp(e);
      if (e.status === "PENDING" && tries > 0) timer.current = setTimeout(() => poll(tries - 1), 2000);
      else setBusy(false);
    }, (e) => { setError(errorLine(e)); setBusy(false); });
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function start() {
    setBusy(true); setError(null);
    try { const e = await requestExport(); setExp(e); if (e.status === "PENDING") poll(30); else setBusy(false); } catch (e) { setError(errorLine(e)); setBusy(false); }
  }
  const ready = exp?.status === "READY" && exp.downloadUrl;
  return (
    <>
      <RowButton icon="file-down" label="Export my data" detail={busy ? "Getting your data ready..." : "Your posts, transcripts and Voice Units history"} onClick={start} trailing={<span />} />
      {ready ? <a className="pf-row-item pf-dl" href={exp.downloadUrl!} download>Download my data</a> : null}
      {error ? <p className="pf-note pf-note--err pf-pad" role="alert">{error}</p> : null}
    </>
  );
}

function DeleteSheet({ me, onClose, onDone }: { me: Me; onClose: () => void; onDone: () => void }) {
  const [typed, setTyped] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handle = me.handle ?? "";
  const match = typed.trim().replace(/^@/, "").toLowerCase() === handle;
  async function go() {
    setBusy(true); setError(null);
    try { await deleteAccount(handle, true); onDone(); } catch (e) { setError(errorLine(e)); setBusy(false); }
  }
  return (
    <Sheet title="Delete your account?" onClose={onClose}>
      <div className="pf-menu">
        <p className="pf-body">{DELETE_WORDS.grace}</p>
        <p className="pf-body"><b>{DELETE_WORDS.lost}</b></p>
        <p className="pf-body">{DELETE_WORDS.keep}</p>
        <label className="pf-radio"><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />I understand my unspent Voice Units will be lost.</label>
        <TextField label={`Type @${handle} to confirm`} value={typed} onChange={setTyped} autoComplete="off" />
        {error ? <p className="pf-note pf-note--err" role="alert">{error}</p> : null}
        <Button variant="destructive" block loading={busy} disabled={!ok || !match} onClick={go}>Delete my account</Button>
        <Button variant="secondary" block onClick={onClose}>Keep my account</Button>
      </div>
    </Sheet>
  );
}

function SettingsBody({ me }: { me: Me }) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(me.settings);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | "cats" | "blocked" | "delete">(null);
  const [blockedCount, setBlockedCount] = useState<number | null>(null);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => { applyTheme(me.settings.theme); }, [me.settings.theme]);
  useEffect(() => { listBlocks().then((p) => setBlockedCount(p.items.length + (p.nextCursor ? 1 : 0)), () => setBlockedCount(null)); }, []);

  async function patch(p: Partial<Settings>) {
    const before = s;
    setS({ ...s, ...p });
    if (p.theme) applyTheme(p.theme);
    setError(null);
    try { setS(await updateSettings(p)); } catch (e) { setS(before); if (p.theme) applyTheme(before.theme); setError(errorLine(e, "Could not save that change. Try again.")); }
  }

  if (deleted) return <DeletionPending />;
  return (
    <div className="pf-page">
      <header className="pf-bar">
        <IconButton icon="arrow-left" label="Back to profile" variant="ghost" onClick={() => router.push("/profile")} />
        <h1 className="pf-h1 pf-bar__h1">Settings</h1>
        <span className="pf-bar__sp pf-only-desk" />
        <span className="pf-signed pf-only-desk">{`Signed in as @${me.handle}`}</span>
        <Button className="pf-only-desk" variant="secondary" onClick={() => { signOut(); router.push("/"); }}>Sign out</Button>
      </header>
      {error ? <p className="pf-note pf-note--err" role="alert">{error}</p> : null}

      <Section id="n-h" title="Notifications">
        <div className="pf-card">
          <Switch label="Today's question" detail={`Every morning at ${minuteLabel(s.dailyQuestionMinute)}`} checked={s.notifyDailyQuestion} onChange={(v) => patch({ notifyDailyQuestion: v })} />
          <Switch label="Replies to you" checked={s.notifyReplies} onChange={(v) => patch({ notifyReplies: v })} />
          <Switch label="Reactions on your voices" detail="Grouped, never one by one" checked={s.notifyReactions} onChange={(v) => patch({ notifyReactions: v })} />
          <Switch label="Poll results" checked={s.notifyPollResults} onChange={(v) => patch({ notifyPollResults: v })} />
          <Switch label="Flash polls" checked={s.notifyFlashPolls} onChange={(v) => patch({ notifyFlashPolls: v })} />
          <RowButton label="Category alerts" onClick={() => setSheet("cats")} />
        </div>
      </Section>

      <Section id="a-h" title="App">
        <div className="pf-card">
          <Switch label="Data saver" detail="Voices play only when you tap, in lighter quality" checked={s.dataSaver} onChange={(v) => patch({ dataSaver: v })} />
          <div className="pf-appearance">
            <span className="pf-appearance__t"><Icon name="moon" size={22} />Appearance</span>
            <Tabs label="Appearance" variant="segmented" block value={s.theme} onChange={(v) => patch({ theme: v as ThemeChoice })}
              items={[{ id: "light", label: "Light", icon: "sun" }, { id: "dark", label: "Dark", icon: "moon" }, { id: "system", label: "System" }]} />
          </div>
        </div>
      </Section>

      <Section id="ad-h" title="Ads and privacy">
        <div className="pf-card">
          <RowButton icon="shield-alert" label="Blocked accounts" detail={blockedCount === null ? undefined : String(blockedCount)} onClick={() => setSheet("blocked")} />
        </div>
      </Section>

      <Section id="l-h" title="Help and legal">
        <div className="pf-card">
          <Link href="/settings/legal/rules" className="pf-row-item pf-row-item--btn"><span className="pf-row-item__txt"><b>Community rules</b></span><Icon name="chevron-right" size={20} /></Link>
        </div>
      </Section>

      <Section id="d-h" title="Your data">
        <div className="pf-card">
          <ExportRow />
          <RowButton icon="trash-2" label="Delete account" danger onClick={() => setSheet("delete")} />
        </div>
      </Section>

      <Button className="pf-only-phone" variant="secondary" block onClick={() => { signOut(); router.push("/"); }}>Sign out</Button>
      <p className="pf-signed pf-only-phone">{`Signed in as @${me.handle}${me.phoneMasked ? " · " + me.phoneMasked : ""}`}</p>

      {sheet === "cats" ? <CategoryAlertsSheet settings={s} patch={patch} onClose={() => setSheet(null)} /> : null}
      {sheet === "blocked" ? <BlockedSheet onClose={() => setSheet(null)} onCount={setBlockedCount} /> : null}
      {sheet === "delete" ? <DeleteSheet me={me} onClose={() => setSheet(null)} onDone={() => { setSheet(null); setDeleted(true); }} /> : null}
    </div>
  );
}

export function SettingsPage() {
  const { state, reload } = useMe();
  if (state.status === "loading") return <div className="pf-page"><h1 className="pf-h1">Settings</h1><LoadingBlock /></div>;
  if (state.status === "guest") return <div className="pf-page"><h1 className="pf-h1">Settings</h1><SignedOutNotice what="your settings" /></div>;
  if (state.status === "error") return <div className="pf-page"><h1 className="pf-h1">Settings</h1><LoadError error={state.error} onRetry={reload} /></div>;
  if (state.status === "needs-profile") return <div className="pf-page"><h1 className="pf-h1">Settings</h1><NeedsProfileNotice /></div>;
  if (state.me.status === "DELETION_PENDING") return <DeletionPending />;
  return <SettingsBody me={state.me} />;
}
