import { Icon } from "@/components/vx";

/** The tick beside a verified person's name (V-46). Draw it only when the API says `verified`, and never beside an anonymous post. */
export function VerifiedTick({ verified, size = 16 }: { verified?: boolean | null; size?: number }) {
  if (!verified) return null;
  return <Icon name="badge-check" size={size} label="Verified" className="vx-tick" />;
}
