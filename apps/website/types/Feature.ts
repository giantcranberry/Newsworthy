import { PortableTextBlock } from 'sanity'

export type Feature = {
    id: string;
    title: string;
    slug: {
        current: string;
    }
    featureType: string;
    siteId: string;
    textContent: string;
    formattedContent: PortableTextBlock[];
}