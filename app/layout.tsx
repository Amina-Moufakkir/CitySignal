import type { Metadata } from "next";

import "./globals.css";

/** Full metadata, Open Graph, and the generated share image land in increment 5. */
export const metadata: Metadata = {
  title: "CitySignal",
  description:
    "When and where New Yorkers report residential noise to 311 - and what that does and does not tell you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
