import "@/app/globals.css";
import { getPages } from "@/sanity/sanity-utils";
import { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: {
    default: "Newsworthy.ai",
    template: `%s | Newsworthy.ai`,
  },
  description: "Newsworthy.ai, The News Marketing Blog",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pages = await getPages();

  return (
    <div className="mx-auto max-w-full bg-white">
      {children}
      <script async src="https://static.addtoany.com/menu/page.js"></script>
      <Script
        src="https://static.addtoany.com/menu/page.js"
        strategy="lazyOnload"
      />
    </div>
  );
}
