import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { THEME_SCRIPT } from "@/components/shell/theme-script";
import "./globals.css";
import "./type.css";
import "../components/vx/vx.css";

// Fonts are committed under public/fonts (OFL, see OFL-Archivo.txt and OFL-BagelFatOne.txt there): the build never reaches a font server.
// Archivo is one variable file per subset (400 to 700). The latin-ext file carries the naira sign (U+20A6). Options are literals because next/font reads them at build time.

const bagel = localFont({ src: "../../public/fonts/bagel-fat-one-latin-400.woff2", weight: "400", display: "swap", variable: "--nf-bagel" });
const archivo = localFont({
  src: "../../public/fonts/archivo-latin-var.woff2", weight: "400 700", display: "swap", variable: "--nf-archivo-a",
  declarations: [{ prop: "unicode-range", value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD" }],
});
const archivoExt = localFont({
  src: "../../public/fonts/archivo-latin-ext-var.woff2", weight: "400 700", display: "swap", variable: "--nf-archivo-b", preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF" }],
});

export const metadata: Metadata = { title: { default: "VOICES", template: "%s | VOICES" }, description: "Say your take. Listen to Africa." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bagel.variable} ${archivo.variable} ${archivoExt.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
