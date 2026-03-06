export interface Article {
  feed_item_id: number;
  md5_permalink: string;
  site_handle: string;
  headline: string;
  content: string;
  enclosure: string;
  summary: string;
  published: string;
  link: string;
  seo_description: string;
  newsramp_url: string;
  site_name: string;
  site_url: string;
}

export type ArticleSiteMapData = {
  id: number;
  released_at: Date;
  title: string;
};

export interface ArticleSitemaps {
  feed_item_id: number;
  md5_permalink: string;
  site_handle: string;
  headline: string;
  content: string;
  enclosure: string;
  summary: string;
  published: string;
  link: string;
  seo_description: string;
  newsramp_url: string;
  site_name: string;
  site_url: string;
}

export interface ArticleSingle {
  feed_item_id: number;
  md5_permalink: string;
  site_handle: string;
  link: string;
  headline: string;
  content: string;
  enclosure: string;
  summary: string;
  published: string;
  seo_description: string;
  site_name: string;
  site_url: string;
}
