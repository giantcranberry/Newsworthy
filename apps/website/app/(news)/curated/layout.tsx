import "@/app/globals.css";

import { Nunito_Sans, Lora } from "next/font/google";
import { NavBar } from "@/components/navbar";
import { CrawlerStatsBar } from "@/components/crawler-stats-bar";
import Footer from "@/components/footer";
import { Toaster } from "@/components/ui/toaster";
import { CrispProvider } from "@/components/crisp-provider";
import { Metadata } from "next";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import MicrosoftClarity from "@/components/MicrosoftClarity";
import VerifiedSchema from "@/components/VerifiedSchema";
import { CrawlerHitBeacon } from "@/components/crawler-hit-beacon";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  preload: false,
  fallback: ["serif"],
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  preload: false,
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: {
    default: "Newsworthy.ai",
    template: `%s | Newsworthy.ai`,
  },
  description: "Newsworthy.ai, The News Marketing Platform",
  openGraph: {
    title: "Newsworthy.ai",
    description: "Newsworthy.ai, The News Marketing Platform",
    images: [
      {
        url: "/nw-social-image.jpg",
        width: 1200,
        height: 630,
      },
      {
        url: "/nw-social-image.jpg",
        width: 1200,
        height: 675,
      },
      {
        url: "/nw-social-image.jpg",
        width: 300,
        height: 157,
      },
      {
        url: "/nw-social-image.jpg",
        width: 800,
        height: 418,
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${nunitoSans.variable} ${lora.variable}`}>
      <CrispProvider />
      <body className="flex h-screen flex-col justify-between font-sans text-gray-950">
        <VerifiedSchema />
        <GoogleAnalytics />
        <MicrosoftClarity />
        <header className="mx-auto w-full">
          <CrawlerStatsBar />
          <NavBar />
        </header>
        <main className="mx-auto mb-auto w-full">{children}</main>
        <Footer />
        <Toaster />
        <CrawlerHitBeacon />
      </body>
    </html>
  );
}
