import {
  SiteMapData,
} from "@/types/Release";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, utcToZonedTime } from "date-fns-tz";
import { TranslatedNews } from "@/types/TranslatedNews";
import { DateTime } from "luxon";
import moment from "moment";
import "moment-timezone";
import crypto from "crypto";

type ContactType = "email" | "phone" | "unknown";

export const baseUrl = "https://www.newsworthy.ai";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function transformLink(url: string): string {
  const regex = /\[(.*?)\]\s?(http\S+)/;
  if (regex.test(url)) {
    // Extract keyword and actual URL
    const matches = regex.exec(url);
    if (matches) {
      const keyword = matches[1];
      const actualUrl = matches[2];
      return `<a href="${actualUrl}" class="text-sky-600 hover:underline">${keyword}</a>`;
    }
  }
  return url;
}

export function removeHtmlTags(input: string): string {
  const htmlTagsRegex = /<[^>]*>/g; // Matches any HTML tag
  return input.replace(htmlTagsRegex, ""); // Replace HTML tags with an empty string
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);

  const options: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    year: "numeric",
  };

  return date.toLocaleDateString("en-US", options);
}

export function sitemapUrl(release: SiteMapData, lang_code: string): string {
  const raw = release.release_datetime;

  // Check if releasedAt is undefined or null
  if (raw === undefined || raw === null) {
    return "";
  }

  const releasedAt = raw instanceof Date ? raw : new Date(raw);
  const year = releasedAt.getFullYear();
  const month = (releasedAt.getMonth() + 1).toString().padStart(2, "0");
  const day = releasedAt.getDate().toString().padStart(2, "0");
  const { id, slug } = release;

  if (lang_code === "en") {
    return `/news/${year}${month}${day}${id}/${slug}`;
  } else {
    return `/news/${lang_code}/${year}${month}${day}${id}/${slug}`;
  }
}

export function newsUrl(release: { id: number; slug: string | null; releasedAt: Date | null }): string {
  const releasedAt = release.releasedAt;

  // Check if releasedAt is undefined or null
  if (releasedAt === undefined || releasedAt === null) {
    return "";
  }

  const year = releasedAt.getFullYear();
  const month = (releasedAt.getMonth() + 1).toString().padStart(2, "0");
  const day = releasedAt.getDate().toString().padStart(2, "0");
  const { id, slug } = release;

  return `/news/${year}${month}${day}${id}/${slug}`;
}

export function newsTranslatedUrl(translation: TranslatedNews): string {
  const releasedAt = translation.releaseAt;
  const languageCode = translation.languageCode;
  const id = translation.prId;

  // Check if releasedAt is undefined or null
  if (releasedAt === undefined || releasedAt === null) {
    return "";
  }

  const year = releasedAt.getFullYear();
  const month = (releasedAt.getMonth() + 1).toString().padStart(2, "0");
  const day = releasedAt.getDate().toString().padStart(2, "0");
  const { slug } = translation;

  return `/news/${languageCode}/${year}${month}${day}${id}/${slug}`;
}

export function replaceResizeWithWidth(str: string, width: number): string {
  // Replace 'RESIZE' with 'resize=w:n'
  return str.replace(/RESIZE/g, `resize=w:${width}`);
}

export function getDateline(
  release_at: Date | null,
  location: string,
  timezone: string,
): string {
  if (!release_at) {
    return "";
  }

  const momentDate = moment.tz(release_at, timezone);
  const formattedDate = momentDate.format("dddd MMM D, YYYY @ h:mm A z");

  return `${location} (Newsworthy.ai) ${formattedDate} —`;
}
export function formatTextWithPTags(text: string) {
  const paragraphs = text.split("\n");
  return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
}

export function convertRelatedLinksToList(linksString: string): string {
  const links = linksString.split("<br>").map((link) => link.trim());

  const listItems = links.map((link) => {
    if (!link.startsWith("http://") && !link.startsWith("https://")) {
      link = `https://${link}`;
    }
    return `<li><a href="${link}" class="hover:underline hover:text-sky-600">${link}</a></li>`;
  });

  if (listItems.length === 0) {
    return "";
  }

  return `<ul>${listItems.join("")}</ul>`;
}

export function separateNewsByLanguage(news: TranslatedNews[]): Record<string, TranslatedNews[]> {
  const result: Record<string, TranslatedNews[]> = {};

  for (const item of news) {
    const { languageCode } = item;
    // Skip items with null languageCode
    if (!languageCode) continue;

    if (!result[languageCode]) {
      result[languageCode] = [];
    }
    result[languageCode].push(item);
  }

  return result;
}

export function formatDateForSitemap(
  date: Date = new Date(),
  timeZoneName: string = "UTC",
) {
  const timeZone = DateTime.fromJSDate(date, { zone: timeZoneName });
  return timeZone.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ");
}

export function computeLastMod(year: number, month: number) {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // Months are zero-based

  if (year === currentYear && month < currentMonth) {
    const lastDay = new Date(year, month, 0).getDate();
    const lastModDate = new Date(year, month - 1, lastDay);
    return formatDateForSitemap(lastModDate);
  } else if (year === currentYear && month === currentMonth) {
    return formatDateForSitemap(currentDate);
  } else {
    const lastDay = new Date(year, month - 1, 0).getDate();
    const lastModDate = new Date(year, month - 2, lastDay);
    return formatDateForSitemap(lastModDate);
  }
}

export const identifyContactType = (str: string): ContactType => {
  // Regex pattern for email
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // Regex pattern for phone number
  // This is a simple example; phone number formats can vary widely
  const phonePattern = /^\+?[0-9]{10,15}$/;

  if (emailPattern.test(str)) {
    return "email";
  } else if (phonePattern.test(str)) {
    return "phone";
  } else {
    return "unknown";
  }
};

export function sanitizePhoneNumber(phone: string): string {
  // Remove all characters that are not digits
  const sanitized = phone.replace(/\D/g, "");

  // Prepend with appropriate prefix
  if (sanitized.startsWith("1")) {
    return sanitized;
  } else {
    return "1" + sanitized;
  }
}

// export function createMD5Hash(input: string): string {
//     const hash = crypto.createHash("md5");
//     hash.update(input);
//     return hash.digest("hex");
// }

export function createMD5Hash(input: string): string {
  const hash = crypto.createHash("md5");
  // Explicitly create a Buffer from the input string, specifying UTF-8 encoding
  const inputBuffer = Buffer.from(input, "utf-8");
  hash.update(inputBuffer);
  return hash.digest("hex");
}
