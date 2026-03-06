import { renderToBuffer } from "@react-pdf/renderer";
import { db, eq, and, releases } from "@/lib/db";
import {
  getDateline,
  newsUrl,
  replaceResizeWithWidth,
} from "@/lib/utils";
import PressReleasePdf from "@/lib/pdf/press-release-pdf";
import type { PdfReleaseData } from "@/lib/pdf/press-release-pdf";

export const dynamic = "force-dynamic";

function removeEmptyPTags(html: string): string {
  return html.replace(/<p>\s*<\/p>/g, "");
}

function stripUnsupportedImages(html: string): string {
  // Remove <img> tags with unsupported extensions (webp, svg, gif, avif)
  return html.replace(/<img[^>]*src="[^"]*\.(webp|svg|gif|avif)"[^>]*\/?>/gi, "");
}

function stripIframes(html: string): string {
  return html.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "");
}

function flattenLists(html: string): string {
  // Strip <p> tags inside <li> to get plain content
  function stripInnerP(s: string): string {
    return s.replace(/<\/?p[^>]*>/gi, "").trim();
  }

  // Convert <ul> lists to divs with hanging-indent bullet style
  let result = html.replace(
    /<ul[^>]*>([\s\S]*?)<\/ul>/gi,
    (_, inner) => {
      return inner.replace(
        /<li[^>]*>([\s\S]*?)<\/li>/gi,
        (_: string, content: string) =>
          `<div class="bullet-item">\u2022\u00A0\u00A0${stripInnerP(content)}</div>`
      );
    }
  );
  // Convert <ol> lists to divs with hanging-indent number style
  result = result.replace(
    /<ol[^>]*>([\s\S]*?)<\/ol>/gi,
    (_, inner) => {
      let i = 0;
      return inner.replace(
        /<li[^>]*>([\s\S]*?)<\/li>/gi,
        (_: string, content: string) => {
          i++;
          return `<div class="bullet-item">${i}.\u00A0\u00A0${stripInnerP(content)}</div>`;
        }
      );
    }
  );
  return result;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&trade;": "\u2122",
  "&reg;": "\u00AE",
  "&copy;": "\u00A9",
  "&ldquo;": "\u201C",
  "&rdquo;": "\u201D",
  "&lsquo;": "\u2018",
  "&rsquo;": "\u2019",
  "&ndash;": "\u2013",
  "&mdash;": "\u2014",
  "&hellip;": "\u2026",
  "&bull;": "\u2022",
  "&nbsp;": " ",
  "&deg;": "\u00B0",
  "&micro;": "\u00B5",
  "&plusmn;": "\u00B1",
  "&frac12;": "\u00BD",
  "&frac14;": "\u00BC",
  "&frac34;": "\u00BE",
  "&times;": "\u00D7",
  "&divide;": "\u00F7",
};

function decodeHtmlEntities(text: string): string {
  let result = text;
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.replaceAll(entity, char);
  }
  // Handle numeric entities like &#8220; &#x2019;
  result = result.replace(/&#(\d+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 10))
  );
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
    String.fromCharCode(parseInt(code, 16))
  );
  return result;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id_string: string }> }
) {
  const { id_string } = await params;
  const pr_id = parseInt(id_string.substring(8));

  if (isNaN(pr_id)) {
    return new Response("Invalid ID", { status: 400 });
  }

  const release = await db.query.releases.findFirst({
    columns: {
      id: true,
      title: true,
      selfHost: true,
      uuid: true,
      slug: true,
      releasedAt: true,
      releaseAt: true,
      timezone: true,
      body: true,
      abstract: true,
      pullquote: true,
      location: true,
      prhashId: true,
    },
    with: {
      company: {
        columns: {
          companyName: true,
          logoUrl: true,
          website: true,
          city: true,
          state: true,
          phone: true,
        },
      },
      primaryContact: {
        columns: {
          name: true,
          title: true,
          email: true,
          phone: true,
        },
      },
      primaryImage: {
        columns: {
          url: true,
          caption: true,
          imgCredits: true,
        },
      },
      releaseCategories: {
        with: {
          category: {
            columns: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    where: and(
      eq(releases.isDeleted, false),
      eq(releases.id, pr_id),
    ),
  });

  if (!release) {
    return new Response("Not found", { status: 404 });
  }

  // Fetch TLDR data
  let tldr: string[] | null = null;
  if (release.prhashId) {
    try {
      const tldrRes = await fetch(
        `https://cdn.newsramp.net/tldr/${release.prhashId}.json`
      );
      if (tldrRes.ok) {
        const tldrData = await tldrRes.json();
        if (tldrData?.tldr?.[0]) {
          const t = tldrData.tldr[0];
          tldr = [t.competitive, t.humanistic, t.methodical, t.spontaneous].filter(Boolean);
        }
      }
    } catch {
      // TLDR not available, skip
    }
  }

  const dateline = getDateline(
    release.releaseAt,
    release.location ?? "Unknown Location",
    release.timezone ?? "Unknown Timezone"
  );

  const companyLogoUrl = release.company?.logoUrl
    ? replaceResizeWithWidth(release.company.logoUrl, 400)
    : null;

  const newsImage = release.primaryImage?.url
    ? release.primaryImage.url.replace("RESIZE/", "")
    : null;

  const pageUrl = newsUrl(release);

  // QR code - try PNG first, fall back to webp check
  let qrcodeUrl: string | null = null;
  if (release.id >= 950 && release.prhashId) {
    const pngUrl = `https://cdn.newsramp.net/qrcode/${release.prhashId}.png`;
    try {
      const qrRes = await fetch(pngUrl, { method: "HEAD" });
      if (qrRes.ok) qrcodeUrl = pngUrl;
    } catch {
      // PNG not available
    }
  }

  const categories = (release.releaseCategories || [])
    .map((rc) => rc.category?.name)
    .filter((name): name is string => !!name);

  const htmlBody = flattenLists(stripIframes(stripUnsupportedImages(removeEmptyPTags(release.body || ""))));

  const data: PdfReleaseData = {
    title: decodeHtmlEntities(release.title || "Untitled Press Release"),
    abstract: decodeHtmlEntities(release.abstract || ""),
    dateline: dateline.replace("—", "").trim(),
    body: decodeHtmlEntities(htmlBody),
    pullquote: release.pullquote ? decodeHtmlEntities(release.pullquote) : null,
    newsImage,
    imageCaption: release.primaryImage?.caption ? decodeHtmlEntities(release.primaryImage.caption) : null,
    imageCredit: release.primaryImage?.imgCredits ?? null,
    companyName: decodeHtmlEntities(release.company?.companyName || ""),
    companyLogoUrl,
    companyPhone: release.company?.phone ?? null,
    companyWebsite: release.company?.website ?? null,
    companyCity: release.company?.city ?? null,
    companyState: release.company?.state ?? null,
    contactName: release.primaryContact?.name ?? null,
    contactTitle: release.primaryContact?.title ?? null,
    contactEmail: release.primaryContact?.email ?? null,
    contactPhone: release.primaryContact?.phone ?? null,
    qrcodeUrl,
    tldr,
    categories,
    pageUrl,
    generatedAt: new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/New_York",
    }),
  };

  try {
    const buffer = await renderToBuffer(<PressReleasePdf data={data} />);
    const pdfBytes = new Uint8Array(buffer);

    const slug = release.slug || "press-release";
    const filename = `${slug}.pdf`;

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "s-maxage=7200, stale-while-revalidate=59",
      },
    });
  } catch (err) {
    console.error("PDF render error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
