import "../globals.css";

import { Nunito_Sans, Lora } from "next/font/google";
import { NavBar } from "@/components/navbar";
import Footer from "@/components/footer";
import { Toaster } from "@/components/ui/toaster";
import { CrispProvider } from "@/components/crisp-provider";
import { Metadata } from "next";
import PlausibleProvider from "next-plausible";
import GoogleAnalytics from "@/components/GoogleAnalytics";

const lora = Lora({
  subsets: ['latin'],
  display: 'swap',
  fallback: ['serif'],
  preload: false,
  weight: ['400', '500', '600', '700'],
  adjustFontFallback: true,
})

const nunitoSans = Nunito_Sans({
    subsets: ["latin"],
    variable: "--font-body",
    display: "swap",
    fallback: ["system-ui", "sans-serif"],
    preload: false,
    adjustFontFallback: true,
});

export const metadata: Metadata = {
    title: {
        default: "Newsroom | Newsworthy.ai",
        template: `%s | Newsroom | Newsworthy.ai`,
    },
    description: "Company newsrooms and press releases on Newsworthy.ai",
};

export default async function NewsroomLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${nunitoSans.variable} ${lora.className}`}>
            <CrispProvider />
            <body className="flex h-screen flex-col justify-between font-sans text-gray-950">
                <GoogleAnalytics />
                <header className="mx-auto w-full">
                    <NavBar />
                </header>
                <main className="mx-auto mb-auto w-full">{children}</main>
                <Footer />
                <Toaster />
            </body>
        </html>
    );
}