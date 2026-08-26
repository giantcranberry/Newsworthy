/** Loose match so middleware can skip obvious browsers without a full classify. */
export const LIKELY_BOT_UA =
  /bot|spider|crawler|crawl|slurp|fetcher|gpt|claude|anthropic|bytespider|cohere|perplexity|diffbot|amazonbot|youbot|semrush|ahrefs|dotbot|mj12|petal|sogou|bingpreview|google|yandex|baidu|duckduck|facebook|meta-external|oai-|chatgpt|ccbot|ai2bot|firecrawl/i
