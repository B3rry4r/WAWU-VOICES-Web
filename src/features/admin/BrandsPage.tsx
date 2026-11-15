"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, Button, EmptyState, TextField } from "@/components/vx";
import { createBrand, isLogoMime, listBrands, updateBrand, uploadBrandLogo } from "@/lib/api/admin-surveys";
import type { AdminBrand, BrandInput } from "@/lib/api/admin-surveys";
import { Card, CardTitle, ErrorLine, Gated, ListSkeleton, LoadFailed, PageHead, Pill, SavedLine, Switch, isSuspendedError, refusalWords, useAction } from "./ui";

/** The fields of `next` that differ from the saved brand. */
export function changedBrandFields(b: AdminBrand, next: BrandInput): Partial<BrandInput> {
  const saved: Record<string, unknown> = { name: b.name, tagline: b.tagline ?? "", website: b.website ?? "", contactEmail: b.contactEmail ?? "", active: b.active };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) if (k === "logoFileId" || JSON.stringify(v) !== JSON.stringify(saved[k])) out[k] = v;
  return out as Partial<BrandInput>;
}

function BrandsBody() {
  const [items, setItems] = useState<AdminBrand[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [editing, setEditing] = useState<AdminBrand | "new" | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await listBrands()).items);
    } catch (e) {
      setError(e as Error);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHead
        eyebrow="Ad manager"
        title="Brand pages"
        sub="A brand page shows the brand, its live surveys and its live adverts."
        right={error && isSuspendedError(error) ? undefined : (
          <Button icon="plus" onClick={() => { setEditing("new"); setSaved(null); }}>
            New brand
          </Button>
        )}
      />
      {saved ? (
        <div className="mb-4">
          <SavedLine>{saved}</SavedLine>
        </div>
      ) : null}
      {error ? (
        <LoadFailed error={error} retry={load} />
      ) : items === null ? (
        <ListSkeleton />
      ) : (
        <>
          {items.length === 0 && !editing ? (
            <EmptyState icon="badge-check" title="No brands yet" body="Add a brand to give it a page." action="New brand" actionIcon="plus" onAction={() => setEditing("new")} />
          ) : items.length ? (
            <div className="mb-5 overflow-hidden rounded-xl border border-line bg-surface">
              <table className="w-full border-collapse text-left text-caption">
                <thead>
                  <tr className="text-ink-2">
                    {["Brand", "Page address", "Website", "Contact", "Status", ""].map((h, i) => (
                      <th key={i} className="vx-eyebrow whitespace-nowrap px-4 py-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((b) => (
                    <tr key={b.id} className="border-t border-line align-middle">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-3 text-body-strong"><Avatar name={b.name} src={b.logoUrl ?? undefined} size="s" tone="sun" />{b.name}</span>
                      </td>
                      <td className="px-4 py-3">{`/brands/${b.slug}`}</td>
                      <td className="px-4 py-3 break-words">{b.website ?? "-"}</td>
                      <td className="px-4 py-3 break-words">{b.contactEmail ?? "-"}</td>
                      <td className="px-4 py-3">{b.active ? <Pill tone="green">Page is live</Pill> : <Pill>Hidden</Pill>}</td>
                      <td className="px-4 py-3 text-right"><Button variant="secondary" size="s" onClick={() => { setEditing(b); setSaved(null); }}>{`Edit ${b.name}`}</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {editing ? (
            <BrandForm
              key={editing === "new" ? "new" : editing.id}
              brand={editing === "new" ? undefined : editing}
              onClose={() => setEditing(null)}
              onSaved={(b) => { setEditing(null); setSaved(editing === "new" ? `Brand saved. Its page is /brands/${b.slug}.` : "Brand saved."); void load(); }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function BrandForm({ brand, onClose, onSaved }: { brand?: AdminBrand; onClose: () => void; onSaved: (b: AdminBrand) => void }) {
  const [f, setF] = useState({ name: brand?.name ?? "", tagline: brand?.tagline ?? "", website: brand?.website ?? "", contactEmail: brand?.contactEmail ?? "" });
  const [active, setActive] = useState(brand?.active ?? true);
  const [logoId, setLogoId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(brand?.logoUrl ?? null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const act = useAction();
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));

  async function pick(file0: File | undefined) {
    if (!file0) return;
    setLogoError(null);
    if (!isLogoMime(file0.type)) return setLogoError("Use a JPEG, PNG or WebP picture.");
    setLogoBusy(true);
    try {
      const id = await uploadBrandLogo(file0);
      setLogoId(id);
      setPreview(URL.createObjectURL(file0));
    } catch (e) {
      setLogoError(refusalWords(e));
    } finally {
      setLogoBusy(false);
    }
  }

  async function save() {
    const body: BrandInput = {
      name: f.name.trim(),
      tagline: f.tagline.trim(),
      website: f.website.trim(),
      contactEmail: f.contactEmail.trim(),
      active,
      ...(logoId ? { logoFileId: logoId } : {}),
    };
    // Empty optional fields are left out of a new brand; an edit sends what changed.
    const clean = (o: BrandInput): BrandInput => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "")) as unknown as BrandInput;
    const out = await act.run(() => (brand ? updateBrand(brand.id, changedBrandFields(brand, body)) : createBrand(clean(body))));
    if (out) onSaved(out);
  }

  return (
    <Card>
      <CardTitle>{brand ? `Edit ${brand.name}` : "New brand"}</CardTitle>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Brand name" value={f.name} onChange={set("name")} />
        <TextField label="Website" value={f.website} onChange={set("website")} placeholder="https://" inputMode="url" hint="A working link, starting with https://." />
        <TextField label="One line about the brand" value={f.tagline} onChange={set("tagline")} className="col-span-2" />
        <TextField label="Contact email (never shown to the public)" type="email" inputMode="email" value={f.contactEmail} onChange={set("contactEmail")} />
        <div className="flex flex-col gap-2">
          <div className="text-count">Logo</div>
          <div className="flex items-center gap-4">
            <Avatar name={f.name || "Brand"} src={preview ?? undefined} size="l" tone="sun" />
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="vx-sr" tabIndex={-1} aria-label="Choose a logo" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
            <Button variant="secondary" icon="plus" loading={logoBusy} onClick={() => file.current?.click()}>{preview ? "Change logo" : "Add a logo"}</Button>
          </div>
          <ErrorLine>{logoError}</ErrorLine>
        </div>
      </div>
      <div className="mt-2 max-w-[520px]">
        <Switch checked={active} onChange={setActive} label="The page is live" hint="Switch off to hide the page. Its address then answers not found." />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <ErrorLine>{act.error}</ErrorLine>
        <div className="flex gap-3">
          <Button icon="check" loading={act.busy} disabled={!f.name.trim() || act.busy || logoBusy} onClick={save}>Save brand</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Card>
  );
}

export function AdminBrandsPage() {
  return (
    <Gated page="brands">
      <BrandsBody />
    </Gated>
  );
}
