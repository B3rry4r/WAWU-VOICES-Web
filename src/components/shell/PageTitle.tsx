/** Skeleton pages carry a title only. Real content arrives with the task that builds the screen. */
export function PageTitle({ children }: { children: string }) {
  return <h1 className="m-0 mt-1 font-display text-[28px] font-normal leading-8 dt:text-[32px] dt:leading-9">{children}</h1>;
}
