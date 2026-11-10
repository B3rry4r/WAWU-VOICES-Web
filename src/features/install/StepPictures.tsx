import type { ReactElement } from "react";

/**
 * The small pictures in the install steps. Drawn in SVG from the design tokens (no screenshots of Apple's screens,
 * which change with each iOS), so they follow light and dark with the rest of the app.
 */
const frame = { width: "100%", height: "auto", display: "block" } as const;

function ShareGlyph({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 -9 L0 5" /><path d="M-5 -4 L0 -9 L5 -4" /><path d="M-8 -1 V9 H8 V-1" />
    </g>
  );
}

/** Step 1: the Share button in Safari's bar (bottom on iPhone, top right on iPad). */
export function PicShare({ ipad = false, browser = "Safari" }: { ipad?: boolean; browser?: string }): ReactElement {
  return (
    <svg viewBox="0 0 240 120" role="img" aria-label={ipad ? `${browser} on iPad: the Share button is at the top right.` : `${browser} on iPhone: the Share button is at the bottom of the screen.`} style={frame} className="ig-pic">
      <rect x="1" y="1" width="238" height="118" rx="14" className="ig-pic__bg" />
      {ipad ? (
        <>
          <rect x="1" y="1" width="238" height="30" rx="14" className="ig-pic__bar" />
          <rect x="52" y="9" width="110" height="14" rx="7" className="ig-pic__field" />
          <g className="ig-pic__hot"><circle cx="212" cy="16" r="15" /></g>
          <g className="ig-pic__ink"><ShareGlyph x={212} y={17} s={0.9} /></g>
          <rect x="14" y="48" width="120" height="10" rx="5" className="ig-pic__line" />
          <rect x="14" y="68" width="170" height="10" rx="5" className="ig-pic__line" />
        </>
      ) : (
        <>
          <rect x="14" y="14" width="120" height="10" rx="5" className="ig-pic__line" />
          <rect x="14" y="34" width="170" height="10" rx="5" className="ig-pic__line" />
          <rect x="1" y="80" width="238" height="39" rx="14" className="ig-pic__bar" />
          <rect x="30" y="90" width="180" height="16" rx="8" className="ig-pic__field" />
        </>
      )}
      {ipad ? null : (
        <>
          <g className="ig-pic__hot"><circle cx="120" cy="100" r="15" /></g>
          <g className="ig-pic__ink"><ShareGlyph x={120} y={101} s={0.9} /></g>
        </>
      )}
    </svg>
  );
}

/** Step 2: the row in the share sheet. */
export function PicAddRow(): ReactElement {
  return (
    <svg viewBox="0 0 240 120" role="img" aria-label="The share sheet, with the row Add to Home Screen lit." style={frame} className="ig-pic">
      <rect x="1" y="1" width="238" height="118" rx="14" className="ig-pic__bg" />
      <rect x="14" y="14" width="212" height="26" rx="8" className="ig-pic__row" />
      <rect x="26" y="23" width="90" height="8" rx="4" className="ig-pic__line" />
      <g className="ig-pic__hotrow"><rect x="14" y="48" width="212" height="32" rx="8" /></g>
      <g className="ig-pic__ink" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="24" y="55" width="18" height="18" rx="4" /><path d="M33 59 V69 M28 64 H38" />
      </g>
      <text x="52" y="69" className="ig-pic__text">Add to Home Screen</text>
      <rect x="14" y="88" width="212" height="22" rx="8" className="ig-pic__row" />
      <rect x="26" y="96" width="70" height="7" rx="3.5" className="ig-pic__line" />
    </svg>
  );
}

/** Step 3: the icon on the home screen. */
export function PicHome(): ReactElement {
  return (
    <svg viewBox="0 0 240 120" role="img" aria-label="The VOICES icon on your home screen." style={frame} className="ig-pic">
      <rect x="1" y="1" width="238" height="118" rx="14" className="ig-pic__bg" />
      {[0, 1, 3].map((i) => (
        <rect key={i} x={30 + i * 48} y="22" width="36" height="36" rx="9" className="ig-pic__row" />
      ))}
      <clipPath id="ig-icon-clip"><rect x="78" y="22" width="36" height="36" rx="9" /></clipPath>
      <image href="/icons/icon-192.png" x="78" y="22" width="36" height="36" clipPath="url(#ig-icon-clip)" />
      <rect x="78" y="22" width="36" height="36" rx="9" fill="none" className="ig-pic__app" />
      <text x="96" y="74" textAnchor="middle" className="ig-pic__label">VOICES</text>
      {[0, 1, 3].map((i) => (
        <rect key={i} x={30 + i * 48} y="82" width="36" height="22" rx="6" className="ig-pic__row" />
      ))}
    </svg>
  );
}

/** In-app browsers: the three dots at a corner and the "Open in browser" row. */
export function PicOpenIn({ browser }: { browser: string }): ReactElement {
  return (
    <svg viewBox="0 0 240 120" role="img" aria-label={`The ${browser} menu with Open in ${browser} lit.`} style={frame} className="ig-pic">
      <rect x="1" y="1" width="238" height="118" rx="14" className="ig-pic__bg" />
      <rect x="1" y="1" width="238" height="28" rx="14" className="ig-pic__bar" />
      <g className="ig-pic__hot"><circle cx="216" cy="15" r="13" /></g>
      <g className="ig-pic__ink" fill="currentColor"><circle cx="216" cy="9" r="2" /><circle cx="216" cy="15" r="2" /><circle cx="216" cy="21" r="2" /></g>
      <rect x="92" y="38" width="134" height="26" rx="8" className="ig-pic__row" />
      <rect x="102" y="47" width="70" height="8" rx="4" className="ig-pic__line" />
      <g className="ig-pic__hotrow"><rect x="92" y="70" width="134" height="30" rx="8" /></g>
      <text x="102" y="89" className="ig-pic__text">Open in {browser}</text>
    </svg>
  );
}
