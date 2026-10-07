-- Blog PR: blog RSS/Atom feeds and posts, plus the four credit products.
-- Mirrors Podcast PR (podcast_feeds / podcast_episodes / product_type podcast_pr).
-- Blog posts store the article body. There is no transcript table.
-- releases.source = 'blog' already fits varchar(16). No ALTER on releases.
-- product_type 'blog_pr' fits products.product_type varchar(12) and brand_credits.product_type varchar(36).
--
-- Run with: psql "$DIRECT_DATABASE_URL" -f apps/dashboard/drizzle/manual/2026-10-06-blog-pr.sql
-- Do not drop tables. Review before running.

CREATE TABLE IF NOT EXISTS blog_feeds (
  id serial PRIMARY KEY,
  uuid varchar(36) NOT NULL UNIQUE,
  company_id integer NOT NULL REFERENCES company(id),
  user_id integer NOT NULL REFERENCES users(id),
  feed_url text NOT NULL,
  title varchar(255),
  description text,
  image_url text,
  author varchar(255),
  language varchar(16),
  link text,
  category varchar(128),
  last_fetched_at timestamp,
  last_post_published_at timestamp,
  fetch_error text,
  is_active boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  notify_email boolean NOT NULL DEFAULT true,
  notify_email_to text,
  notify_sms boolean NOT NULL DEFAULT false,
  notify_sms_phone varchar(30),
  notify_in_app boolean NOT NULL DEFAULT true,
  notify_slack boolean NOT NULL DEFAULT false,
  notify_slack_webhook_url text,
  notifications_saved_at timestamp,
  funding_warning_sent_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_feeds_company_live_uidx
  ON blog_feeds (company_id)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS blog_feeds_user_id_idx
  ON blog_feeds (user_id);

CREATE TABLE IF NOT EXISTS blog_posts (
  id serial PRIMARY KEY,
  uuid varchar(36) NOT NULL UNIQUE,
  feed_id integer NOT NULL REFERENCES blog_feeds(id) ON DELETE CASCADE,
  guid varchar(512) NOT NULL,
  title varchar(512),
  summary text,
  content text,
  link text,
  image_url text,
  author varchar(255),
  published_at timestamp,
  skip boolean NOT NULL DEFAULT false,
  release_id integer REFERENCES releases(id),
  processed_at timestamp,
  generation_status varchar(20) NOT NULL DEFAULT 'pending',
  generation_error text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_feed_guid_uidx
  ON blog_posts (feed_id, guid);

CREATE INDEX IF NOT EXISTS blog_posts_feed_published_idx
  ON blog_posts (feed_id, published_at);

-- Same prices as Podcast PR. Credits are brand-specific and expire 2 years after purchase
-- (expiry is set when credits are granted, same as podcast_pr).
INSERT INTO products (
  short_name, display_name, description, label, icon,
  price, partner_share, product_type, product_credits,
  is_active, is_deleted, is_upgrade, is_solo_upgrade, sort_order
)
SELECT
  v.short_name, v.display_name, v.description, v.label, v.icon,
  v.price, 0, 'blog_pr', v.product_credits,
  true, false, false, false, v.sort_order
FROM (VALUES
  (
    'Blog 1',
    'Blog PR: Pay as you go',
    '1 blog press release credit. Generate and distribute one PR from a blog post. Credits valid for 2 years. Brand/blog specific. Credits must be used for this blog. Credits cannot be used for non-blog press releases.',
    'Single',
    'Newspaper',
    12900,
    1,
    10
  ),
  (
    'Blog 5',
    'Blog PR: 5 Pack',
    '5 blog press release credits at $105 each. Credits valid for 2 years. Brand/blog specific. Credits must be used for this blog. Credits cannot be used for non-blog press releases.',
    'Starter',
    'Newspaper',
    52500,
    5,
    15
  ),
  (
    'Blog 12',
    'Blog PR: 12 Pack',
    '12 blog press release credits at $79 each. Credits valid for 2 years. Brand/blog specific. Credits must be used for this blog. Credits cannot be used for non-blog press releases.',
    'Popular',
    'Newspaper',
    94800,
    12,
    20
  ),
  (
    'Blog 20',
    'Blog PR: 20 Pack',
    '20 blog press release credits at $65 each. Credits valid for 2 years. Brand/blog specific. Credits must be used for this blog. Credits cannot be used for non-blog press releases.',
    'Best Value',
    'Newspaper',
    130000,
    20,
    30
  )
) AS v(short_name, display_name, description, label, icon, price, product_credits, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM products p
  WHERE p.short_name = v.short_name AND p.product_type = 'blog_pr'
);
