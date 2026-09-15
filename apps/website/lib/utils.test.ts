import { test, expect } from "bun:test";
import { META_DESCRIPTION_MAX_LENGTH, metaDescription } from "./utils";

test("returns empty string for nullish input", () => {
  expect(metaDescription(null)).toBe("");
  expect(metaDescription(undefined)).toBe("");
});

test("leaves short descriptions unchanged", () => {
  expect(metaDescription("A short meta description.")).toBe(
    "A short meta description.",
  );
});

test("strips HTML and collapses whitespace", () => {
  expect(metaDescription("<p>Hello   <strong>world</strong></p>")).toBe(
    "Hello world",
  );
});

test("hard-caps at 160 characters regardless of db length", () => {
  const long = "a".repeat(400);
  const result = metaDescription(long);
  expect(result.length).toBe(META_DESCRIPTION_MAX_LENGTH);
  expect(result).toBe("a".repeat(160));
});

test("does not exceed 160 after stripping html from a long value", () => {
  const long = `<p>${"word ".repeat(80)}</p>`;
  const result = metaDescription(long);
  expect(result.length).toBeLessThanOrEqual(160);
  expect(result.includes("<")).toBe(false);
});
