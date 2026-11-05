import type { Metadata, Viewport } from "next";
import { Archivo, Bagel_Fat_One } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import "./globals.css";
import "../components/vx/vx.css";

const bagel = Bagel_Fat_One({ weight: "400", subsets: ["latin"], display: "swap", variable: "--nf-bagel" });
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], display: "swap", variable: "--nf-archivo" });

export const metadata: Metadata = { title: { default: "VOICES", template: "%s | VOICES" }, description: "Say your take. Listen to Africa." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${bagel.variable} ${archivo.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
