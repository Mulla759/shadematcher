import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import "./shade.css";
import "./landing.css";
import "./gallery.css";
import { SmoothScrollProvider } from "@/components/SmoothScroll";
import { BetaBanner } from "@/components/BetaBanner";
import { ErrorReporter } from "@/components/ErrorReporter";
import { BETA_MODE } from "@/lib/beta";

export const metadata: Metadata = {
  title: "Auriga — Colour Atelier",
  description:
    "A skin-tone aware colour engine for hijabs. Read your face, match a piece, and preview the colour before the cloth.",
  keywords: ["hijab", "shade finder", "skin tone", "colour matching", "virtual try on", "Auriga"],
  openGraph: {
    title: "Auriga — Colour Atelier",
    description:
      "See a hijab colour on your own face. A skin-tone aware shade engine built for modest fashion.",
    type: "website",
  },
  // Public testing stays out of search results until the launch build flips it.
  robots: BETA_MODE ? { index: false, follow: false } : { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#F2ECE1",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <BetaBanner />
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
        <ErrorReporter />
        {process.env.NEXT_PUBLIC_ANALYTICS === "1" ? <Analytics /> : null}
      </body>
    </html>
  );
}
