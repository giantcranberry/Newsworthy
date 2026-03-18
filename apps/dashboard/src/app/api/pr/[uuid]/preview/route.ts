export const dynamic = 'force-dynamic'

import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import { releases, company, banners, images, releaseImages, releaseFaqs } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const session = await getEffectiveSession();
  const userId = parseInt(session?.user?.id || "0");

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .select({
      id: releases.id,
      title: releases.title,
      abstract: releases.abstract,
      body: releases.body,
      pullquote: releases.pullquote,
      location: releases.location,
      videoUrl: releases.videoUrl,
      landingPage: releases.landingPage,
      releaseAt: releases.releaseAt,
      timezone: releases.timezone,
      companyName: company.companyName,
      logoUrl: company.logoUrl,
      bannerUrl: banners.url,
    })
    .from(releases)
    .leftJoin(company, eq(releases.companyId, company.id))
    .leftJoin(banners, eq(releases.bannerId, banners.id))
    .where(and(eq(releases.uuid, uuid), eq(releases.userId, userId)))
    .limit(1);

  if (!result[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const releaseData = result[0];

  // Fetch all images for this release
  const allImages = await db
    .select({
      id: images.id,
      url: images.url,
      title: images.title,
      caption: images.caption,
      imgCredits: images.imgCredits,
    })
    .from(releaseImages)
    .innerJoin(images, eq(releaseImages.imageId, images.id))
    .where(eq(releaseImages.releaseId, releaseData.id))
    .orderBy(asc(releaseImages.sortOrder));

  // Fetch FAQs for this release
  const faqs = await db
    .select({
      question: releaseFaqs.question,
      answer: releaseFaqs.answer,
    })
    .from(releaseFaqs)
    .where(eq(releaseFaqs.prId, releaseData.id))
    .orderBy(asc(releaseFaqs.sortOrder));

  return NextResponse.json({
    title: releaseData.title,
    abstract: releaseData.abstract,
    body: releaseData.body,
    pullquote: releaseData.pullquote,
    location: releaseData.location,
    videoUrl: releaseData.videoUrl,
    landingPage: releaseData.landingPage,
    releaseAt: releaseData.releaseAt,
    timezone: releaseData.timezone,
    companyName: releaseData.companyName,
    logoUrl: releaseData.logoUrl,
    bannerUrl: releaseData.bannerUrl,
    images: allImages,
    faqs,
  });
}
