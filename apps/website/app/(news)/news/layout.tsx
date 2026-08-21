import "@/app/globals.css";
import { getPages } from "@/sanity/sanity-utils";
import { Nunito_Sans, Lora } from "next/font/google";
import { NavBar } from "@/components/navbar";
import Footer from "@/components/footer";
import { Metadata } from "next";
import { Toaster } from "@/components/ui/toaster";
import PlausibleProvider from "next-plausible";
import Script from "next/script";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import MicrosoftClarity from "@/components/MicrosoftClarity";

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
  display: "swap",
  variable: "--font-body",
  preload: false,
  // Adjust weights based on what you need
  weight: ["300", "400", "600", "700"],
  // Enable local font loading
  fallback: ["system-ui", "arial"],
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pages = await getPages();

  return (
    <html lang="en" className={`${nunitoSans.variable} ${lora.variable}`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <GoogleAnalytics />
        <MicrosoftClarity />
      </head>

      <body className={`flex h-screen flex-col justify-between text-black`} suppressHydrationWarning>
        <div className="w-full mx-auto">
          <NavBar />
        </div>
        <main className="mx-auto mb-auto w-full bg-white">{children}</main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
