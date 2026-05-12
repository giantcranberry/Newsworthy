import Image from "next/image";
import { PortableText } from "@portabletext/react";
import { cn } from "@/lib/utils";
import type { BannerAd, BannerAdCta, BannerAdImage } from "@/types/BannerAd";

type Props = {
  ad: BannerAd;
  className?: string;
  /** Override the layout the ad was authored with (e.g. a compact gutter variant). */
  layout?: BannerAd["layout"];
  /**
   * Force the stacked (single-column) presentation at every viewport — i.e.
   * render the way it normally would on mobile: the split layout stacks text
   * over image, and the mobile image is used if one was uploaded. Useful for
   * narrow placements like a sidebar.
   */
  stacked?: boolean;
};

// Accepts hex (with or without leading #), rgb()/hsl(), or CSS color keywords.
// Rejects malformed hex like "#9D1D2" so one bad value can't kill the whole background.
function normalizeColor(input?: string): string | undefined {
  if (!input) return undefined;
  const v = input.trim();
  if (!v) return undefined;
  if (/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{4}$|^[0-9a-fA-F]{6}$|^[0-9a-fA-F]{8}$/.test(v)) return `#${v}`;
  if (v.startsWith("#")) {
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v) ? v : undefined;
  }
  return v; // rgb()/hsl()/keyword — let the browser validate
}

