import { PortableTextImageComponent, BannerAdEmbedComponent } from "@/components/portable_text_component";
import { getFlatPage, getPage, urlFor } from "@/sanity/sanity-utils";
import { PortableText } from "@portabletext/react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  const flatPage = !page ? await getFlatPage(slug) : null;
  if (!page && !flatPage) {
    return notFound();
  }

  const title = page?.title ?? flatPage?.title;
  const description = page?.seo_description ?? `${title} - Newsworthy`;

  return {
    title,
    description,
    openGraph: {
      title: title!,
      description,
      images: [
        {
          url: "/nw-social-image.jpg",
          width: 1200,
          height: 630,
        },
        {
          url: "/nw-social-image.jpg",
          width: 1200,
          height: 675,
        },
        {
          url: "/nw-social-image.jpg",
          width: 800,
          height: 418,
        },
      ],
    },
  };
}

// Sanity stores some select fields as arrays — unwrap to get the string value
function sanityValue(field: string | string[] | undefined): string | undefined {
  if (Array.isArray(field)) return field[0];
  return field;
}

const portableTextComponents = {
  types: {
    image: PortableTextImageComponent,
    bannerAdEmbed: BannerAdEmbedComponent,
  },
  marks: {
    link: ({ value, children }: { value?: { href?: string }; children: React.ReactNode }) => {
      const target = (value?.href || "").startsWith("http")
        ? "_blank"
        : undefined;
      return (
        <a
          className="text-cyan-700 hover:text-cyan-600 transition-colors"
          href={value?.href}
          target={target}
          rel={target === "_blank" ? "noopener noreferrer" : undefined}
        >
          {children}
        </a>
      );
    },
  },
};

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) {
    const flatPage = await getFlatPage(slug);
    if (!flatPage) {
      return notFound();
    }
    return (
      <div className="pb-16">
        <div className="border-b border-gray-100 bg-gray-50/50">
          <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8 py-8 lg:py-12">
            {flatPage.title && (
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                {flatPage.title}
              </h1>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8 mt-8">
          <div className="max-w-3xl prose prose-gray prose-headings:font-serif prose-headings:font-semibold prose-p:text-gray-600 prose-p:leading-relaxed prose-a:text-cyan-700 prose-a:no-underline hover:prose-a:text-cyan-600 prose-strong:text-gray-900">
            <PortableText value={flatPage.content} components={portableTextComponents} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16">
      {/* Hero */}
      <section className={cn("relative overflow-hidden", page.hero_background_css)}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_60%)]" />
        <div className="relative mx-auto w-full lg:max-w-4xl xl:max-w-5xl px-5 py-14 lg:py-24 text-center flex flex-col items-center gap-5">
          {page.hero_headline && (
            <h1 className="font-serif font-semibold text-4xl lg:text-5xl leading-tight text-white">
              {page.hero_headline}
            </h1>
          )}
          {page.hero_text && (
            <div className="max-w-2xl prose prose-p:text-lg lg:prose-p:text-xl prose-p:text-white/85 prose-p:leading-relaxed">
              <PortableText value={page.hero_text} />
            </div>
          )}
          {page.hero_cta && (
            <Link
              href={page.hero_cta.cta_link}
              className={cn(
                "mt-2 inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/30 px-7 py-3 text-base font-semibold text-white transition-all hover:bg-white/25 hover:shadow-lg hover:shadow-white/10",
                page.hero_button_css
              )}
            >
              {page.hero_cta.cta_text}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          )}
        </div>
      </section>

      {/* Page content (above) */}
      {page.pageContent &&
        page.pageContent.pageContentPlacement === "above" && (
          <section className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8 py-10 lg:py-14">
            {page.pageContent.pageContentHeadline && (
              <h2 className="text-3xl font-serif font-semibold text-gray-900 mb-6">
                {page.pageContent.pageContentHeadline}
              </h2>
            )}
            {page.pageContent.formattedPageContent && (
              <div className="max-w-none prose prose-gray prose-p:text-lg prose-p:leading-relaxed prose-li:text-lg prose-a:text-cyan-700 prose-a:no-underline hover:prose-a:text-cyan-600 page-content">
                <PortableText
                  value={page.pageContent.formattedPageContent}
                  components={portableTextComponents}
                />
              </div>
            )}
          </section>
        )}

      {/* Content sections */}
      {page.content_sections &&
        page.content_sections.map((section, index) => {
          if (sanityValue(section.section_type) === "band") {
            return (
              <section key={section._id} className="bg-gray-50 border-y border-gray-100">
                {section.sectionImage ? (
                  /* Testimonial-style: circle image left, quote right, centered */
                  <div className="mx-auto w-full max-w-4xl flex flex-col md:flex-row items-center gap-8 px-5 lg:px-8 py-12 lg:py-16">
                    <div className="shrink-0">
                      <div className="w-[120px] h-[120px] rounded-full overflow-hidden bg-gray-100 ring-4 ring-white shadow-sm">
                        <Image
                          className="w-full h-full object-cover"
                          src={urlFor(section.sectionImage.asset)}
                          alt={section.sectionImage.alt || ""}
                          width={240}
                          height={240}
                        />
                      </div>
                    </div>
                    <div>
                      {section.headline && (
                        <p className="text-base font-semibold text-gray-900">
                          {section.headline}
                        </p>
                      )}
                      {section.content && (
                        <div className="mt-2 prose prose-gray prose-p:text-base prose-p:leading-relaxed prose-blockquote:border-cyan-600 prose-blockquote:text-gray-600 prose-blockquote:font-normal">
                          <PortableText value={section.content} components={portableTextComponents} />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Regular band: full-width content */
                  <div className="mx-auto w-full max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8 py-10 lg:py-14">
                    {section.headline && (
                      <h2 className="text-2xl lg:text-3xl font-serif font-semibold text-gray-900">
                        {section.headline}
                      </h2>
                    )}
                    {section.content && (
                      <div className="mt-4 prose prose-gray prose-p:text-lg prose-p:leading-relaxed">
                        <PortableText value={section.content} components={portableTextComponents} />
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          }

          const imageType = section.sectionImage ? sanityValue(section.sectionImage.image_type) : undefined;

          // Circle image sections → handled inline with alternating layout below

          // Rectangle image sections → alternating left/right layout
          const isEven = index % 2 === 0;
          return (
            <section
              key={section._id}
              className={cn(
                "py-10 lg:py-16",
                !isEven && (section.background_color || "bg-gray-50/50")
              )}
            >
              <div className={cn(
                "mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8",
                "flex flex-col gap-8 lg:gap-14",
                isEven ? "lg:flex-row" : "lg:flex-row-reverse"
              )}>
                {section._type === "content_section" && (
                  <>
                    {/* Text */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-4">
                      {section.headline && (
                        <h2 className="font-serif text-2xl lg:text-3xl text-gray-900 font-semibold leading-snug">
                          {section.headline}
                        </h2>
                      )}
                      {section.content && (
                        <div className="max-w-none prose prose-gray prose-p:text-lg prose-p:leading-relaxed prose-li:text-lg prose-a:text-cyan-700 hover:prose-a:text-cyan-600">
                          <PortableText value={section.content} components={portableTextComponents} />
                        </div>
                      )}
                      {section.sectionCta?.ctaLabel && (
                        <div className="mt-2">
                          <Link
                            href={section.sectionCta.ctaUrl}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-700 hover:text-cyan-600 transition-colors"
                          >
                            {section.sectionCta.ctaLabel}
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                            </svg>
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Image */}
                    {section.sectionImage && (
                      <div className={cn("flex items-center justify-center", imageType === "circle" ? "shrink-0" : "flex-1")}>
                        {imageType === "circle" ? (
                          <div className="w-[220px] h-[220px] lg:w-[280px] lg:h-[280px] rounded-full overflow-hidden bg-gray-100">
                            <Image
                              className="w-full h-full object-cover"
                              src={urlFor(section.sectionImage.asset)}
                              alt={section.sectionImage.alt || ""}
                              width={560}
                              height={560}
                            />
                          </div>
                        ) : (
                          <div className="w-full rounded-xl overflow-hidden bg-gray-100">
                            <Image
                              className="w-full aspect-[16/10] object-cover"
                              src={urlFor(section.sectionImage.asset)}
                              alt={section.sectionImage.alt || ""}
                              width={1200}
                              height={750}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          );
        })}

      {/* Testimonials */}
      {page.primary_testimonial && page.primary_testimonial.length > 0 && (
        <section className="border-t border-gray-100">
          <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8 py-12 lg:py-16">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-8">
              Trusted by teams everywhere
            </p>
            <div className={cn(
              "grid gap-8",
              page.primary_testimonial.length === 1 && "max-w-xl mx-auto",
              page.primary_testimonial.length === 2 && "md:grid-cols-2 max-w-3xl mx-auto",
              page.primary_testimonial.length >= 3 && "md:grid-cols-2 lg:grid-cols-3",
            )}>
              {page.primary_testimonial.map((testimonial) => (
                <figure key={testimonial._id} className="flex flex-col gap-4">
                  <blockquote className="text-gray-600 text-base leading-relaxed">
                    &ldquo;{testimonial.quote}&rdquo;
                  </blockquote>
                  <figcaption className="flex items-center gap-2.5 mt-auto">
                    {testimonial.image && (
                      <div className="h-8 w-8 shrink-0 rounded-full overflow-hidden bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="h-full w-full object-cover"
                          src={urlFor(testimonial.image.asset)}
                          alt={testimonial.image.alt || testimonial.person}
                        />
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {testimonial.person}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Card sections */}
      {page.card_sections && page.card_sections.length > 0 && (
        <section className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8 py-12 lg:py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {page.card_sections.map((card) => (
              <div
                key={card._id}
                className="group rounded-xl border border-gray-100 bg-white p-6 transition-all hover:shadow-lg hover:shadow-gray-200/50 hover:border-gray-200"
              >
                {card.sectionImage && (
                  <div className="rounded-lg overflow-hidden bg-gray-100 mb-4 aspect-[16/10]">
                    <Image
                      className="w-full h-full object-cover"
                      src={urlFor(card.sectionImage.asset)}
                      alt={card.sectionImage.alt || ""}
                      width={600}
                      height={375}
                    />
                  </div>
                )}
                {card.headline && (
                  <h3 className="font-serif text-lg font-semibold text-gray-900 leading-snug">
                    {card.headline}
                  </h3>
                )}
                {card.content && (
                  <div className="mt-2 prose prose-sm prose-gray prose-p:leading-relaxed">
                    <PortableText value={card.content} components={portableTextComponents} />
                  </div>
                )}
                {card.sectionCta?.ctaLabel && (
                  <Link
                    href={card.sectionCta.ctaUrl}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-700 hover:text-cyan-600 transition-colors"
                  >
                    {card.sectionCta.ctaLabel}
                    <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Page content (below) */}
      {page.pageContent &&
        page.pageContent.pageContentPlacement === "below" && (
          <section className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8 py-10 lg:py-14">
            {page.pageContent.pageContentHeadline && (
              <h2 className="text-3xl font-serif font-semibold text-gray-900 mb-6">
                {page.pageContent.pageContentHeadline}
              </h2>
            )}
            {page.pageContent.formattedPageContent && (
              <div className="max-w-none prose prose-gray prose-p:text-lg prose-p:leading-relaxed prose-li:text-lg prose-a:text-cyan-700 prose-a:no-underline hover:prose-a:text-cyan-600 page-content">
                <PortableText
                  value={page.pageContent.formattedPageContent}
                  components={portableTextComponents}
                />
              </div>
            )}
          </section>
        )}
    </div>
  );
}
