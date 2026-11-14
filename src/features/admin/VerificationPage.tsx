"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, EmptyState, Icon, Tabs, TextField } from "@/components/vx";
import { approveVerification, getVerification, listVerification, openVerificationDocument, rejectVerification } from "@/lib/api/verify";
import type { AdminVerification, AdminVerificationItem, RejectReasonCode, VerificationDocumentLink } from "@/lib/api/verify";
import { ago, clock } from "./time";
import { Card, CardTitle, ErrorLine, Eyebrow, Gated, ListSkeleton, LoadFailed, PageHead, Pill, SavedLine, DetailPane, queueRow, refusalWords, useAction } from "./ui";

/** The short reasons an admin picks from. The person reads the words in `person`, then the admin's own note. */
export const REASONS: { code: RejectReasonCode; label: string; person: string }[] = [
  { code: "ID_UNREADABLE", label: "ID not readable", person: "We could not read your ID. Upload a clear, full photo or scan." },
  { code: "ID_NOT_VALID", label: "Not a valid ID", person: "That is not a valid government ID. Use a national ID card, passport, driver's licence or voter's card." },
  { code: "ID_EXPIRED", label: "ID expired", person: "Your ID has expired. Upload one that is still valid." },
  { code: "BILL_UNREADABLE", label: "Bill not readable", person: "We could not read your utility bill. Upload a clear, full photo or scan." },
  { code: "BILL_TOO_OLD", label: "Bill too old", person: "Your utility bill is too old. Upload one from the last 3 months." },
  { code: "DETAILS_DO_NOT_MATCH", label: "Names do not match", person: "The name on your documents does not match. Both must show the same name." },
  { code: "SUBSCRIPTION_ENDED", label: "Subscription ended", person: "Your subscription ended before we could check your documents. Subscribe again and send them again." },
  { code: "OTHER", label: "Something else (write why)", person: "We could not approve your documents." },
];

function Doc({ requestId, kind, title, info }: { requestId: string; kind: "id" | "bill"; title: string; info: { mime: string } | null }) {
  const [link, setLink] = useState<VerificationDocumentLink | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!info) return null;
  async function open() {
    setBusy(true);
    setErr(null);
    try {
      setLink(await openVerificationDocument(requestId, kind));
    } catch (e) {
      setErr(refusalWords(e));
    } finally {
      setBusy(false);
    }
  }
  const isPdf = info.mime === "application/pdf";
  return (
    <figure className="m-0 flex flex-col gap-2 rounded-l border border-line p-3" data-testid="doc">
      <figcaption className="text-label">{title}</figcaption>
      {!link ? (
        <div>
          <Button variant="secondary" size="s" loading={busy} onClick={() => void open()}>{`Show the ${title.toLowerCase()}`}</Button>
        </div>
      ) : isPdf ? (
        <a className="link inline-flex items-center gap-2" href={link.url} target="_blank" rel="noopener noreferrer">
          <Icon name="link" size={18} />
          Open the PDF
        </a>
      ) : (
        <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`Open the ${title.toLowerCase()} full size`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={link.url} alt={title} className="max-h-[360px] w-full rounded-m bg-surface-2 object-contain" referrerPolicy="no-referrer" />
        </a>
      )}
      {link ? (
        <p className="m-0 text-caption text-ink-2">This link stops working after 5 minutes.{" "}
          <button type="button" className="link cursor-pointer border-0 bg-transparent p-0" onClick={() => void open()}>Get a new link</button>
        </p>
      ) : null}
      <ErrorLine>{err}</ErrorLine>
    </figure>
  );
}

