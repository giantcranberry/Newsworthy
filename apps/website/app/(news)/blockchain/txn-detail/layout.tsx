import "@/app/globals.css";
import { getPages } from "@/sanity/sanity-utils";
import { Nunito_Sans, Lora } from "next/font/google";
import { NavBar } from "@/components/navbar";
import { CrawlerStatsBar } from "@/components/crawler-stats-bar";
import Footer from "@/components/footer";
import { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import PlausibleProvider from "next-plausible";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import MicrosoftClarity from "@/components/MicrosoftClarity";
import VerifiedSchema from "@/components/VerifiedSchema";

export const metadata: Metadata = {
  title: {
    default: "Newsworthy.ai",
    template: `%s | Newsworthy.ai`,
  },
  description: "Newsworthy.ai, The News Marketing Platform",
};

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pages = await getPages();

  return (
    <html lang="en">
      <body
        className={`${nunitoSans.variable} ${lora.variable} flex h-screen flex-col justify-between font-sans text-black`}
      >
        <VerifiedSchema />
        <GoogleAnalytics />
        <MicrosoftClarity />
        <div className="w-full mx-auto">
          <CrawlerStatsBar />
          <NavBar />
        </div>
        <main className="mx-auto mb-auto w-full bg-white">{children}</main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
