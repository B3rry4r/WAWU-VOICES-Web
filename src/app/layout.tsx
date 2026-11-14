import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { THEME_SCRIPT } from "@/components/shell/theme-script";
import { InstallGate } from "@/features/install/InstallGate";
import { INSTALL_SCRIPT } from "@/lib/install/boot-script";
import { SITE_DESCRIPTION, SITE_IMAGE, SITE_TITLE, SITE_URL } from "@/lib/seo";
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
// V-43: Bagel Fat One has no tone marks and no dot under the e, so the Yoruba headline line is set in Archivo, whose Vietnamese subset
// carries U+1EB9 (ẹ), U+1ECD (ọ) and the combining accents (U+0300, U+0301, U+0323). It loads only when those characters are on the page.
const archivoViet = localFont({
  src: "../../public/fonts/archivo-vietnamese-var.woff2", weight: "400 700", display: "swap", variable: "--nf-archivo-c", preload: false,
  declarations: [{ prop: "unicode-range", value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB" }],
});

export const metadata: Metadata = {
  // SEO-APPS: metadataBase makes every relative share image and canonical absolute. Pages without their own write-up get this one.
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s | VOICES" },
  description: SITE_DESCRIPTION,
  openGraph: { type: "website", siteName: "VOICES", title: SITE_TITLE, description: SITE_DESCRIPTION, url: SITE_URL, locale: "en_NG", images: [SITE_IMAGE] },
  twitter: { card: "summary", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [SITE_IMAGE.url] },
  // V-41: the manifest comes from app/manifest.ts; these are the Apple home-screen tags (the touch icon is app/apple-icon.png).
  applicationName: "VOICES",
  appleWebApp: { capable: true, title: "VOICES", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // Chrome and Android want this tag; appleWebApp above only emits the older apple- one (Chrome warns it is deprecated).
  other: { "mobile-web-app-capable": "yes" },
};
// theme-color follows the device theme: the --bg token, light and dark (tokens.css).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
    { media: "(prefers-color-scheme: dark)", color: "#04120b" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bagel.variable} ${archivo.variable} ${archivoExt.variable} ${archivoViet.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INSTALL_SCRIPT }} />
      </head>
      <body>
        <div id="app-root" style={{ display: "contents" }}>
          <AppShell>{children}</AppShell>
        </div>
        <InstallGate />
      </body>
    </html>
  );
}
