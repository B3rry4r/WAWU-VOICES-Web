import { LANDING_HEADLINE } from "@/features/entry/landing-words";

/** SEO-APPS: the search and share write-up for usevoices.com, one copy for the layout default, the root page and /welcome. */
export const SITE_URL = "https://usevoices.com";
export const SITE_TITLE = `VOICES: ${LANDING_HEADLINE}`;
// Under 160 characters: the first sentences of the welcome page words.
export const SITE_DESCRIPTION =
  "One question a day about life in Nigeria. Say your answer in 10 seconds, or type it. Hear people who agree and people who don’t. Vote.";
export const SITE_IMAGE = { url: "/icons/icon-512.png", width: 512, height: 512, alt: "VOICES" };
/** Pages search engines may list. Everything else is signed-in or private and stays out of the sitemap and robots.txt. */
export const PUBLIC_PATHS = ["/", "/welcome", "/sign-in", "/join"] as const;
export const PRIVATE_PATHS = [
  "/admin", "/settings", "/profile", "/api", "/notifications", "/friends", "/speak", "/units", "/report",
  "/reset-password", "/forgot-password", "/go", "/s/", "/search",
] as const;
