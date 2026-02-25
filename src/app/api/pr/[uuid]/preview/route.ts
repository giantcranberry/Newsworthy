import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import { releases, company, banners, images } from "@/db/schema";
import { eq, and } from "drizzle-orm";
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
      title: releases.title,
      abstract: releases.abstract,
      body: releases.body,
      pullquote: releases.pullquote,
      location: releases.location,
      videoUrl: releases.videoUrl,
      companyName: company.companyName,
      logoUrl: company.logoUrl,
      bannerUrl: banners.url,
      primaryImageUrl: images.url,
      primaryImageTitle: images.title,
      primaryImageCaption: images.caption,
      primaryImageCredits: images.imgCredits,
    })
    .from(releases)
    .leftJoin(company, eq(releases.companyId, company.id))
    .leftJoin(banners, eq(releases.bannerId, banners.id))
    .leftJoin(images, eq(releases.primaryImageId, images.id))
    .where(and(eq(releases.uuid, uuid), eq(releases.userId, userId)))
    .limit(1);

  if (!result[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(result[0]);
}
