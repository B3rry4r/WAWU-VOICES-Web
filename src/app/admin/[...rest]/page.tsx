import { Button } from "@/components/vx";

/**
 * Any address under /admin with no page of its own lands here, so it is drawn inside the admin layout:
 * a guest sees the admin sign-in, a person who is not an admin sees "not an admin", and an admin sees this.
 */
export default function Page() {
  return (
    <div className="mx-auto flex max-w-[480px] flex-col items-center gap-4 px-4 pb-16 pt-16 text-center">
      <h1 className="m-0 font-display text-display-l">We could not find that admin page.</h1>
      <p className="m-0 text-body text-ink-2">Check the address, or go back to the admin home.</p>
      <Button href="/admin">Admin home</Button>
    </div>
  );
}
