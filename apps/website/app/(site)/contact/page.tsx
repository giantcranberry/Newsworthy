import BigSocialIcons from "@/components/big_social_icons";
import ContactInfo from "@/components/contact-info";
import ContactForm from "@/components/forms/contact_form";
import { cn } from "@/lib/utils";
import { getPage } from "@/sanity/sanity-utils";
import { PortableText } from "@portabletext/react";
import Link from "next/link";

export default async function ContactPage() {
    const page = await getPage("contact-us");
    return (
        <div className="mt-5">
            <div className={page.hero_background_css}>
                <div className="w-full mx-auto lg:max-w-5xl py-20 text-center flex flex-col items-center gap-5">
                    {page.hero_headline && (
                        <h1 className="font-serif font-semibold md:text-4xl 2xl:text-5xl m-0 text-white">
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
                            className={cn("rounded bg-cyan-900 text-white font-bold px-5 py-3", page.hero_button_css)}
                        >
                            {page.hero_cta.cta_text}
                        </Link>
                    )}
                </div>
            </div>

            <div className="mx-auto w-full lg:max-w-screen-lg xl:max-w-screen-xl grid grid-cols-1 lg:grid-cols-2 lg:gap-20 py-5 px-5">
                <div>
                    <h2 className="text-3xl font-bold mb-3">Contact Us</h2>
                    <ContactForm />
                </div>
                <div className="max-w-none prose prose-lg md:prose-xl pb-5 md:pt-5 px-20 md:px-10 prose-img:my-0 prose-img:py-0">
                    <ContactInfo />

                    <div>
                        <h2 className="text-3xl text-center my-10">Follow Us</h2>
                        <BigSocialIcons />
                    </div>
                </div>
            </div>
        </div>
    );
}
