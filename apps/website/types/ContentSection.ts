import { PortableTextBlock } from "sanity";
import { SectionCta } from "./SectionCta";

export type ContentSection = {
  _id: string;
  _type: string;
  _createdAt: Date;
  headline: string;
  slug: {
    current: string;
  };
  centered_content: boolean;
  content: PortableTextBlock[];
  section_type: string;
  sectionCta: {
    ctaLabel: string;
    ctaUrl: string;
  };
  sectionImage: {
    asset: {
      url: string;
    };
    image_type: string;
    alt: string;
    credit: string;
  };
  background_color: string;
};
