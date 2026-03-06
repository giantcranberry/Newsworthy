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
    default: "Newsworthy.ai - Your AI-powered news platform",
    template: `%s | Newsworthy.ai`,
  },
  description: "Newsworthy.ai is a platform for creating, distributing, and analyzing press releases and news content.",
  openGraph: {
    title: "Newsworthy.ai - Your AI-powered news platform",
    description: "Newsworthy.ai is a platform for creating, distributing, and analyzing press releases and news content.",
    url: "https://newsworthy.ai",
    siteName: "Newsworthy.ai",
    images: [
      {
        url: "https://newsworthy.ai/nw-social-image.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Newsworthy.ai - Your AI-powered news platform",
    description: "Newsworthy.ai is a platform for creating, distributing, and analyzing press releases and news content.",
    site: '@newsworthy_ai',
    creator: '@newsworthy_ai',
    images: ['https://newsworthy.ai/nw-social-image.jpg'],
  },
  icons: {
    icon: '/favicon.ico',
  },
  alternates: {
    canonical: `https://newsworthy.ai`
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${nunitoSans.variable} ${lora.className}`}>
            <CrispProvider />
            <body suppressHydrationWarning className="flex h-screen flex-col justify-between font-sans text-gray-950">
                <GoogleAnalytics />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "Organization",
                            "name": "Newsworthy.ai",
                            "url": "https://newsworthy.ai",
                            "logo": "https://newsworthy.ai/logo.svg",
                            "sameAs": [
                                "https://twitter.com/newsworthy_ai",
                            ]
                        })
                    }}
                />
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
