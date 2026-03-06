import { getSiteAdBySlug } from "@/sanity/sanity-utils";
import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SeeYourNews() {
  const see_news_ad = await getSiteAdBySlug("see-your-news-here");
  return (
    <Card className="bg-cyan-600/5 border-0 flex flex-col">
      <CardHeader>
        <CardTitle className="font-serif font-medium text-3xl">
          {see_news_ad.title}
        </CardTitle>
        <CardDescription className="text-black text-lg lg:text-lg mb-0 pb-0">
          {see_news_ad.textContent}
        </CardDescription>
      </CardHeader>

      <CardFooter className="flex flex-col md:flex-row gap-3 items-start mt-0">
        <Link
          href={see_news_ad.ad_cta.cta_link}
          className="w-full md:w-auto bg-cyan-700 py-3 px-3 border-2 border-cyan-700 text-white text-center hover:bg-cyan-800 hover:border-cyan-800 rounded text-lg"
        >
          {see_news_ad.ad_cta.cta_text}
        </Link>
        <Link
          href={see_news_ad.ad_cta_2.cta_link}
          className="w-full md:w-auto border-2 py-3 px-3 text-center border-cyan-700 bg-transparent text-cyan-700 hover:bg-cyan-700 hover:text-white rounded text-lg"
        >
          {see_news_ad.ad_cta_2.cta_text}
        </Link>
      </CardFooter>
    </Card>
  );
}