function Decide({ item, onDone }: { item: AdminVerificationItem; onDone: (word: string) => void }) {
  const [detail, setDetail] = useState<AdminVerification | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [reject, setReject] = useState(false);
  const [code, setCode] = useState<RejectReasonCode | "">("");
  const [note, setNote] = useState("");
  const act = useAction();
  const seq = useRef(0);
  const pending = item.status === "PENDING";

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoadError(null);
    try {
      const d = await getVerification(item.id);
      if (my === seq.current) setDetail(d);
    } catch (e) {
      if (my === seq.current) setLoadError(e as Error);
    }
  }, [item.id]);
  useEffect(() => {
    void load();
  }, [load]);

  const needNote = code === "OTHER";
  const ready = code !== "" && (!needNote || note.trim().length > 0);

  async function approve() {
    const ok = await act.run(async () => {
      await approveVerification(item.id);
      return true;
    });
    if (ok) onDone("Approved. The person is verified and has been emailed.");
  }
  async function doReject() {
    if (code === "") return;
    const ok = await act.run(async () => {
      await rejectVerification(item.id, { reasonCode: code, note: note.trim() || undefined });
      return true;
    });
    if (ok) onDone("Rejected. The person has been emailed the reason.");
  }

  return (
    <Card>
      <CardTitle>Check the documents</CardTitle>
      <div className="flex items-center gap-3">
        <Avatar name={item.person.displayName || item.person.handle} size="m" />
        <div>
          <div className="text-body-strong">{item.person.displayName || item.person.handle}</div>
          <div className="text-caption text-ink-2">{`@${item.person.handle}`}</div>
        </div>
      </div>
      <dl className="m-0 mt-4 flex flex-col text-body">
        <div className="flex justify-between gap-3 border-b border-line py-2">
          <dt className="text-ink-2">Plan</dt>
          <dd className="m-0 text-body-strong">{item.subscription ? item.subscription.planName : "No running plan"}</dd>
        </div>
        <div className="flex justify-between gap-3 border-b border-line py-2">
          <dt className="text-ink-2">Plan ends</dt>
          <dd className="m-0 text-body-strong">{item.subscription ? item.subscription.endLabel : "-"}</dd>
        </div>
        <div className="flex justify-between gap-3 py-2">
          <dt className="text-ink-2">Sent</dt>
          <dd className="m-0 text-body-strong">{item.submittedAt ? `${clock(item.submittedAt)}` : "-"}</dd>
        </div>
      </dl>

      {loadError ? <LoadFailed error={loadError} retry={load} /> : null}
      {detail ? (
        detail.documentsDeleted ? (
          <p className="m-0 mt-4 text-caption text-ink-2">The documents were deleted 90 days after the decision, or when the account was deleted.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <Doc requestId={item.id} kind="id" title="Government ID" info={detail.idDocument} />
            <Doc requestId={item.id} kind="bill" title="Utility bill" info={detail.billDocument} />
          </div>
        )
      ) : !loadError ? (
        <div className="mt-4"><ListSkeleton rows={1} /></div>
      ) : null}

      {!pending ? (
        <div className="mt-4">
          <Pill tone={item.status === "APPROVED" ? "green" : "red"}>{item.status === "APPROVED" ? "Approved" : "Rejected"}</Pill>
          <p className="m-0 mt-2 text-caption text-ink-2">{`${item.decidedBy ? `By @${item.decidedBy}` : "Decided"}${item.decidedAt ? `, ${clock(item.decidedAt)}` : ""}${item.reason ? `. ${item.reason}` : ""}`}</p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {reject ? (
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-2 text-label">Why? The person reads this.</legend>
              {REASONS.map((r) => (
                <label key={r.code} className="flex cursor-pointer items-center gap-3 rounded-m bg-surface-2 px-3 py-2 text-body">
                  <input type="radio" name="reason" value={r.code} checked={code === r.code} onChange={() => setCode(r.code)} />
                  <span className="flex flex-col">
                    <span>{r.label}</span>
                    {r.person ? <span className="text-caption text-ink-2">{r.person}</span> : null}
                  </span>
                </label>
              ))}
              <TextField label={needNote ? "Say why (needed)" : "More words for the person (optional)"} multiline value={note} onChange={setNote} hint="Shown after the short reason. Plain words, no dashes." />
            </fieldset>
          ) : null}
          <ErrorLine>{act.error}</ErrorLine>
          <div className="flex flex-wrap items-center gap-3">
            {reject ? (
              <>
                <Button variant="destructive" loading={act.busy} disabled={!ready || act.busy} onClick={() => void doReject()}>Reject and tell them</Button>
                <Button variant="ghost" disabled={act.busy} onClick={() => setReject(false)}>Back</Button>
              </>
            ) : (
              <>
                <Button icon="check" loading={act.busy} disabled={act.busy || !detail || detail.documentsDeleted} onClick={() => void approve()}>Approve</Button>
                <Button variant="secondary" disabled={act.busy} onClick={() => setReject(true)}>Reject</Button>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function Body() {
  const [tab, setTab] = useState<"pending" | "decided">("pending");
  const [items, setItems] = useState<AdminVerificationItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [paneOpen, setPaneOpen] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setItems(null);
    setError(null);
    try {
      const p = await listVerification({ status: tab });
      if (my !== seq.current) return;
      setItems(p.items);
      setNext(p.nextCursor);
      setSelected(p.items[0]?.id ?? null);
    } catch (e) {
      if (my === seq.current) setError(e as Error);
    }
  }, [tab]);
  useEffect(() => {
    void load();
  }, [load]);

  const it = items?.find((i) => i.id === selected) ?? null;

  async function more() {
    if (!next) return;
    const p = await listVerification({ status: tab, cursor: next });
    setItems((x) => [...(x ?? []), ...p.items]);
    setNext(p.nextCursor);
  }
  function decided(id: string, word: string) {
    setSaved(word);
    setPaneOpen(false);
    setItems((x) => {
      const rest = (x ?? []).filter((i) => i.id !== id);
      const at = (x ?? []).findIndex((i) => i.id === id);
      setSelected(rest[Math.min(at, rest.length - 1)]?.id ?? null);
      return rest;
    });
  }

  return (
    <div>
      <PageHead eyebrow="Identity" title="Verification" sub="Check the ID and the utility bill. Oldest first. Both files are deleted 90 days after you decide." />
      <div className="mb-5">
        <Tabs label="Verification queues" items={[{ id: "pending", label: "Waiting" }, { id: "decided", label: "Decided" }]} value={tab} onChange={(id) => { setSaved(null); setTab(id as "pending" | "decided"); }} />
      </div>
      {saved ? <div className="mb-4"><SavedLine>{saved}</SavedLine></div> : null}
      {error ? (
        <LoadFailed error={error} retry={load} />
      ) : items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon="shield-check" title={tab === "pending" ? "Nothing is waiting" : "No decisions yet"} body={tab === "pending" ? "New requests from subscribers land here." : "Every decision will be listed here."} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-5 dt:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-xl border border-line bg-surface" role="list" aria-label="Queue">
            {items.map((i) => (
              <button key={i.id} type="button" role="listitem" className={queueRow(selected === i.id)} onClick={() => { setSelected(i.id); setPaneOpen(true); }} aria-current={selected === i.id ? "true" : undefined}>
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-body-strong">{i.person.displayName || i.person.handle}</b>
                  <span className="text-caption text-ink-2">{`@${i.person.handle}`}</span>
                </span>
                <span className="mt-1 block text-caption text-ink-2">
                  {i.subscription ? `${i.subscription.planName} until ${i.subscription.endLabel}` : "No running plan"}
                  {i.status === "PENDING" && i.submittedAt ? ` · sent ${ago(i.submittedAt)} ago` : ""}
                  {i.status !== "PENDING" ? ` · ${i.status === "APPROVED" ? "approved" : "rejected"}` : ""}
                </span>
              </button>
            ))}
            {next ? <div className="p-3 text-center"><Button variant="ghost" onClick={() => void more()}>Show more</Button></div> : null}
          </div>
          <DetailPane open={paneOpen} onClose={() => setPaneOpen(false)}>{it ? <Decide key={it.id} item={it} onDone={(w) => decided(it.id, w)} /> : null}</DetailPane>
        </div>
      )}
      <Eyebrow className="mt-6">Only admins can open this page.</Eyebrow>
    </div>
  );
}

export function AdminVerificationPage() {
  return (
    <Gated page="verification">
      <Body />
    </Gated>
  );
}
