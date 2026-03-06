"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Instagram, Linkedin, Music2, Youtube } from "lucide-react";
import ContactInfo from "./contact-info";
import { useEffect, useState } from "react";

const twitter = "/twitter-x-blue.svg";
const telegram = "https://cdn1.newsworthy.ai/telegram-blue-icon.svg";

interface MenuPage {
  _id: string;
  _updatedAt: string;
  // Add other properties as needed
  slug: { current: string };
  title: string;
  seo_description: string;
  menu_title: string;
}

interface AboutMenu {
  _id: string;
  _createdAt: string;
  pages: MenuPage[];
  // Add other properties as needed
}

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const [aboutMenu, setAboutMenu] = useState<AboutMenu | null>(null);
  const [solutionsMenu, setSolutionsMenu] = useState<AboutMenu | null>(null);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:3008";

    async function fetchData() {
      const menuAboutResponse = await fetch(
        `${baseUrl}/api/navbar/about_navbar`,
        {
          next: { revalidate: 3600 },
        },
      );
      const menuAboutJson = await menuAboutResponse.json(); // Parse the JSON response into an object
      const menuAboutData = menuAboutJson.res; // Access the 'res' property of the parsed response

      setAboutMenu(menuAboutData);

      const menuSolutionsResponse = await fetch(
        `${baseUrl}/api/navbar/solutions_navbar`,
        {
          next: { revalidate: 3600 },
        },
      );
      const menuSolutionsJson = await menuSolutionsResponse.json(); // Parse the JSON response into an object
      const menuSolutionsData = menuSolutionsJson.res; // Access the 'res' property of the parsed response

      setSolutionsMenu(menuSolutionsData);
    }

    fetchData();
  }, []);

  return (
    <footer className="static bottom-0 bg-blue-500/5 border-t">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mx-auto w-full max-w-screen-xl xl:max-w-screen-2xl py-5 md:py-5 px-5">
        <div className="md:col-start-1 md:col-end-2">
          <Link href="/">
            <Image
              src="/logo.svg"
              className="mt-2 mb-4 w-[175px] h-auto"
              width="0"
              height="0"
              sizes="100vw"
              alt="Newsworthy Logo"
            />
          </Link>
          <ContactInfo />
          <div className="flex gap-4 items-center mt-3">
            <Link
              href="https://www.linkedin.com/company/newsworthyai"
              title="Newsworthy on LinkedIn"
            >
              <Linkedin size={18} className="text-cyan-900" />
            </Link>

            <Link
              href="https://t.me/NewsworthyAI"
              title="Newsworthy on Telegram"
            >
              <div>
                <Image
                  src={telegram}
                  className="w-[16px]"
                  width={16}
                  height={16}
                  alt={`Telegram Icon`}
                />
              </div>
            </Link>
            <Link
              href="https://www.youtube.com/channel/UCqAWp6V46oRa5lzFYvYf2Dg/"
              title="Newsworthy on Youtube"
            >
              <Youtube size={18} className="text-cyan-900" />
            </Link>
          </div>
        </div>
        <nav className="md:col-start-2 md:col-end-4 lg:col-start-2 lg:col-end-5 mt-5 md:mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-0">
            <div>
              <h3 className="font-bold text-lg lg:py-2">About Us</h3>
              {aboutMenu &&
                aboutMenu.pages.map((menuItem) => (
                  <ul key={menuItem.slug.current} className="pt-3">
                    <li>
                      <Link
                        href={`/${menuItem.slug.current}`}
                        title={menuItem.menu_title}
                        className="text-lg md:text-base hover:underline hover:text-sky-700"
                      >
                        {menuItem.menu_title}
                      </Link>
                    </li>
                  </ul>
                ))}
              <div className="mt-5">
                <ul className="flex flex-col md:flex-row gap-3">
                  <li>
                    <Link
                      className="text-lg md:text-base hover:underline hover:text-sky-700"
                      href="/blog"
                    >
                      Blog
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="text-lg md:text-base hover:underline hover:text-sky-700"
                      href="/pricing"
                    >
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="text-lg md:text-base hover:underline hover:text-sky-700"
                      href="/contact"
                    >
                      Contact Us
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-0 lg:mt-5">
              <ul className="flex flex-col gap-4">
                <li>
                  <Link
                    key="blogindex"
                    href={"https://newsworthy.ai/wordpress-plugin"}
                    className="text-lg md:text-base hover:underline hover:text-sky-700 pb-3"
                  >
                    WordPress Plugin
                  </Link>
                </li>
                <li>
                  <Link
                    key="blogindex"
                    href={
                      "https://newsworthy.ai/become-an-influencer-on-newsworthy"
                    }
                    className="text-lg md:text-base hover:underline hover:text-sky-700"
                  >
                    Become an Influencer Partner
                  </Link>
                </li>
                <li>
                  <Link
                    key="blogindex"
                    href={"/press-releases-newswires-and-pr-glossary-of-terms"}
                    className="text-lg md:text-base hover:underline hover:text-sky-700"
                  >
                    PR Glossary of Terms
                  </Link>
                </li>
                <li>
                  <Link
                    key="blogindex"
                    href={"/terms-of-service"}
                    className="text-lg md:text-base hover:underline hover:text-sky-700"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    key="blogindex"
                    href={"/privacy-policy"}
                    className="text-lg md:text-base hover:underline hover:text-sky-700"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    key="blogindex"
                    href={"/editorial-guidelines"}
                    className="text-lg md:text-base hover:underline hover:text-sky-700"
                  >
                    Editorial Guidelines
                  </Link>
                </li>
              </ul>
            </div>
            <div className="flex items-start flex-wrap gap-5">
              <div className="flex">
                <Image
                  src="/get-the-book-qrcode.svg"
                  width={150}
                  height={1}
                  className="w-[150px] h-[150px]"
                  alt="Scan QRcode to Get David's Marketing Book"
                />
                <Link
                  href="https://sourceforge.net/software/product/Newsworthy.ai/?pk_campaign=badge&amp;pk_source=vendor"
                  target="_blank"
                  title="Newsworthy.ai Reviews"
                >
                  <Image
                    src="/sourceforge-badge.svg"
                    width={130}
                    height={1}
                    className="w-[130px] h-[130px] mt-3"
                    alt="Newsworthy.ai Reviews"
                  />
                </Link>
              </div>
              <div>
                <Image
                  width={275}
                  height={100}
                  src="https://aitsmarketing.s3.amazonaws.com/aits-verified-tool.svg?width=600"
                  alt="AI Tech Suite Verified Tool Badge"
                />
              </div>
            </div>
          </div>
        </nav>
      </div>
      <div className="bg-cyan-900 py-3 px-5">
        <div className="text-left flex flex-col lg:flex-row mx-auto w-full max-w-screen-xl xl:max-w-screen-2xl items-center gap-3 lg:gap-20">
          <p className="font-sans text-sm text-white">
            Newsworthy.ai &copy; {currentYear} All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
}