// Strips the few CSS constructs that can be dangerous when injected into a
// <style> tag (HTML/script breakout, @import, IE expression(), behavior,
// -moz-binding, javascript: urls). CSS itself can't run code, so this plus the
// scoping convention is enough — but it makes the field foot-gun-proof.
function sanitizeCss(raw?: string): string | undefined {
  if (!raw) return undefined;
  let css = String(raw);
  css = css.replace(/\/\*[\s\S]*?\*\//g, " ");           // drop comments (can hide payloads)
  css = css.replace(/@(?:import|charset|namespace)\b[^;{}]*;?/gi, ""); // external/at-rule fetches
  css = css.replace(/expression\s*\(/gi, "");             // IE CSS expressions
  css = css.replace(/-moz-binding\s*:/gi, "");            // XBL bindings
  css = css.replace(/\bbehavior\s*:/gi, "");              // IE HTC behaviors
  css = css.replace(/(?:javascript|vbscript)\s*:/gi, "");  // script urls
  // Escape "<" so "</style>" / "<script>" can't break out of the <style> element.
  // ">" is left intact so the CSS child combinator (a > b) still works.
  css = css.replace(/</g, "\\3C ");
  css = css.trim();
  return css || undefined;
}

function backgroundStyle(ad: BannerAd): React.CSSProperties {
  const style: React.CSSProperties = {};
  const solid = normalizeColor(ad.backgroundColor);
  if (solid) style.backgroundColor = solid; // also acts as a fallback if the gradient below is invalid

  if (ad.useGradient) {
    const stops = [ad.gradientFrom, ad.gradientVia, ad.gradientTo]
      .map(normalizeColor)
      .filter((c): c is string => Boolean(c));
    if (stops.length >= 2) {
      const dir = ad.gradientDirection || "135deg";
      style.backgroundImage =
        dir === "radial"
          ? `radial-gradient(circle at top right, ${stops.join(", ")})`
          : `linear-gradient(${dir}, ${stops.join(", ")})`;
    } else if (stops.length === 1 && !style.backgroundColor) {
      // Gradient was requested but only one valid stop — degrade to a solid color.
      style.backgroundColor = stops[0];
    }
  }
  return style;
}

const bodyComponents = {
  marks: {
    link: ({ value, children }: { value?: { href?: string }; children: React.ReactNode }) => (
      <a
        href={value?.href}
        target={(value?.href || "").startsWith("http") ? "_blank" : undefined}
        rel={(value?.href || "").startsWith("http") ? "noopener noreferrer" : undefined}
        className="underline underline-offset-2"
      >
        {children}
      </a>
    ),
  },
};

function isNonEmptyBlock(b: any): boolean {
  if (!b) return false;
  if (b._type !== "block") return true; // keep non-text content (images etc.)
  return (b.children ?? []).some((c: any) => typeof c?.text === "string" && c.text.trim() !== "");
}

function AdBody({ ad }: { ad: BannerAd }) {
  const blocks = (ad.body ?? []).filter(isNonEmptyBlock);
  if (!blocks.length) return null;
  return (
    <div className="banner-ad__body space-y-2 text-base md:text-lg leading-relaxed text-balance opacity-90">
      <PortableText value={blocks} components={bodyComponents} />
    </div>
  );
}

function AdImage({
  image,
  mobileImage,
  className,
  priority,
  forceMobile,
}: {
  image?: BannerAdImage;
  mobileImage?: BannerAdImage;
  className?: string;
  priority?: boolean;
  /** Always show the mobile image (falling back to the main image) at every breakpoint. */
  forceMobile?: boolean;
}) {
  // Force the mobile image at all sizes.
  if (forceMobile) {
    const img = mobileImage?.url ? mobileImage : image;
    if (!img?.url) return null;
    return (
      <Image
        src={img.url}
        alt={img.alt || image?.alt || ""}
        width={img.width ?? 800}
        height={img.height ?? 600}
        priority={priority}
        className={cn("banner-ad__image", className)}
      />
    );
  }

  if (!image?.url) return null;
  const w = image.width ?? 1200;
  const h = image.height ?? 630;
  return (
    <>
      <Image
        src={image.url}
        alt={image.alt || ""}
        width={w}
        height={h}
        priority={priority}
        className={cn("banner-ad__image", mobileImage?.url ? "hidden sm:block" : "", className)}
      />
      {mobileImage?.url && (
        <Image
          src={mobileImage.url}
          alt={mobileImage.alt || image.alt || ""}
          width={mobileImage.width ?? 800}
          height={mobileImage.height ?? 600}
          priority={priority}
          className={cn("banner-ad__image", "sm:hidden", className)}
        />
      )}
    </>
  );
}

const CTA_BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition-all";

function ctaPresetClasses(style: BannerAdCta["style"], theme: BannerAd["theme"]) {
  switch (style) {
    case "secondary":
      return cn(CTA_BASE, theme === "light" ? "bg-gray-100 text-gray-900 hover:bg-gray-200" : "bg-white/15 text-white hover:bg-white/25");
    case "outline":
      return cn(CTA_BASE, theme === "light" ? "border-2 border-gray-900/20 text-gray-900 hover:border-gray-900/50" : "border-2 border-white/30 text-white hover:border-white hover:bg-white/10");
    case "link":
      return cn("inline-flex items-center gap-1 font-semibold underline underline-offset-4", theme === "light" ? "text-gray-900" : "text-white");
    case "primary":
    default:
      return cn(CTA_BASE, theme === "light" ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-white text-gray-900 hover:bg-white/90 shadow-sm");
  }
}

function CtaButtons({ ad }: { ad: BannerAd }) {
  if (!ad.ctas?.length) return null;
  const accent = normalizeColor(ad.accentColor);
  return (
    <div className="banner-ad__ctas flex w-full flex-col items-center gap-3 mt-1 sm:w-auto sm:flex-row sm:justify-center">
      {ad.ctas.map((cta, i) => {
        if (!cta.label || !cta.url) return null;
        const isExternal = cta.url.startsWith("http");
        const rel = [cta.sponsored ? "sponsored nofollow" : null, isExternal ? "noopener noreferrer" : null]
          .filter(Boolean)
          .join(" ");

        const customBg = normalizeColor(cta.bgColor);
        const customText = normalizeColor(cta.textColor);
        // Per-CTA color wins; otherwise the (legacy) ad-level accent applies to the first solid button.
        const bg = customBg ?? (i === 0 && cta.style !== "outline" && cta.style !== "link" ? accent : undefined);

        let className: string;
        let style: React.CSSProperties | undefined;
        if (bg) {
          className = cn(CTA_BASE, "hover:opacity-90 shadow-sm");
          style = { backgroundColor: bg, color: customText ?? "#ffffff" };
        } else {
          className = ctaPresetClasses(cta.style, ad.theme);
          style = customText ? { color: customText } : undefined;
        }
        // Button-style CTAs go full width on mobile, natural width from `sm` up.
        if (cta.style !== "link") className = cn(className, "w-full sm:w-auto");

        return (
          <a
            key={i}
            href={cta.url}
            target={cta.openInNewTab ? "_blank" : undefined}
            rel={rel || undefined}
            style={style}
            className={className}
          >
            {cta.label}
          </a>
        );
      })}
    </div>
  );
}

function AdLogo({ ad, className }: { ad: BannerAd; className?: string }) {
  if (!ad.logo?.url) return null;
  return (
    <Image
      src={ad.logo.url}
      alt={ad.logo.alt || ad.headline || ""}
      width={ad.logo.width ?? 200}
      height={ad.logo.height ?? 60}
      // `self-start` keeps the logo at its natural width instead of stretching
      // to fill the flex column (which makes it look centered).
      className={cn("banner-ad__logo h-10 w-auto max-w-[240px] object-contain self-start", className)}
    />
  );
}

function AdEyebrow({ ad }: { ad: BannerAd }) {
  if (!ad.eyebrow) return null;
  return <span className="banner-ad__eyebrow text-xs font-semibold uppercase tracking-widest opacity-70">{ad.eyebrow}</span>;
}

function AdHeadline({ ad, className }: { ad: BannerAd; className?: string }) {
  if (!ad.headline) return null;
  // `text-balance` (text-wrap: balance) distributes words evenly across lines,
  // which eliminates one-word orphans/widows on the last line.
  return <h3 className={cn("banner-ad__headline font-serif font-semibold leading-tight text-balance", className)}>{ad.headline}</h3>;
}

function Disclosure({ ad }: { ad: BannerAd }) {
  if (!ad.disclosureLabel) return null;
  return (
    <span className="banner-ad__disclosure absolute right-3 top-3 rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide opacity-80">
      {ad.disclosureLabel}
    </span>
  );
}

export default function BannerAdBlock({ ad, className, layout, stacked: stackedProp }: Props) {
  if (!ad || ad.enabled === false) return null;
  // Default the stacked behaviour from the CMS; an explicit prop can still override.
  const stacked = stackedProp ?? Boolean(ad.stacked);
  const effectiveLayout = layout ?? ad.layout ?? "split";
  const themeClass = ad.textColor ? "" : ad.theme === "light" ? "text-gray-900" : "text-white";
  const containerStyle: React.CSSProperties = { ...backgroundStyle(ad), ...(ad.textColor ? { color: ad.textColor } : {}) };
  const id = `banner-ad-${ad.slug}`;
  const safeCss = sanitizeCss(ad.customCss);

  // Image-only banner
  if (effectiveLayout === "image" && (ad.bannerImage?.url || ad.mobileImage?.url)) {
    const inner = (
      <AdImage image={ad.bannerImage} mobileImage={ad.mobileImage} forceMobile={stacked} className="w-full h-auto rounded-xl" />
    );
    return (
      <div id={id} data-ad={ad.slug} className={cn("banner-ad relative overflow-hidden rounded-xl", className)}>
        {safeCss && <style dangerouslySetInnerHTML={{ __html: safeCss }} />}
        <Disclosure ad={ad} />
        {ad.href ? (
          <a href={ad.href} target={ad.href.startsWith("http") ? "_blank" : undefined} rel={ad.href.startsWith("http") ? "noopener noreferrer" : undefined}>
            {inner}
          </a>
        ) : (
          inner
        )}
      </div>
    );
  }

  // Text band — callout strip, no image
  if (effectiveLayout === "band") {
    return (
      <div id={id} data-ad={ad.slug} className={cn("banner-ad relative overflow-hidden rounded-xl", themeClass, className)} style={containerStyle}>
        {safeCss && <style dangerouslySetInnerHTML={{ __html: safeCss }} />}
        <Disclosure ad={ad} />
        <div className="flex flex-col items-center gap-4 px-6 py-8 text-center md:px-10">
          <AdLogo ad={ad} className="self-center" />
          <AdEyebrow ad={ad} />
          <AdHeadline ad={ad} className="text-2xl md:text-3xl" />
          <AdBody ad={ad} />
          <CtaButtons ad={ad} />
        </div>
      </div>
    );
  }

  // Card — compact sidebar card
  if (effectiveLayout === "card") {
    return (
      <div id={id} data-ad={ad.slug} className={cn("banner-ad relative overflow-hidden rounded-xl", themeClass, className)} style={containerStyle}>
        {safeCss && <style dangerouslySetInnerHTML={{ __html: safeCss }} />}
        <Disclosure ad={ad} />
        <div className="space-y-3 p-6">
          <AdLogo ad={ad} />
          <AdEyebrow ad={ad} />
          <AdHeadline ad={ad} className="text-xl" />
          {(ad.bannerImage?.url || ad.mobileImage?.url) && (
            <AdImage image={ad.bannerImage} mobileImage={ad.mobileImage} forceMobile={stacked} className="w-full h-auto rounded-lg" />
          )}
          <AdBody ad={ad} />
          <CtaButtons ad={ad} />
        </div>
      </div>
    );
  }

  // Split layout.
  const imageLeft = ad.imageSide === "left";
  const hasImage = Boolean(ad.bannerImage?.url || ad.mobileImage?.url);

  // Stacked: single column at every viewport — logo / eyebrow / headline / body /
  // CTAs, then the image at the bottom (so it can bleed to the card edge).
  if (stacked) {
    return (
      <div id={id} data-ad={ad.slug} className={cn("banner-ad relative overflow-hidden rounded-xl", themeClass, className)} style={containerStyle}>
        {safeCss && <style dangerouslySetInnerHTML={{ __html: safeCss }} />}
        <Disclosure ad={ad} />
        <div className="flex flex-col items-center gap-5 p-6 text-center">
          <AdLogo ad={ad} className="self-center" />
          <AdEyebrow ad={ad} />
          <AdHeadline ad={ad} className="text-3xl" />
          <AdBody ad={ad} />
          <CtaButtons ad={ad} />
          {hasImage && (
            <div className="flex w-full justify-center">
              <AdImage
                image={ad.bannerImage}
                mobileImage={ad.mobileImage}
                forceMobile
                className="h-auto w-full max-w-sm rounded-lg"
                priority
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Side-by-side on md+, stacks (text + CTAs, then image) below md.
  return (
    <div id={id} data-ad={ad.slug} className={cn("banner-ad relative overflow-hidden rounded-xl", themeClass, className)} style={containerStyle}>
      {safeCss && <style dangerouslySetInnerHTML={{ __html: safeCss }} />}
      <Disclosure ad={ad} />
      <div className="grid items-center gap-6 p-6 md:grid-cols-2 md:gap-10 md:p-10">
        <div className={cn("flex flex-col gap-4 text-center md:text-left", imageLeft && "md:order-2")}>
          <AdLogo ad={ad} />
          <AdEyebrow ad={ad} />
          <AdHeadline ad={ad} className="text-3xl md:text-4xl" />
          <AdBody ad={ad} />
          <CtaButtons ad={ad} />
        </div>
        {hasImage && (
          <div className={cn("flex justify-center", imageLeft && "md:order-1")}>
            <AdImage image={ad.bannerImage} mobileImage={ad.mobileImage} className="h-auto w-full rounded-lg" priority />
          </div>
        )}
      </div>
    </div>
  );
}
