import type { IconName, Tone } from "@/components/vx";

/** The eight tiles the Discover board draws, in the drawn order, with the drawn labels (V-25: the labels stay, the slugs are the Topics categories). */
export const DRAWN: { slug: string; label: string; icon: IconName; tone: Tone }[] = [
  { slug: "money", label: "Money", icon: "coins", tone: "sun" },
  { slug: "power", label: "Power and light", icon: "lightbulb", tone: "sky" },
  { slug: "work", label: "Work and pay", icon: "wallet", tone: "mint" },
  { slug: "love", label: "Love", icon: "heart", tone: "coral" },
  { slug: "roads", label: "Roads and travel", icon: "map-pin", tone: "sky" },
  { slug: "faith", label: "Faith", icon: "sun", tone: "coral" },
  { slug: "family", label: "Family", icon: "house", tone: "mint" },
  { slug: "elections", label: "Elections", icon: "vote", tone: "sky" },
];

const EXTRA_TONES: Tone[] = ["sun", "mint", "sky", "coral"];

export interface CategoryLook {
  label: string;
  icon: IconName;
  tone: Tone;
}

/** Label, icon and colour for a category: the drawn ones as drawn, any other by its own name with a colour picked from its slug. */
export function categoryLook(c: { slug: string; name: string }): CategoryLook {
  const d = DRAWN.find((x) => x.slug === c.slug);
  if (d) return { label: d.label, icon: d.icon, tone: d.tone };
  const n = c.slug.split("").reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return { label: c.name, icon: "message-square", tone: EXTRA_TONES[n % EXTRA_TONES.length] };
}
