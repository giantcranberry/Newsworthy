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
  // Add other properties as needed
  slug: { current: string };
  title: string;
  seo_description: string;
}

interface AboutMenu {
  _id: string;
  _createdAt: string;
  pages: MenuPage[];
  // Add other properties as needed
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
      const categoriesJson = await categoriesResponse.json(); // Parse the JSON response into an object
      const categoriesData = JSON.parse(categoriesJson.data); // Parse the 'data' string into an array of objects
      setCategories(categoriesData);

      const menuAdResponse = await fetch(`${baseUrl}/api/navbar/navbarad`, {
        next: { revalidate: 3600 },
      });
      const menuAdJson = await menuAdResponse.json(); // Parse the JSON response into an object
      const menuAdData = menuAdJson.res; // Access the 'res' property of the parsed response

      setMenuAd(menuAdData);

      const menuAboutResponse = await fetch(
        `${baseUrl}/api/navbar/about_navbar`,
        {
          next: { revalidate: 3600 },
        }
      );
      const menuAboutJson = await menuAboutResponse.json(); // Parse the JSON response into an object
      const menuAboutData = menuAboutJson.res; // Access the 'res' property of the parsed response

      setAboutMenu(menuAboutData);

      const menuSolutionsResponse = await fetch(
        `${baseUrl}/api/navbar/solutions_navbar`,
        {
          next: { revalidate: 3600 },
        }
      );
      const menuSolutionsJson = await menuSolutionsResponse.json(); // Parse the JSON response into an object
      const menuSolutionsData = menuSolutionsJson.res; // Access the 'res' property of the parsed response

      setSolutionsMenu(menuSolutionsData);
    }

    fetchData();
  }, []);
  return (
    <Accordion type="single" collapsible className="mt-5">
      <AccordionItem value="item-1" className="border-0">
        <AccordionTrigger>About Us</AccordionTrigger>
        <AccordionContent>
          <NavigationMenu>
            <ul className="space-y-3 mt-2">
              {aboutMenu &&
                aboutMenu.pages.map((menuItem) => (
                  <ListItem
                    href={`/${menuItem.slug.current}`}
                    key={menuItem.slug.current}
                    title={menuItem.title}
                    className="text-base pb-2 leading-snug"
                  >
                    {/* {menuItem.seo_description} */}
                  </ListItem>
                ))}
              <li>
                <NavigationMenuLink asChild>
                  <a
                    className="flex h-full w-full select-none flex-col justify-end rounded-md bg-cyan-900 no-underline focus:shadow-md hover:border-cyan-500"
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
                      className="rounded-tl rounded-tr w-full"
                    />
                    <div className="px-6 pb-6">
                      <div className="mb-3 text-2xl leading-6 font-bold text-white">
                        {menu_ad?.title}
                      </div>
                      <p className="text-sm text-white">
                        {menu_ad?.textContent}
                      </p>
                      <p className="text-sm font-bold pt-3 text-white flex items-center">
                        Read more
                        <i className="fa-light fa-chevron-right pl-2 text-xs"></i>
                      </p>
                    </div>
                  </a>
                </NavigationMenuLink>
              </li>
            </ul>
          </NavigationMenu>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2" className="border-0">
        <AccordionTrigger className="hover:underline-0">
          Solutions
        </AccordionTrigger>
        <AccordionContent>
          <NavigationMenu>
            <ul className="space-y-3 mt-2">
              {solutionsMenu &&
                solutionsMenu.pages.map((menuItem) => (
                  <ListItem
                    href={`/${menuItem.slug.current}`}
                    key={menuItem.slug.current}
                    title={menuItem.title}
                    className="text-base pb-2 leading-snug"
                  ></ListItem>
                ))}
            </ul>
          </NavigationMenu>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3" className="border-0">
        <AccordionTrigger className="hover:underline-0">
          Top Categories
        </AccordionTrigger>
        <AccordionContent>
          <NavigationMenu>
            <ul>
              {categories &&
                categories.map((category) => (
                  <ListItem
                    key={category.slug}
                    title={category.name}
                    href={`/news/beat/${category.slug}`}
                    className="text-base pb-2"
                  ></ListItem>
                ))}
            </ul>
          </NavigationMenu>
        </AccordionContent>
      </AccordionItem>
      <NavigationMenu>
        <ul className="mt-4 mb-4 grid gap-8">
          <li>
            <Link href="/pricing" legacyBehavior passHref>
              Pricing
            </Link>
          </li>
          <li>
            <Link href="/blog" legacyBehavior passHref>
              Blog
            </Link>
          </li>
          <li>
            <Link href="/community" legacyBehavior passHref>
              Community
            </Link>
          </li>
          <li>
            <Link href="/contact" legacyBehavior passHref>
              Contact Us
            </Link>
          </li>
          <li>
            <Link
              href="https://app.newsworthyai.com/auth/login"
              legacyBehavior
              passHref
            >
              Login
            </Link>
          </li>
          <li>
            <Link
              href="/auth/coregister/pr/newsworthy"
              legacyBehavior
              passHref
            >
              Register Free
            </Link>
          </li>
        </ul>
      </NavigationMenu>
    </Accordion>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <AccordionContent asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none rounded-md leading-none no-underline",
            className
          )}
          {...props}
        >
          <div className="leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </AccordionContent>
    </li>
  );
});
ListItem.displayName = "ListItem";
