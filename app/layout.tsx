import type { Metadata } from "next";
import { Archivo } from "next/font/google";

import "./globals.css";

/**
 * A grotesque for display against the serif for body. The tension between the
 * two is the point: 311 is municipal paperwork, and the piece should look like
 * the record it is made of rather than like a literary essay about it.
 *
 * Self-hosted at build time by next/font, so no runtime request to a third party
 * and no layout shift. It degrades to the system sans stack if it fails.
 */
const display = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const TITLE = "Where is New York loud? | CitySignal";
const DESCRIPTION =
  "NYC 311 residential noise complaints do not show where the city is loud - they show who calls it. A live look at when and where New Yorkers report noise, and four explanations that did not survive.";

/**
 * SITE_URL is read from Vercel's deployment environment so canonical and Open
 * Graph URLs are correct in preview and production without being hardcoded.
 * NEXT_PUBLIC_SITE_URL overrides it for a custom domain.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "CitySignal",
  authors: [{ name: "Amina Moufakkir" }],
  creator: "Amina Moufakkir",
  keywords: [
    "NYC 311",
    "noise complaints",
    "NYC Open Data",
    "data journalism",
    "civic data",
    "Brooklyn",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "article",
    siteName: "CitySignal",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
  category: "data journalism",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#121417" },
  ],
};

/**
 * Applies a stored theme choice before first paint. Doing this from React would
 * paint the system palette first and correct it after hydration, which is the
 * flash every theme toggle is judged on. Wrapped in try/catch because storage
 * can throw in private mode; failing here must never block the page.
 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("citysignal-theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The script above sets an attribute on <html> before React hydrates.
    <html lang="en" className={display.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
