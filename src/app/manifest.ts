import type { MetadataRoute } from "next";

// V-41: the web app manifest, served at /manifest.webmanifest. The two colours are the light tokens (--bg in tokens.css);
// the browser bar follows the device theme through viewport.themeColor in layout.tsx. Icons are the brand mark:
// "any" is the mark on white, "maskable" is the same mark inside the 80 percent safe circle on white.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "VOICES",
    short_name: "VOICES",
    description: "Say your take. Listen to Africa.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f5f5",
    theme_color: "#f5f5f5",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
