import { PortableTextImageComponent } from "@/components/portable_text_component";
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
  // fetch data
  const page = await getPage(slug);
  const flatPage = !page ? await getFlatPage(slug) : null;
  if (!page && !flatPage) {
    return notFound();
  }

  const title = page?.title ?? flatPage?.title;

  return {
    title,
    description: page?.seo_description,
    openGraph: {
      title: title!,
      description: page?.seo_description ?? "",
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

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) {
    const flatPage = await getFlatPage(slug);
    if (!flatPage) {
      return notFound();
    }
    return (
      <div className="mx-auto w-full max-w-screen-xl xl:max-w-screen-2xl px-5 py-5">
        <div className="prose mt-10 max-w-none prose-headings:font-serif prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl prose-h4:text-xl prose-headings:font-normal prose-strong:font-bold">
          {flatPage.title && (
            <h1 className="text-4xl font-serif font-semibold">{flatPage.title}</h1>
          )}
          <PortableText value={flatPage.content} />
        </div>
      </div>
    );
  }

  return (
    <>
      <section className={page.hero_background_css}>
        <div className="mx-auto w-full lg:max-w-4xl xl:max-w-5xl px-5 py-10 lg:py-20 text-center flex flex-col items-center gap-5">
          {page.hero_headline && (
            <h1 className="font-serif font-semibold text-4xl 2xl:text-5xl m-0 text-white">
              {page.hero_headline}
            </h1>
          )}
          {page.hero_text && (
            <div className="font-sans prose-p:text-lg prose-p:lg:text-xl text-white">
              <PortableText value={page.hero_text} />
            </div>
          )}
          {page.hero_cta && (
            <Link
              href={page.hero_cta.cta_link}
              className={cn(
                "rounded bg-cyan-900 text-white font-bold px-5 py-3",
                page.hero_button_css
              )}
            >
              {page.hero_cta.cta_text}
            </Link>
          )}
        </div>
      </section>

      {page.pageContent &&
        page.pageContent.pageContentPlacement === "above" && (
          <>
            <section className="mx-auto max-w-screen-xl xl:max-w-screen-2xl mt-5 px-5 relative pb-10">
              {page.pageContent.pageContentHeadline && (
                <h2 className="text-3xl font-serif font-semibold text-gray-950 mb-3">
                  {page.pageContent.pageContentHeadline}
                </h2>
              )}
              {page.pageContent.formattedPageContent && (
                <div className="max-w-none prose prose-headings:font-serif prose-p:text-lg md:prose-p:text-md lg:prose-p:text-lg prose-li:text-lg prose-a:text-sky-800 page-content">
                  <PortableText
                    value={page.pageContent.formattedPageContent}
                    components={{
                      // ...
                      types: {
                        image: PortableTextImageComponent,
                      },
                      marks: {
                        link: ({ value, children }) => {
                          const target = (value?.href || "").startsWith("http")
                            ? "_blank"
                            : undefined;
                          return (
                            <a
                              className="hover:text-sky-500"
                              href={value?.href}
                              target={target}
                            >
                              {children}
                            </a>
                          );
                        },
                      },
                    }}
                  />
                </div>
              )}
            </section>
          </>
        )}

      {page.content_sections &&
        page.content_sections.map((section, index) => {
          if (section.section_type == "band") {
            return (
              <section key={section._id} className="bg-teal-800/30 py-5">
                <div className="mx-auto w-full max-w-screen-xl xl:max-w-screen-2xl flex flex-col-reverse md:flex-row md:gap-10 px-10">
                  <div>
                    {section.headline && (
                      <h2 className="text-teal-800 text-3xl lg:text-4xl font-serif font-semibold">
                        {section.headline}
                      </h2>
                    )}
                    {section.content && (
                      <div className="prose prose-blockquote:text-teal-800 prose-p:text-teal-800 text-xl lg:text-xl prose:font-san pt-5">
                        <PortableText value={section.content} />
                      </div>
                    )}
                  </div>
                  {section.sectionImage && (
                    <div className="md:flex justify-center">
                      <div className="flex justify-center overflow-hidden w-[200px] h-[200px] rounded-full">
                        <Image
                          className="object-cover"
                          src={
                            section.sectionImage &&
                            urlFor(section.sectionImage.asset)
                          }
                          alt={section.sectionImage && section.sectionImage.alt}
                          width={250}
                          height={250}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          }
          if (index % 2 === 0) {
            // odd number sections
            return (
              <section
                key={section._id}
                className="flex flex-col-reverse lg:grid lg:grid-cols-2 gap-10 mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 py-10 mb-0 md:px-10 lg:px-0"
              >
                {section._type === "content_section" && (
                  <>
                    <div className="flex flex-col items-start gap-5 px-5 lg:px-7 md:px-0 md:pb-0">
                      {section.headline && (
                        <h2 className="font-serif text-3xl lg:text-3xl text-gray-950 font-semibold">
                          {section.headline}
                        </h2>
                      )}
                      {section.content && (
                        <div className="max-w-none prose prose-p:text-lg md:prose-p:text-md lg:prose-p:text-lg prose-li:text-lg prose-a:text-sky-800 prose-a:hover:text-sky-600">
                          <PortableText value={section.content} />
                        </div>
                      )}
                    </div>
                    {section.sectionImage && (
                      <div className="md:flex justify-center items-center">
                        {section.sectionImage.image_type == "circle" ? (
                          <div className="flex justify-center overflow-hidden w-[300px] h-[300px] rounded-full">
                            <Image
                              className="object-cover"
                              src={urlFor(section.sectionImage.asset)}
                              alt={section.sectionImage.alt}
                              width={1200}
                              height={464}
                            />
                          </div>
                        ) : (
                          <div>
                            <Image
                              className="w-full md:w-[435px] md:h-[321px] xl:w-[635px] xl:h-[421px] object-cover rounded"
                              src={urlFor(section.sectionImage.asset)}
                              alt={section.sectionImage.alt}
                              width={1200}
                              height={464}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          } else {
            return (
              <section
                key={section._id}
                className={`${section.background_color} md:my-20 px-10 lg:px-0 py-20`}
              >
                <div className="flex flex-col lg:grid lg:grid-cols-2 gap-10 mx-auto max-w-screen-xl xl:max-w-screen-2xl">
                  {section._type === "content_section" && (
                    <>
                      {section.sectionImage && (
                        <div className="md:flex justify-center items-center">
                          {section.sectionImage.image_type == "circle" ? (
                            <div className="flex justify-center overflow-hidden w-[300px] h-[300px] rounded-full float-right">
                              <Image
                                className="object-cover"
                                src={urlFor(section.sectionImage.asset)}
                                alt={section.sectionImage.alt}
                                width={1200}
                                height={464}
                              />
                            </div>
                          ) : (
                            <div>
                              <Image
                                className="w-full md:w-[435px] md:h-[321px] xl:w-[635px] xl:h-[421px] object-cover rounded"
                                src={urlFor(section.sectionImage.asset)}
                                alt={section.sectionImage.alt}
                                width={1200}
                                height={464}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      {section.sectionImage && section.content && (
                        <div className="flex flex-col items-start gap-5 px-5 lg:px-7 pb-5 md:px-0 md:pb-0">
                          <h2 className="font-serif text-3xl lg:text-3xl text-gray-950 font-semibold m-0">
                            {section.headline}
                          </h2>
                          <div className="max-w-none prose prose-p:text-lg md:prose-p:text-md lg:prose-p:text-lg prose-li:text-lg prose-a:text-sky-800 prose-a:hover:text-sky-600">
                            <PortableText value={section.content} />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>
            );
          }
        })}

      {page.pageContent &&
        page.pageContent.pageContentPlacement === "below" && (
          <>
            <section className="mx-auto max-w-screen-xl xl:max-w-screen-2xl mt-5 md:mt-10 px-5 relative">
              {page.pageContent.pageContentHeadline && (
                <h2 className="text-3xl font-serif font-semibold text-gray-950 mb-3">
                  {page.pageContent.pageContentHeadline}
                </h2>
              )}
              {page.pageContent.formattedPageContent && (
                <div className="max-w-none prose prose-p:text-lg md:prose-p:text-md lg:prose-p:text-lg prose-li:text-lg prose-a:text-sky-600 page-content">
                  <PortableText
                    value={page.pageContent.formattedPageContent}
                    components={{
                      // ...
                      types: {
                        image: PortableTextImageComponent,
                      },
                      marks: {
                        link: ({ value, children }) => {
                          const target = (value?.href || "").startsWith("http")
                            ? "_blank"
                            : undefined;
                          return (
                            <a
                              className="hover:text-sky-500"
                              href={value?.href}
                              target={target}
                            >
                              {children}
                            </a>
                          );
                        },
                      },
                    }}
                  />
                </div>
              )}
            </section>
          </>
        )}
    </>
  );
}
