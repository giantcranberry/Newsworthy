import { NextRequest, NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import { releases } from "@/db/schema";
import { eq } from "drizzle-orm";

// Build a regex that matches the plain text while allowing HTML tags between words
function buildTagAwarePattern(plainText: string): RegExp {
  // Escape regex special chars, then allow optional HTML tags between any characters
  const escaped = plainText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Allow optional HTML tags and whitespace variations between words
  const pattern = escaped.replace(/\s+/g, "(?:\\s|<[^>]*>)+");
  return new RegExp(pattern, "i");
}

// Fuzzy match: find the best substring match using word overlap
function fuzzyFindInBody(body: string, searchText: string): { start: number; end: number } | null {
  const stripped = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const searchWords = searchText.toLowerCase().replace(/\s+/g, " ").trim().split(" ");
  if (searchWords.length < 3) return null;

  // Sliding window over stripped text sentences
  const sentences = stripped.split(/(?<=[.!?])\s+/);
  let bestScore = 0;
  let bestMatch = "";

  // Try matching against individual sentences and sentence pairs
  for (let i = 0; i < sentences.length; i++) {
    for (let span = 1; span <= 3 && i + span <= sentences.length; span++) {
      const candidate = sentences.slice(i, i + span).join(" ");
      const candidateWords = candidate.toLowerCase().split(/\s+/);
      const overlap = searchWords.filter(w => candidateWords.includes(w)).length;
      const score = overlap / Math.max(searchWords.length, candidateWords.length);
      if (score > bestScore && score >= 0.6) {
        bestScore = score;
        bestMatch = candidate;
      }
    }
  }

  if (!bestMatch) return null;

  // Find position of bestMatch in the stripped text
  const idx = stripped.indexOf(bestMatch);
  if (idx === -1) return null;

  // Map stripped position back to HTML position
  let htmlPos = 0;
  let textPos = 0;
  let matchStart = -1;
  let matchEnd = -1;

  while (htmlPos < body.length && textPos <= idx + bestMatch.length) {
    if (body[htmlPos] === "<") {
      const tagEnd = body.indexOf(">", htmlPos);
      if (tagEnd === -1) break;
      htmlPos = tagEnd + 1;
      continue;
    }

    if (textPos === idx && matchStart === -1) {
      matchStart = htmlPos;
    }

    textPos++;
    htmlPos++;

    if (textPos === idx + bestMatch.length) {
      matchEnd = htmlPos;
      break;
    }
  }

  if (matchStart !== -1 && matchEnd !== -1) {
    return { start: matchStart, end: matchEnd };
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id);
  const { uuid } = await params;

  try {
    const { originalText, improvedText, field } = await request.json();

    if (!improvedText) {
      return NextResponse.json(
        { error: "improvedText is required" },
        { status: 400 },
      );
    }

    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
    });

    if (!release) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    if (release.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const lockedStatuses = ["review", "approved", "sent"];
    if (release.status && lockedStatuses.includes(release.status)) {
      return NextResponse.json(
        { error: `Cannot edit release with status "${release.status}"` },
        { status: 403 },
      );
    }

    // Handle title update
    if (field === "title") {
      await db
        .update(releases)
        .set({ title: improvedText })
        .where(eq(releases.id, release.id));

      return NextResponse.json({ success: true });
    }

    if (!originalText) {
      return NextResponse.json(
        { error: "originalText is required" },
        { status: 400 },
      );
    }

    if (!release.body) {
      return NextResponse.json(
        { error: "Release has no body content" },
        { status: 400 },
      );
    }

    // Try direct replacement first
    let updatedBody = release.body.replace(originalText, improvedText);

    // If direct match fails, try tag-aware matching (AI returns plain text, body is HTML)
    if (updatedBody === release.body) {
      const pattern = buildTagAwarePattern(originalText);
      updatedBody = release.body.replace(pattern, improvedText);
    }

    // If still no match, try matching against stripped HTML
    if (updatedBody === release.body) {
      const strippedBody = release.body
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const normalizedOriginal = originalText.replace(/\s+/g, " ").trim();

      const strippedIndex = strippedBody.indexOf(normalizedOriginal);
      if (strippedIndex === -1) {
        return NextResponse.json(
          { error: "Original text not found in release body" },
          { status: 400 },
        );
      }

      // Map the stripped text position back to HTML position
      // Walk through the HTML body, tracking stripped text position
      let htmlPos = 0;
      let textPos = 0;
      let matchStart = -1;
      let matchEnd = -1;
      const html = release.body;

      while (
        htmlPos < html.length &&
        textPos <= strippedIndex + normalizedOriginal.length
      ) {
        if (html[htmlPos] === "<") {
          // Skip HTML tag
          const tagEnd = html.indexOf(">", htmlPos);
          if (tagEnd === -1) break;
          htmlPos = tagEnd + 1;
          continue;
        }

        if (textPos === strippedIndex && matchStart === -1) {
          matchStart = htmlPos;
        }

        textPos++;
        htmlPos++;

        if (textPos === strippedIndex + normalizedOriginal.length) {
          matchEnd = htmlPos;
          break;
        }
      }

      if (matchStart !== -1 && matchEnd !== -1) {
        updatedBody =
          html.slice(0, matchStart) + improvedText + html.slice(matchEnd);
      } else {
        // Last resort: fuzzy match
        const fuzzyResult = fuzzyFindInBody(release.body, originalText);
        if (fuzzyResult) {
          updatedBody =
            release.body.slice(0, fuzzyResult.start) +
            improvedText +
            release.body.slice(fuzzyResult.end);
        } else {
          return NextResponse.json(
            { error: "Original text not found in release body" },
            { status: 400 },
          );
        }
      }
    }

    await db
      .update(releases)
      .set({ body: updatedBody })
      .where(eq(releases.id, release.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error applying edit:", error);
    return NextResponse.json(
      { error: "Failed to apply edit" },
      { status: 500 },
    );
  }
}
