"use client";

import * as React from "react";
import { urlFor } from "@/sanity/sanity-utils";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SiteAd } from "@/types/SiteAd";
import Image from "next/image";

import {
  NavigationMenu,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Link from "next/link";

interface Category {
  slug: string;
  name: string;
  description: string;
}

interface MenuPage {
  _id: string;
  _updatedAt: string;
  slug: { current: string };
  title: string;
  seo_description: string;
}

interface AboutMenu {
  _id: string;
  _createdAt: string;
  pages: MenuPage[];
}

export function MobileDropdown() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [menu_ad, setMenuAd] = useState<SiteAd | null>(null);
  const [aboutMenu, setAboutMenu] = useState<AboutMenu | null>(null);
  const [solutionsMenu, setSolutionsMenu] = useState<AboutMenu | null>(null);
  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000";

    async function fetchData() {
      const categoriesResponse = await fetch(
        `${baseUrl}/api/navbar/categories`,
        { next: { revalidate: 3600 } }
      );
      const categoriesJson = await categoriesResponse.json();
      const categoriesData = JSON.parse(categoriesJson.data);
      setCategories(categoriesData);

      const menuAdResponse = await fetch(`${baseUrl}/api/navbar/navbarad`, {
        next: { revalidate: 3600 },
      });
      const menuAdJson = await menuAdResponse.json();
      setMenuAd(menuAdJson.res);

      const menuAboutResponse = await fetch(
        `${baseUrl}/api/navbar/about_navbar`,
        { next: { revalidate: 3600 } }
      );
      const menuAboutJson = await menuAboutResponse.json();
      setAboutMenu(menuAboutJson.res);

      const menuSolutionsResponse = await fetch(
        `${baseUrl}/api/navbar/solutions_navbar`,
        { next: { revalidate: 3600 } }
      );
      const menuSolutionsJson = await menuSolutionsResponse.json();
      setSolutionsMenu(menuSolutionsJson.res);
    }

    fetchData();
  }, []);

  return (
    <div className="mt-6">
      <Accordion type="single" collapsible>
        <AccordionItem value="item-1" className="border-b border-gray-100">
          <AccordionTrigger className="text-sm font-medium text-gray-900 hover:no-underline py-3">
            About Us
          </AccordionTrigger>
          <AccordionContent>
            <NavigationMenu>
              <ul className="space-y-1 mt-1">
                {aboutMenu &&
                  aboutMenu.pages.map((menuItem) => (
                    <ListItem
                      href={`/${menuItem.slug.current}`}
                      key={menuItem.slug.current}
                      title={menuItem.title}
                    />
                  ))}
                <li>
                  <NavigationMenuLink asChild>
                    <a
                      className="mt-3 flex w-full select-none flex-col justify-end rounded-xl bg-cyan-900 no-underline overflow-hidden"
                      href="/blog/was-this-press-release-written-by-ai"
                    >
                      <Image
                        src={
                          menu_ad?.ad_image
                            ? urlFor(menu_ad.ad_image.asset)
                            : "/robotai.webp"
                        }
                        width={215}
                        height={1}
                        alt="Robot boy reading a book"
                        className="w-full"
                      />
                      <div className="px-4 py-4">
                        <div className="text-base font-semibold text-white leading-tight">
                          {menu_ad?.title}
                        </div>
                        <p className="text-xs text-cyan-100 mt-1.5">
                          {menu_ad?.textContent}
                        </p>
                        <p className="text-xs font-medium mt-2 text-white flex items-center">
                          Read more
                          <svg className="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                          </svg>
                        </p>
                      </div>
                    </a>
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenu>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2" className="border-b border-gray-100">
          <AccordionTrigger className="text-sm font-medium text-gray-900 hover:no-underline py-3">
            Solutions
          </AccordionTrigger>
          <AccordionContent>
            <NavigationMenu>
              <ul className="space-y-1 mt-1">
                {solutionsMenu &&
                  solutionsMenu.pages.map((menuItem) => (
                    <ListItem
                      href={`/${menuItem.slug.current}`}
                      key={menuItem.slug.current}
                      title={menuItem.title}
                    />
                  ))}
              </ul>
            </NavigationMenu>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3" className="border-b border-gray-100">
          <AccordionTrigger className="text-sm font-medium text-gray-900 hover:no-underline py-3">
            Top Categories
          </AccordionTrigger>
          <AccordionContent>
            <NavigationMenu>
              <ul className="space-y-1 mt-1">
                {categories &&
                  categories.map((category) => (
                    <ListItem
                      key={category.slug}
                      title={category.name}
                      href={`/news/beat/${category.slug}`}
                    />
                  ))}
              </ul>
            </NavigationMenu>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Static links */}
      <div className="mt-6 space-y-1">
        {[
          { href: "/pricing", label: "Pricing" },
          { href: "/blog", label: "Blog" },
          { href: "/community", label: "Community" },
          { href: "/contact", label: "Contact Us" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Auth buttons */}
      <div className="mt-6 space-y-2.5 pb-6">
        <Link
          href="https://app.newsworthyai.com/login"
          className="block w-full rounded-full border border-gray-200 px-4 py-2.5 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Login
        </Link>
        <Link
          href="/auth/coregister/pr/newsworthy"
          className="block w-full rounded-full bg-cyan-700 px-4 py-2.5 text-center text-sm font-medium text-white transition-all hover:bg-cyan-800 hover:shadow-md hover:shadow-cyan-700/20"
        >
          Register Free
        </Link>
      </div>
    </div>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a"> & { title: string }
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <a
        ref={ref}
        className={cn(
          "block rounded-lg px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900",
          className
        )}
        {...props}
      >
        {title}
      </a>
    </li>
  );
});
ListItem.displayName = "ListItem";
