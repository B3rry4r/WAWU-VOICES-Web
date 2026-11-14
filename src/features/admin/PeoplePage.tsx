"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, TextField } from "@/components/vx";
import { findPeople, listStaff, setRoles } from "@/lib/api/admin";
import type { AdminRoleGrant, Role } from "@/lib/api/admin";
import { roleLine } from "./roles";
import { Card, CardTitle, ErrorLine, Eyebrow, ListSkeleton, LoadFailed, PageHead, Pill, SavedLine, useAction, Gated, queueRow } from "./ui";

const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: "EDITOR", label: "Editor", hint: "The calendar, the pool, news tags, results and the weekly report." },
  { id: "MODERATOR", label: "Moderator", hint: "The moderation queue, suspensions and What Next? groups." },
  { id: "AD_MANAGER", label: "Ad manager", hint: "Adverts." },
  { id: "ADMIN", label: "Admin", hint: "Everything, including this page." },
];

type Person = { id: string; handle: string; name?: string | null; roles: Role[] };

function PeopleBody() {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Person[] | null>(null);
  const [staff, setStaff] = useState<Person[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [selected, setSelected] = useState<Person | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const search = useAction();

  const loadStaff = useCallback(async () => {
    setError(null);
    try {
      const all: AdminRoleGrant[] = [];
      let cursor: string | null = null;
      do {
        const p = await listStaff(cursor);
        all.push(...p.items);
        cursor = p.nextCursor;
      } while (cursor && all.length < 200);
      setStaff(all.map((g) => ({ id: g.user.id, handle: g.user.handle, name: g.user.displayName, roles: g.roles })));
    } catch (e) {
      setError(e as Error);
    }
  }, []);
  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  async function find() {
    const term = q.trim();
    if (!term) return;
    setSaved(null);
    const r = await search.run(() => findPeople(term.replace(/^@/, "")));
    if (r) setFound(r.items.map((u) => ({ id: u.profile.id, handle: u.profile.handle, name: u.profile.displayName, roles: u.roles })));
  }

  return (
    <div>
      <PageHead eyebrow="Admin only" title="People and roles" sub="Give a person a role, or take it away. Every change is logged with your reason." />
      {saved ? (
        <div className="mb-4">
          <SavedLine>{saved}</SavedLine>
        </div>
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5">
        <div className="flex flex-col gap-5">
          <Card>
            <CardTitle>Find a person</CardTitle>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                void find();
              }}
            >
              <TextField label="Handle" value={q} onChange={setQ} placeholder="ada.okafor" hint="The handle they chose, with or without the @." />
              <ErrorLine>{search.error}</ErrorLine>
              <div>
                <Button type="submit" icon="search" loading={search.busy} disabled={!q.trim() || search.busy}>Find</Button>
              </div>
            </form>
            {found ? (
              found.length === 0 ? (
                <p className="m-0 mt-4 text-body text-ink-2">No one has that handle. They need to sign in and finish setup first.</p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-l border border-line" role="list" aria-label="People found">
                  {found.map((p) => (
                    <PersonRow key={p.id} p={p} on={selected?.id === p.id} onPick={() => { setSelected(p); setSaved(null); }} />
                  ))}
                </div>
              )
            ) : null}
          </Card>

          <Card>
            <CardTitle>People with a role</CardTitle>
            {error ? (
              <LoadFailed error={error} retry={loadStaff} />
            ) : staff === null ? (
              <ListSkeleton rows={2} />
            ) : staff.length === 0 ? (
              <p className="m-0 text-body text-ink-2">No one yet.</p>
            ) : (
              <div className="overflow-hidden rounded-l border border-line" role="list" aria-label="People with a role">
                {staff.map((p) => (
                  <PersonRow key={p.id} p={p} on={selected?.id === p.id} onPick={() => { setSelected(p); setSaved(null); }} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {selected ? (
          <Editor
            key={selected.id}
            p={selected}
            onSaved={(roles) => {
              setSaved(`Saved. @${selected.handle} is now ${roles.length ? roleLine(roles).toLowerCase() : "a person with no role"}.`);
              setSelected({ ...selected, roles });
              setFound((f) => f && f.map((x) => (x.id === selected.id ? { ...x, roles } : x)));
              void loadStaff();
            }}
          />
        ) : (
          <EmptyState icon="user-check" title="Pick a person" body="Find someone by handle, or pick one from the list." />
        )}
      </div>
    </div>
  );
}

function PersonRow({ p, on, onPick }: { p: Person; on: boolean; onPick: () => void }) {
  return (
    <button type="button" role="listitem" aria-current={on ? "true" : undefined} className={queueRow(on)} onClick={onPick}>
      <div className="text-body-strong">{p.name || `@${p.handle}`}</div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-ink-2">
        {`@${p.handle}`}
        {p.roles.length ? <Pill tone="green">{roleLine(p.roles)}</Pill> : <span>No role</span>}
      </div>
    </button>
  );
}

function Editor({ p, onSaved }: { p: Person; onSaved: (roles: Role[]) => void }) {
  const [roles, setR] = useState<Role[]>(p.roles);
  const [reason, setReason] = useState("");
  const act = useAction();
  const changed = [...roles].sort().join() !== [...p.roles].sort().join();
  const adds = roles.filter((r) => !p.roles.includes(r));
  const drops = p.roles.filter((r) => !roles.includes(r));
  async function save() {
    const out = await act.run(() => setRoles(p.id, roles, reason.trim()));
    if (out) {
      setReason("");
      onSaved(out.roles);
    }
  }
  return (
    <Card>
      <Eyebrow>{`@${p.handle}`}</Eyebrow>
      <h2 className="m-0 mt-1 font-display text-display-m">{p.name || `@${p.handle}`}</h2>
      <fieldset className="m-0 mt-4 border-0 p-0">
        <legend className="vx-eyebrow mb-2 text-ink-2">Roles</legend>
        {ROLES.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-start gap-3 border-t border-line py-3 first:border-t-0">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 flex-none"
              checked={roles.includes(r.id)}
              onChange={(e) => setR((o) => (e.target.checked ? [...o, r.id] : o.filter((x) => x !== r.id)))}
            />
            <span>
              <span className="block text-label text-ink">{r.label}</span>
              <span className="block text-caption text-ink-2">{r.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mt-4 flex flex-col gap-3">
        <TextField label="Why" multiline value={reason} onChange={setReason} maxLength={300} hint="Required. It goes in the log with your name." />
        {changed ? (
          <p className="m-0 text-caption text-ink-2" role="status">
            {[adds.length ? `Gives ${roleLine(adds).toLowerCase()}.` : "", drops.length ? `Takes away ${roleLine(drops).toLowerCase()}.` : ""].filter(Boolean).join(" ")}
          </p>
        ) : null}
        <ErrorLine>{act.error}</ErrorLine>
        {!changed || reason.trim().length < 3 ? (
          <p className="m-0 text-caption text-ink-2" role="status">{!changed ? "Change a role to save." : "Give a reason of at least 3 characters."}</p>
        ) : null}
        <div>
          <Button icon="check" loading={act.busy} disabled={!changed || reason.trim().length < 3 || act.busy} onClick={() => void save()}>Save roles</Button>
        </div>
      </div>
    </Card>
  );
}

export function AdminPeoplePage() {
  return (
    <Gated page="people">
      <PeopleBody />
    </Gated>
  );
}
