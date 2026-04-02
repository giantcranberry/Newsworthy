import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  transpilePackages: ["@nwai/db"],
  serverExternalPackages: ["cheerio", "undici"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/rss-style.xsl",
        headers: [
          { key: "Content-Type", value: "text/xsl" },
          { key: "X-Robots-Tag", value: "data-ai: yes, index, follow" },
          { key: "X-Llm-Usage", value: "ai-training: allow" },
          { key: "X-Creative-Commons-License", value: "CC BY-NC 4.0" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Robots-Tag", value: "data-ai: yes, index, follow" },
          { key: "X-Llm-Usage", value: "ai-training: allow" },
          { key: "X-Creative-Commons-License", value: "CC BY-NC 4.0" },
          { key: "Link", value: '<https://www.newsworthy.ai/.well-known/agent-card.json>; rel="agent-card"' },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/feeds/rss/latest.rss",
        destination: "/rss/latest.xml",
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/stackspay",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/stackspay.net",
        permanent: true,
      },
      {
        source: "/featured-business",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/featured-business",
        permanent: true,
      },
      {
        source: "/featured-pro",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/featured-pro",
        permanent: true,
      },
      {
        source: "/featured",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/featured",
        permanent: true,
      },
      {
        source: "/blockchain/txn_detail/:id",
        destination: "/blockchain/txn-detail/:id",
        permanent: true,
      },
      {
        source: "/en/about/who-we-are",
        destination: "/welcome-to-newsworthy",
        permanent: true,
      },
      {
        source: "/en/about/why-we-are-different",
        destination: "/uniquely-newsworthy",
        permanent: true,
      },
      {
        source: "/en/about/influencer-marketplace/becoming-an-influencer",
        destination: "/press-release-distribution-meets-influencer-marketing",
        permanent: true,
      },
      {
        source: "/en/landing/become-an-influencer-partner",
        destination: "/press-release-distribution-meets-influencer-marketing",
        permanent: true,
      },
      {
        source: "/en/legal/editorial-guidelines",
        destination: "/editorial-guidelines",
        permanent: true,
      },
      {
        source: "/en/docs/newsworthy-feed-plugin-for-wordpress",
        destination: "/wordpress-plugin",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/newswriter",
        destination: "https://app.newsworthyai.com/auth/coregister/im/newswriter",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/newsworthy",
        destination: "https://app.newsworthyai.com/auth/coregister/im/newsworthy",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/newsworthy",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/newsworthy",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/newswriter",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/newswriter",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/weedweek",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/weedweek",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/weedweek",
        destination: "https://app.newsworthyai.com/auth/coregister/im/weedweek",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/talentculture",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/talentculture",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/talentculture",
        destination: "https://app.newsworthyai.com/auth/coregister/im/talentculture",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/hrtechalliances",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/hrtechalliances",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/hrtechalliances",
        destination: "https://app.newsworthyai.com/auth/coregister/im/hrtechalliances",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/cannabisradio",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/cannabisradio",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/cannabisradio",
        destination: "https://app.newsworthyai.com/auth/coregister/im/cannabisradio",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/hrtechnologyreport",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/hrtechnologyreport",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/hrtechnologyreport",
        destination: "https://app.newsworthyai.com/auth/coregister/im/hrtechnologyreport",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/recruitingdaily",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/recruitingdaily",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/recruitingdaily",
        destination: "https://app.newsworthyai.com/auth/coregister/im/recruitingdaily",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/advosio",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/advosio",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/advosio",
        destination: "https://app.newsworthyai.com/auth/coregister/im/advosio",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/hrvendornews",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/hrvendornews",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/hrvendornews",
        destination: "https://app.newsworthyai.com/auth/coregister/im/hrvendornews",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/redballoon",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/redballoon",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/redballoon",
        destination: "https://app.newsworthyai.com/auth/coregister/im/redballoon",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/salesnexus",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/salesnexus",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/salesnexus",
        destination: "https://app.newsworthyai.com/auth/coregister/im/salesnexus",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/sharedxpertise",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/sharedxpertise",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/sharedxpertise",
        destination: "https://app.newsworthyai.com/auth/coregister/im/sharedxpertise",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/thatconference",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/thatconference",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/thatconference",
        destination: "https://app.newsworthyai.com/auth/coregister/im/thatconference",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/shareworthy",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/shareworthy",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/shareworthy",
        destination: "https://app.newsworthyai.com/auth/coregister/im/shareworthy",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/canex",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/canex",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/canex",
        destination: "https://app.newsworthyai.com/auth/coregister/im/canex",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/cannacon",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/cannacon",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/cannacon",
        destination: "https://app.newsworthyai.com/auth/coregister/im/cannacon",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/hrcom",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/hrcom",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/letstalkhemp",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/letstalkhemp",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/letstalkhemp",
        destination: "https://app.newsworthyai.com/auth/coregister/im/letstalkhemp",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/miaminewtimes",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/miaminewtimes",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/miaminewtimes",
        destination: "https://app.newsworthyai.com/auth/coregister/im/miaminewtimes",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/microdose",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/microdose",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/microdose",
        destination: "https://app.newsworthyai.com/auth/coregister/im/microdose",
        permanent: true,
      },
      {
        source: "/auth/coregister/pr/myoutdesk",
        destination: "https://app.newsworthyai.com/auth/coregister/pr/myoutdesk",
        permanent: true,
      },
      {
        source: "/auth/coregister/im/myoutdesk",
        destination: "https://app.newsworthyai.com/auth/coregister/im/myoutdesk",
        permanent: true,
      },
      {
        source: "/auth/login",
        destination: "https://app.newsworthyai.com/login",
        permanent: true,
      },
      {
        source: "/feeds/content/financialcontent/newsworthy.rss",
        destination: "https://app.newsworthyai.com/feeds/content/financialcontent/newsworthy.rss",
        permanent: true,
      },
      {
        source: "/feeds/content/digitaljournal/newsworthy.rss",
        destination: "https://app.newsworthyai.com/feeds/content/digitaljournal/newsworthy.rss",
        permanent: true,
      },
      {
        source: "/feeds/content/gomedia/newsworthy.rss",
        destination: "https://app.newsworthyai.com/feeds/content/gomedia/newsworthy.rss",
        permanent: true,
      },
      {
        source: "/feeds/content/fc/newsworthy.rss",
        destination: "https://app.newsworthyai.com/feeds/content/fc/newsworthy.rss",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
