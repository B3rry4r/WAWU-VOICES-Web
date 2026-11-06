/** Skeleton pages carry a title only. Real content arrives with the task that builds the screen. */
export function PageTitle({ children }: { children: string }) {
  return <h1 className="m-0 mt-1 font-display text-display-l dt:text-display-xl">{children}</h1>;
}
