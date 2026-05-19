import { getBannerAdBySlug } from "@/sanity/sanity-utils";
import type { BannerAd } from "@/types/BannerAd";
import BannerAdBlock from "./banner-ad-block";

type Props = {
  slug: string;
  className?: string;
  /** Override the authored layout (e.g. render a "card" variant in a narrow gutter). */
  layout?: BannerAd["layout"];
  /** Force the stacked single-column presentation (mobile image + stacked layout) at every viewport. */
  stacked?: boolean;
};

// Drop-in server component: fetch a Banner Ad by slug and render it.
// Renders nothing if the ad is missing or disabled.
export default async function BannerAdBand({ slug, className, layout, stacked }: Props) {
  const ad = await getBannerAdBySlug(slug);
  if (!ad) return null;
  return <BannerAdBlock ad={ad} className={className} layout={layout} stacked={stacked} />;
}
