"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { urlFor } from "@/sanity/sanity-utils";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

import { MobileSidebar } from "./mobile-sidebar";
import { SiteAd } from "@/types/SiteAd";
import { Navbar } from "@/types/Navbar";
import { Home } from "lucide-react";

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
  menu_title: string;
}

interface AboutMenu {
  _id: string;
  _createdAt: string;
  pages: MenuPage[];
  // Add other properties as needed
}

export function NavBar() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [menu_ad, setMenuAd] = useState<SiteAd | null>(null);
  const [aboutMenu, setAboutMenu] = useState<AboutMenu | null>(null);
  const [solutionsMenu, setSolutionsMenu] = useState<AboutMenu | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [categoriesResponse, menuAdResponse, menuAboutResponse, menuSolutionsResponse] = await Promise.all([
          fetch("/api/navbar/categories"),
          fetch("/api/navbar/navbarad"),
          fetch("/api/navbar/about_navbar"),
          fetch("/api/navbar/solutions_navbar"),
        ]);

        const categoriesJson = await categoriesResponse.json();
        const categoriesData = JSON.parse(categoriesJson.data);
        setCategories(categoriesData);

        const menuAdJson = await menuAdResponse.json();
        setMenuAd(menuAdJson.res);

        const menuAboutJson = await menuAboutResponse.json();
        setAboutMenu(menuAboutJson.res);

        const menuSolutionsJson = await menuSolutionsResponse.json();
        setSolutionsMenu(menuSolutionsJson.res);
      } catch (error) {
        console.error("Failed to fetch navbar data:", error);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="border-b border-gray-200 shadow-sm relative z-10">
      <div className="px-5 pt-5 lg:px-0 lg:pt-0">
        <MobileSidebar />
      </div>
      <div className="mx-auto w-full max-w-screen-xl xl:max-w-screen-2xl lg:flex justify-between items-center px-5">
        <NavigationMenu className="hidden lg:flex lg:py-5">
          <Link href="/">
            <Image
              src="/logo.svg"
              className="mr-5 w-64"
              width={256}
              height={40}
              sizes="75vw"
              alt="Newsworthy Logo"
            />
          </Link>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link
                  href="/"
                  className={navigationMenuTriggerStyle()}
                  aria-label="homepage"
                  title="homepage"
                >
                  <Home size={16} />
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="">
                About Us
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid gap-3 p-4 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                  <li className="row-span-5">
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
                          width={300}
                          height={1}
                          alt="Robot boy reading a book"
                          className="rounded-tl rounded-tr w-full h-full object-cover"
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
                  {aboutMenu &&
                    aboutMenu.pages.map((menuItem) => (
                      <ListItem
                        href={`/${menuItem.slug.current}`}
                        key={menuItem.slug.current}
                        title={menuItem.menu_title}
                        className="text-base"
                      >
                        {menuItem.seo_description}
                      </ListItem>
                    ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="">
                Solutions
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                  {solutionsMenu &&
                    solutionsMenu.pages.map((menuItem) => (
                      <ListItem
                        href={`/${menuItem.slug.current}`}
                        key={menuItem.slug.current}
                        title={menuItem.title}
                        className="text-base"
                      >
                        {menuItem.seo_description}
                      </ListItem>
                    ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuTrigger className="">
                Top Categories
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px] ">
                  {categories &&
                    categories.map((category) => (
                      <ListItem
                        key={category.slug}
                        title={category.name}
                        href={`/news/beat/${category.slug}`}
                        className="text-base"
                      >
                        {category.description}
                      </ListItem>
                    ))}
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link href="/pricing" className={navigationMenuTriggerStyle()}>
                  Pricing
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link href="/blog" className={navigationMenuTriggerStyle()}>
                  Blog
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link href="/curated" className={navigationMenuTriggerStyle()}>
                  Curated News
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link href="/community" className={navigationMenuTriggerStyle()}>
                  Community
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className="hidden lg:flex xl:hidden">
              <NavigationMenuLink asChild>
                <Link
                  href="https://app.newsworthyai.com/auth/login"
                  className={navigationMenuTriggerStyle()}
                >
                  Login
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className="hidden lg:flex xl:hidden">
              <NavigationMenuLink asChild>
                <Link
                  href="/auth/coregister/pr/newsworthy"
                  className={navigationMenuTriggerStyle()}
                >
                  Register Free
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className="hidden xl:flex">
              <NavigationMenuLink asChild>
                <Link
                  href="https://app.newsworthyai.com/auth/login"
                  className={navigationMenuTriggerStyle()}
                >
                  Login
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem className="hidden xl:flex">
              <NavigationMenuLink asChild>
                <Link
                  href="/auth/coregister/pr/newsworthy"
                  className={navigationMenuTriggerStyle()}
                >
                  Register Free
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </div>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<"a">,
  React.ComponentPropsWithoutRef<"a">
>(({ className, title, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className
          )}
          {...props}
        >
          <div className="text-base font-medium leading-none">{title}</div>
          <p className="text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </a>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";
