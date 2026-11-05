import type { Config } from "tailwindcss";

// Every colour, radius and shadow maps to a token variable in src/app/tokens.css. No raw hex here.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    screens: { sm: "640px", md: "768px", dt: "1024px", lg: "1024px", xl: "1280px" },
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)", 3: "var(--surface-3)" },
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)", inverse: "var(--ink-inverse)" },
        green: { DEFAULT: "var(--green)", hover: "var(--green-hover)", press: "var(--green-press)", text: "var(--green-text)", on: "var(--on-green)" },
        forest: { DEFAULT: "var(--forest)", 2: "var(--forest-2)", on: "var(--on-forest)" },
        mint: "var(--mint)",
        sun: "var(--sun)",
        verified: { DEFAULT: "var(--verified)", bg: "var(--verified-bg)" },
        unverified: { DEFAULT: "var(--unverified)", bg: "var(--unverified-bg)" },
        gossip: { DEFAULT: "var(--gossip)", bg: "var(--gossip-bg)" },
        success: { DEFAULT: "var(--success)", bg: "var(--success-bg)" },
        warning: { DEFAULT: "var(--warning)", bg: "var(--warning-bg)" },
        danger: { DEFAULT: "var(--danger)", bg: "var(--danger-bg)", fill: "var(--danger-fill)" },
        info: { DEFAULT: "var(--info)", bg: "var(--info-bg)" },
        rec: "var(--rec)",
      },
      borderRadius: {
        xs: "var(--radius-xs)", s: "var(--radius-s)", m: "var(--radius-m)", l: "var(--radius-l)", xl: "var(--radius-xl)", pill: "var(--radius-pill)",
      },
      boxShadow: { 1: "var(--shadow-1)", 2: "var(--shadow-2)", 3: "var(--shadow-3)", speak: "var(--shadow-speak)", focus: "var(--shadow-focus)" },
      fontFamily: { display: ["var(--font-display)"], body: ["var(--font-body)"] },
      spacing: { gutter: "var(--gutter-phone)", "gutter-d": "var(--gutter-desktop)", nav: "var(--nav-w)", rail: "var(--rail-w)", topbar: "var(--topbar-h)", bottombar: "var(--bottombar-h)" },
      maxWidth: { feed: "var(--feed-max)", page: "var(--page-max)" },
      zIndex: { sticky: "50", nav: "60", sheet: "80", toast: "90" },
    },
  },
  plugins: [],
};
export default config;
