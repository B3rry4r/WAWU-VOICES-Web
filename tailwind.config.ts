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
      // The type scale (src/app/type.css). Family is not set here: pair display-* and num-* with font-display.
      fontSize: {
        "display-2xl": ["var(--t-display-2xl-size)", { lineHeight: "var(--t-display-2xl-line)", fontWeight: "var(--t-display-2xl-weight)", letterSpacing: "var(--t-display-2xl-tracking)" }],
        "display-xl": ["var(--t-display-xl-size)", { lineHeight: "var(--t-display-xl-line)", fontWeight: "var(--t-display-xl-weight)", letterSpacing: "var(--t-display-xl-tracking)" }],
        "display-l": ["var(--t-display-l-size)", { lineHeight: "var(--t-display-l-line)", fontWeight: "var(--t-display-l-weight)", letterSpacing: "var(--t-display-l-tracking)" }],
        "display-m": ["var(--t-display-m-size)", { lineHeight: "var(--t-display-m-line)", fontWeight: "var(--t-display-m-weight)", letterSpacing: "var(--t-display-m-tracking)" }],
        "display-s": ["var(--t-display-s-size)", { lineHeight: "var(--t-display-s-line)", fontWeight: "var(--t-display-s-weight)", letterSpacing: "var(--t-display-s-tracking)" }],
        "num-xl": ["var(--t-num-xl-size)", { lineHeight: "var(--t-num-xl-line)", fontWeight: "var(--t-num-xl-weight)", letterSpacing: "var(--t-num-xl-tracking)" }],
        "num-l": ["var(--t-num-l-size)", { lineHeight: "var(--t-num-l-line)", fontWeight: "var(--t-num-l-weight)", letterSpacing: "var(--t-num-l-tracking)" }],
        "num-m": ["var(--t-num-m-size)", { lineHeight: "var(--t-num-m-line)", fontWeight: "var(--t-num-m-weight)", letterSpacing: "var(--t-num-m-tracking)" }],
        "title": ["var(--t-title-size)", { lineHeight: "var(--t-title-line)", fontWeight: "var(--t-title-weight)", letterSpacing: "var(--t-title-tracking)" }],
        "body-l": ["var(--t-body-l-size)", { lineHeight: "var(--t-body-l-line)", fontWeight: "var(--t-body-l-weight)", letterSpacing: "var(--t-body-l-tracking)" }],
        "body": ["var(--t-body-size)", { lineHeight: "var(--t-body-line)", fontWeight: "var(--t-body-weight)", letterSpacing: "var(--t-body-tracking)" }],
        "body-strong": ["var(--t-body-strong-size)", { lineHeight: "var(--t-body-strong-line)", fontWeight: "var(--t-body-strong-weight)", letterSpacing: "var(--t-body-strong-tracking)" }],
        "label": ["var(--t-label-size)", { lineHeight: "var(--t-label-line)", fontWeight: "var(--t-label-weight)", letterSpacing: "var(--t-label-tracking)" }],
        "caption": ["var(--t-caption-size)", { lineHeight: "var(--t-caption-line)", fontWeight: "var(--t-caption-weight)", letterSpacing: "var(--t-caption-tracking)" }],
        "eyebrow": ["var(--t-eyebrow-size)", { lineHeight: "var(--t-eyebrow-line)", fontWeight: "var(--t-eyebrow-weight)", letterSpacing: "var(--t-eyebrow-tracking)" }],
        "count": ["var(--t-count-size)", { lineHeight: "var(--t-count-line)", fontWeight: "var(--t-count-weight)", letterSpacing: "var(--t-count-tracking)" }],
        "bar": ["var(--t-bar-size)", { lineHeight: "var(--t-bar-line)", fontWeight: "var(--t-bar-weight)", letterSpacing: "var(--t-bar-tracking)" }],
      },
      fontFamily: { display: ["var(--font-display)"], body: ["var(--font-body)"] },
      spacing: { gutter: "var(--gutter-phone)", "gutter-d": "var(--gutter-desktop)", nav: "var(--nav-w)", rail: "var(--rail-w)", topbar: "var(--topbar-h)", bottombar: "var(--bottombar-h)" },
      maxWidth: { feed: "var(--feed-max)", page: "var(--page-max)" },
      zIndex: { sticky: "50", nav: "60", sheet: "80", toast: "90" },
    },
  },
  plugins: [],
};
export default config;
