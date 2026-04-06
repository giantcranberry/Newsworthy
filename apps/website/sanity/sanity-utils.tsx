import React from "react";
import { createClient, groq } from "next-sanity";
import clientConfig from "./config/client-config";
import { Post, SitemapUrlSanity } from "@/types/Post";
import { Page } from "@/types/Page";
import imageUrlBuilder from "@sanity/image-url";

import { SanityImageSource } from "@sanity/image-url/lib/types/types";
import { Author } from "@/types/Author";
import { Category } from "@/types/Category";
import { ContentSection } from "@/types/ContentSection";
import { FlatPage } from "@/types/FlatPage";
import { SiteAd } from "@/types/SiteAd";
import { Navbar } from "@/types/Navbar";
import { Feature } from "@/types/Feature";

const builder = imageUrlBuilder(clientConfig);

export function urlFor(source: SanityImageSource): string {
	return builder.image(source).url();
}

export async function getAuthorBySlug(slug: string): Promise<Author> {
	return createClient(clientConfig).fetch(
		groq`*[_type == "author" && slug.current == $slug][0] {
        _id,
        _ref,
        name,
        image,
        slug, 
        "posts": *[_type == "post" && author._ref in *[_type=="author" && slug.current == $slug ]._id ][]{
        "coverImage": coverImage.asset->url,
        slug,
        headline,
        excerpt,
        publishedAt,
        "slug": slug.current,
      }
    }`,
		{ slug: slug }
	);
}

export async function getCategoryBySlug(slug: string): Promise<Category> {
	return createClient(clientConfig).fetch(
		groq`*[_type == "category" && slug.current == $slug][0] {
        _id,
        _ref,
        ...,
        "posts": *[_type == "post" && category._ref in *[_type=="category" && slug.current == $slug ]._id ][]{
        "coverImage": coverImage.asset->url,
        slug,
        headline,
        excerpt,
        publishedAt,
        "slug": slug.current,
      }
    }`,
		{ slug: slug }
	);
}

export async function getCategorySections(
	section_slugs: string[]
): Promise<ContentSection[]> {
	let data = await createClient(clientConfig).fetch(
		groq`*[_type == "content_section" && slug.current in $section_slugs] {
        _id,
        _createdAt,
        ...,
        content,
    }`,
		{ section_slugs }
	);

	data.sort((a: ContentSection, b: ContentSection) => {
		const indexA = section_slugs.indexOf(a.slug.current);
		const indexB = section_slugs.indexOf(b.slug.current);
		return indexA - indexB;
	});
	return data;
}

export async function getFeatures(feature_type: string): Promise<Feature[]> {
	return createClient(clientConfig).fetch(
		groq`*[_type == "feature" && featureType == $feature_type && siteId=="newsworthy" ] {
        ...,
    }`,
		{ feature_type }
	);
}

export async function getPages(): Promise<Page[]> {
	return createClient(clientConfig).fetch(
		groq`*[_type == "page" && sortOrder < 99 ] | order(sortOrder asc)  {
        _id,
        _createdAt,
        title,
        "slug": slug.current,
        content,
        hero_background_css,
        hero_button_css,
    }`
	);
}

export async function getPage(slug: string): Promise<Page> {
	return createClient(clientConfig).fetch(
		groq`*[_type == "page" && slug.current == $slug][0] {
        _id,
        _createdAt,
        ...,
        "feature_sections": feature_sections[]{ heading, icon, features[]-> },
        "content_sections": content_sections[]->,
        "card_sections": card_sections[]->,
        "primary_testimonial": primary_testimonial[]->,
    }`,
		{ slug: slug }
	);
}

export async function getFeaturedPost(): Promise<Post> {
	return createClient(clientConfig).fetch(
		groq`*[_type == "post" && dateTime(featureOn) <= dateTime(now()) ]  | order(featureOn desc) [0] {
        ..., 
        author->,
        categories[]->,
    }`
	);
}

export async function getFlatPage(slug: string): Promise<FlatPage> {
	return createClient(clientConfig).fetch(
		groq`*[_type == "flatpage" && slug.current == $slug][0] {
        _id,
        _createdAt,
        ...,    
        }`,
		{ slug: slug }
	);
}

export async function getNavBarSectionBySlug(slug: string): Promise<Navbar> {
	return createClient(clientConfig).fetch(
		groq`*[_type == "navbar" && slug.current == $slug][0] {
        _id,
        _createdAt,
        pages[]->,
    }`,
		{ slug: slug }
	);
}

export async function getPosts(): Promise<Post[]> {
	return createClient(clientConfig).fetch(
		groq`*[_type == "post" && dateTime(publishedAt) <= dateTime(now()) ]  | order(publishedAt desc)  {
        ..., 
        "imageUrl": coverImage.asset->url,
        author->,
        categories[]->,
    }`
	);
}

export async function getSitemapSanityUrls(
	collection: string
): Promise<SitemapUrlSanity[]> {
	return createClient(clientConfig).fetch(
		groq`*[_type == $collection && dateTime(_updatedAt) <= dateTime(now()) && (siteId == 'newsworthy' || siteId == 'all')]  | order(_updatedAt desc)  {
        slug,
        _updatedAt, 
    }`,
		{ collection }
	);
}

export async function getPostBySlug(slug: string): Promise<Post> {
	return createClient(clientConfig).fetch(
		groq`*[_type == "post" && slug.current == $slug][0] {
        ..., 
        author->,
        category->,
    }`,
		{ slug: slug }
	);
}

export async function getSiteAdBySlug(slug: string): Promise<SiteAd> {
	return createClient(clientConfig).fetch(
		groq`*[_type == "site_ad" && slug.current == $slug][0] {
        _id,
        _createdAt,
        ...,
    }`,
		{ slug: slug }
	);
}
