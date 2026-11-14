"use client";
import { useRouter } from "next/navigation";
import { AdSlot, Avatar, Badge, Banner, Button, EmptyState, IconButton, Skeleton, SponsoredSurvey } from "@/components/vx";
import { useLoad } from "@/components/feed/useLoad";
import { Rail } from "@/components/shell/ShellSlots";
import { ApiError } from "@/lib/api/client";
import { recordAdEvent } from "@/lib/api/polls";
import { getBrandPage, type BrandPage } from "@/lib/api/surveys";
import { aboutMinutes } from "./logic";

/** A brand's page (BrandPage boards): who it is, then its live Sponsored Surveys and adverts, all labelled. No contact address is ever shown. */
export function BrandPageScreen({ slug }: { slug: string }) {
  const load = useLoad<BrandPage>(() => getBrandPage(slug), [slug]);
  if (load.state === "loading") {
    return (
      <div className="grid gap-4" aria-busy="true" aria-label="Loading">
        <Skeleton variant="tile" />
        <Skeleton variant="tile" />
      </div>
    );
  }
  if (load.state === "error") {
    const e = load.error;
    if (e instanceof ApiError && e.status === 404) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <EmptyState icon="compass" title="We could not find that brand" body="The address may be wrong, or the page is not live." action="Go to Home" onAction={() => window.location.assign("/")} />
        </div>
      );
    }
    const offline = e instanceof ApiError && e.status === 0;
    return (
      <Banner tone={offline ? "offline" : "danger"} title={offline ? "You are offline" : "This did not load"} action="Try again" onAction={load.retry}>
        {offline ? "Check your connection and try again." : "Something went wrong on our side. Try again in a moment."}
      </Banner>
    );
  }
  return <Loaded page={load.data} />;
}

function Why() {
  return (
    <section aria-labelledby="bp-why" className="flex flex-col gap-2 rounded-l bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)] dt:p-5">
      <h2 id="bp-why" className="m-0 text-body-strong">Why brands are here</h2>
      <p className="m-0 text-body text-ink-2">Brands pay for labelled spots, approved by WAWU before they run. They never change rankings or poll results, and never see who you are.</p>
    </section>
  );
}

function Loaded({ page }: { page: BrandPage }) {
  const router = useRouter();
  const b = page.brand;
  const any = page.surveys.length + page.ads.length > 0;
  return (
    <>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 dt:gap-6" data-testid="brand-page">
        <div className="-mx-2 flex h-12 items-center gap-1 dt:hidden">
          <IconButton icon="arrow-left" label="Back" onClick={() => router.back()} />
          <span className="flex-1 text-body-strong text-ink-2">Brand page</span>
        </div>
        <section aria-labelledby="bp-h" className="flex flex-col gap-[14px] rounded-xl border border-dashed border-[var(--sponsor-line)] bg-[var(--sponsor-bg)] p-5 dt:gap-4 dt:p-7">
          <div className="flex flex-wrap items-center gap-[14px] dt:gap-4">
            <span className="dt:hidden"><Avatar name={b.name} src={b.logoUrl ?? undefined} size="l" tone="sun" /></span>
            <span className="hidden dt:block"><Avatar name={b.name} src={b.logoUrl ?? undefined} size="xl" tone="sun" /></span>
            <div className="flex min-w-0 flex-1 basis-[200px] flex-col gap-1 dt:gap-[6px]">
              <span className="order-2 self-start dt:order-1"><Badge tone="sponsored">{b.label}</Badge></span>
              <h1 id="bp-h" className="order-1 m-0 font-display text-display-m dt:order-2 dt:text-display-xl">{b.name}</h1>
              {b.tagline ? <p className="order-3 m-0 hidden text-body-l dt:block">{b.tagline}</p> : null}
            </div>
            {b.website ? (
              <span className="hidden dt:block"><Button icon="link" href={b.website} target="_blank" rel="noopener noreferrer">{`Visit ${b.name}`}</Button></span>
            ) : null}
          </div>
          {b.tagline ? <p className="m-0 text-body-l dt:hidden">{b.tagline}</p> : null}
          {b.website ? (
            <span className="dt:hidden"><Button icon="link" block href={b.website} target="_blank" rel="noopener noreferrer">{`Visit ${b.name}`}</Button></span>
          ) : null}
        </section>

        <section aria-labelledby="bp-from" className="flex flex-col gap-3">
          <h2 id="bp-from" className="vx-eyebrow m-0 text-ink-2">{`From ${b.name}`}</h2>
          {any ? (
            <>
              <div className="grid grid-cols-1 items-start gap-4 dt:grid-cols-2">
                {page.ads.map((a) => (
                  <AdSlot
                    key={a.id}
                    brand={b.name}
                    headline={a.headline}
                    body={a.body ?? undefined}
                    cta={a.linkUrl ? (a.ctaLabel ?? "Learn more") : false}
                    href={a.linkUrl ?? undefined}
                    onWhy={false}
                    onOpen={() => { recordAdEvent(a.id, "TAP").catch(() => undefined); }}
                  />
                ))}
              </div>
              {page.surveys.map((s) => (
                <SponsoredSurvey key={s.id} brand={b.name} question={s.title} questions={s.questionCount} minutes={aboutMinutes(s.questionCount)} href={`/surveys/${s.id}`} cta="Start the survey" />
              ))}
            </>
          ) : (
            <p className="m-0 rounded-l bg-surface-2 p-4 text-body text-ink-2" data-testid="brand-empty">{`${b.name} has nothing live right now. Check back soon.`}</p>
          )}
        </section>

        <div className="dt:hidden"><Why /></div>
      </div>
      <Rail>
        <Why />
      </Rail>
    </>
  );
}
