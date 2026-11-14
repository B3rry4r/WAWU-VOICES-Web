import { bpsFromPercent, count, koboFromNaira, milliFromTokens, naira, percent, tokens } from "./format";

/** How a setting is typed and shown. The API stores kobo, milli-tokens, basis points and plain counts. */
export type Unit = "kobo" | "milli" | "bps" | "count";

export interface Def {
  key: string;
  label: string;
  unit: Unit;
  help: string;
  /** The word after a count, "characters". */
  noun?: string;
}

export interface Group {
  id: string;
  title: string;
  note?: string;
  defs: Def[];
}

export const GROUPS: Group[] = [
  {
    id: "prices",
    title: "Text and voice prices",
    note: "1 token is worth 1 naira. A voice price in naira is the same number of tokens.",
    defs: [
      { key: "cost.text_post_milli", label: "Text, tokens per block", unit: "milli", help: "Charged for each block of characters (next row), in proportion, after the free posts." },
      { key: "text.price_chars", label: "Characters in a text block", unit: "count", noun: "characters", help: "The size of one block of text for the price above." },
      { key: "voice.extra30.price_kobo", label: "Voice message, up to 30 seconds", unit: "kobo", help: "Charged when the voice message is sent." },
      { key: "voice.extra60.price_kobo", label: "Voice message, 30 to 60 seconds", unit: "kobo", help: "Charged when the voice message is sent." },
      { key: "textfix.cost_milli", label: "AI text fix", unit: "milli", help: "Charged only when a fix comes back." },
    ],
  },
  {
    id: "limits",
    title: "Free posts and limits",
    defs: [
      { key: "allowance.free_posts", label: "Free posts for each person", unit: "count", help: "Lifetime, text and voice together." },
      { key: "allowance.free_post_text_chars", label: "Longest text a free post covers", unit: "count", noun: "characters", help: "Longer text pays in full." },
      { key: "allowance.messages_per_day", label: "Messages a person can send in a day", unit: "count", help: "Answers and replies, text and voice together. Resets at midnight in Lagos." },
      { key: "units.min_purchase_kobo", label: "Smallest purchase", unit: "kobo", help: "No pack can cost less than this, and it cannot be more than the cheapest pack." },
    ],
  },
  {
    id: "actions",
    title: "What an action costs",
    note: "Charged after the free ones are used up. 0 means free. Most is 1,000 tokens.",
    defs: [
      { key: "cost.reaction_milli", label: "A reaction", unit: "milli", help: "Charged for each reaction after the free reactions of the day." },
      { key: "cost.vote_milli", label: "A vote", unit: "milli", help: "Charged for each vote after the free votes of the day." },
      { key: "cost.proposal_milli", label: "A What Next? proposal", unit: "milli", help: "Free at launch." },
      { key: "cost.explain_milli", label: "Explaining a vote", unit: "milli", help: "Free at launch." },
    ],
  },
  {
    id: "charges",
    title: "VAT and payment charges",
    note: "The customer pays these on top of the price at checkout. A change applies to checkouts that start after it. A payment already started keeps its own amounts.",
    defs: [
      { key: "charges.vat_rate_bps", label: "VAT rate", unit: "bps", help: "A percent of the price. Rounded up to the kobo." },
      { key: "charges.fee_rate_bps", label: "Payment provider fee rate", unit: "bps", help: "The provider's percent of the total, passed to the customer." },
      { key: "charges.fee_flat_kobo", label: "Payment provider flat fee", unit: "kobo", help: "Added to each payment, in naira." },
      { key: "charges.fee_cap_kobo", label: "Payment provider fee cap", unit: "kobo", help: "The most the fee can be on one payment." },
    ],
  },
];

export const ALL_DEFS: Def[] = GROUPS.flatMap((g) => g.defs);
export const PACKS_KEY = "units.tiers";
export const PLANS_KEY = "units.plans";
export const MONEY_KEYS = new Set<string>([...ALL_DEFS.map((d) => d.key), PACKS_KEY, PLANS_KEY]);

export interface Pack {
  slug: string;
  name: string;
  priceKobo: number;
  unitsMilli: number;
  bonusMilli: number;
}
export interface Plan {
  slug: string;
  name: string;
  months: number;
  priceKobo: number;
  monthlyMilli: number;
  active: boolean;
}

export function show(unit: Unit, v: unknown, noun?: string): string {
  if (typeof v !== "number") return "-";
  if (unit === "kobo") return naira(v);
  if (unit === "milli") return `${tokens(v)} tokens`;
  if (unit === "bps") return percent(v);
  return noun ? `${count(v)} ${noun}` : count(v);
}

/** The number a person types to edit a value, in the unit they think in. */
export function toInput(unit: Unit, v: unknown): string {
  if (typeof v !== "number") return "";
  if (unit === "kobo") return String(v / 100);
  if (unit === "milli") return String(v / 1000);
  if (unit === "bps") return String(v / 100);
  return String(v);
}

/** What a person typed to the stored integer, or null when it is not a sensible amount. */
export function fromInput(unit: Unit, text: string): number | null {
  if (unit === "kobo") return koboFromNaira(text);
  if (unit === "milli") return milliFromTokens(text);
  if (unit === "bps") return bpsFromPercent(text);
  const t = text.trim().replace(/,/g, "");
  return /^\d+$/.test(t) ? Number(t) : null;
}

export const unitHint: Record<Unit, string> = {
  kobo: "In naira, like 78 or 199.53",
  milli: "In tokens, like 5 or 16.67",
  bps: "In percent, like 7.5",
  count: "A whole number",
};

/** A short line for a change-log cell. */
export function describe(key: string, v: unknown): string {
  const d = ALL_DEFS.find((x) => x.key === key);
  if (d) return show(d.unit, v, d.noun);
  if (key === PACKS_KEY && Array.isArray(v)) return (v as Pack[]).map((p) => `${p.name} ${naira(p.priceKobo)} for ${tokens(p.unitsMilli)}`).join(", ");
  if (key === PLANS_KEY && Array.isArray(v)) return (v as Plan[]).map((p) => `${p.name} ${naira(p.priceKobo)}${p.active ? "" : " (off)"}`).join(", ");
  return JSON.stringify(v);
}

export function labelOf(key: string): string {
  if (key === PACKS_KEY) return "Token packs";
  if (key === PLANS_KEY) return "Subscription plans";
  return ALL_DEFS.find((d) => d.key === key)?.label ?? key;
}
