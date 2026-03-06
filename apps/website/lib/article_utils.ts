import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import moment from "moment";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCurrentDateFormatted(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0"); // Months are zero-based
  const day = date.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getYesterdayDateFormatted(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

export function formatDateString(dateString: string): string {
  return moment(dateString).format("MMMM Do, YYYY h:mm A");
}

export function escapeHtml(unsafeString: string): string {
  return unsafeString
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function slugify(headline: string): string {
  // Convert the headline to lowercase
  let slug = headline.toLowerCase();

  // Replace spaces and special characters with hyphens
  slug = slug.replace(/[\s\W-]+/g, "-");

  // Trim the slug to a maximum length of 48 characters
  if (slug.length > 64) {
    slug = slug.substring(0, 64);
  }

  // Remove any trailing hyphens
  slug = slug.replace(/-+$/g, "");

  return slug;
}

export function getFeedItemIdFromUrl(input: string): number {
  // Extract everything from the 5th character onward
  const substring = input.substring(4);

  // Convert the substring to a number
  return Number(substring);
}
