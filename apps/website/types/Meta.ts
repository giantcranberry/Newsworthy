// In your Meta.ts file
export type PodcastEpisode = {
  episode_md5: string;
  title?: string;
  description?: string;
  published_at?: string;
  audio_url?: string;
};

export interface PodcastMeta {
  title: string;
  artwork: string;
  podcast: string;
  episode_md5: string;
  episode_slug: string;
}

export interface SiteMetaJson {
  podcasts: PodcastEpisode[]; // Changed from Record<string, PodcastMeta>[]
  audio: string;
  reddit: string;
  substack: string | null;
  site_id: number;
  linkedin: string;
  github: string;
  telegram: string;
  mastodon: string | null;
  bluesky: string | null;
  x: string | null;
  published: string;
  site_handle: string;
  feed_item_id: number;
  newsramp_url: string;
  md5_permalink: string; // Changed from string[] to match actual data
  podcast_segment_url: string;
}

export interface SiteMetaData {
  feed_item_id: number;
  md5_permalink: string;
  meta_json: string;
}
