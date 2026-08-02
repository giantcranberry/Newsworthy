import { NextRequest, NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import {
  releases,
  releaseCategories,
  releaseRegions,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";
import { getPostHog } from "@/lib/posthog";
import { getUserCompanyIds } from "@/lib/team-auth";
import { sanitizeReleaseBody } from "@/lib/sanitize-body";

// Create a slug from title
function createSlug(title: string): string {
  return slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  }).slice(0, 200);
}

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id);

  try {
    const body = await request.json();
    const {
      title,
      abstract,
      body: content,
      pullquote,
      companyId,
      primaryContactId,
      location,
      releaseAt,
      timezone,
      videoUrl,
      landingPage,
      publicDrive,
      topcat,
      selectedCategories,
      selectedRegions,
      action,
    } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "Company is required" },
        { status: 400 },
      );
    }

    const uuid = uuidv4().replace(/-/g, "");
    const slug = title ? createSlug(title) : null;
    // Status remains 'draftnxt' until finalize step submits for review
    const status = "draftnxt";

    // Sanitize body content
    const sanitizedContent = content ? sanitizeReleaseBody(content) : content;

    // Drafting is free — the PR credit is consumed at editorial submit
    // (finalize route), not here.
    const [newRelease] = await db
      .insert(releases)
      .values({
        uuid,
        userId,
        companyId,
        primaryContactId: primaryContactId || null,
        title,
        abstract,
        body: sanitizedContent,
        pullquote: pullquote || null,
        slug,
        location,
        releaseAt: releaseAt ? new Date(releaseAt) : null,
        timezone: timezone || null,
        videoUrl: videoUrl || null,
        landingPage: landingPage || null,
        publicDrive: publicDrive || null,
        status,
        createdAt: new Date(),
        editorialHold: false,
      })
      .returning();

    // Save categories - topcat first, then other selected categories
    const allCategories: number[] = [];
    if (topcat) {
      allCategories.push(parseInt(topcat));
    }
    if (selectedCategories && Array.isArray(selectedCategories)) {
      selectedCategories.forEach((catId: number) => {
        if (!allCategories.includes(catId)) {
          allCategories.push(catId);
        }
      });
    }
    if (allCategories.length > 0) {
      await db.insert(releaseCategories).values(
        allCategories.map((categoryId: number) => ({
          releaseId: newRelease.id,
          categoryId,
        })),
      );
    }

    // Save regions
    if (
      selectedRegions &&
      Array.isArray(selectedRegions) &&
      selectedRegions.length > 0
    ) {
      await db.insert(releaseRegions).values(
        selectedRegions.map((regionId: number) => ({
          releaseId: newRelease.id,
          regionId,
        })),
      );
    }

    getPostHog().capture({
      distinctId: String(userId),
      event: 'press_release_created',
      properties: {
        release_uuid: newRelease.uuid,
        release_id: newRelease.id,
        company_id: companyId,
        has_video: !!videoUrl,
        has_landing_page: !!landingPage,
        category_count: allCategories.length,
        region_count: selectedRegions?.length ?? 0,
      },
    })

    return NextResponse.json({ uuid: newRelease.uuid, id: newRelease.id });
  } catch (error) {
    console.error("Error creating release:", error);
    getPostHog().captureException(error, String(userId))
    return NextResponse.json(
      { error: "Failed to create release" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await getEffectiveSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = parseInt(session.user.id);

  try {
    const body = await request.json();
    const {
      uuid,
      title,
      abstract,
      body: content,
      pullquote,
      companyId,
      primaryContactId,
      location,
      releaseAt,
      timezone,
      videoUrl,
      landingPage,
      publicDrive,
      topcat,
      selectedCategories,
      selectedRegions,
      action,
    } = body;

    // Find existing release
    const existingRelease = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
    });

    if (!existingRelease) {
      return NextResponse.json({ error: "Release not found" }, { status: 404 });
    }

    if (existingRelease.userId !== userId) {
      const companyIds = await getUserCompanyIds(userId);
      if (!companyIds.includes(existingRelease.companyId)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    // Prevent edits to releases in certain statuses
    const lockedStatuses = ["review", "approved", "published"];
    if (
      existingRelease.status &&
      lockedStatuses.includes(existingRelease.status)
    ) {
      return NextResponse.json(
        {
          error: `Cannot edit release with status "${existingRelease.status}"`,
        },
        { status: 403 },
      );
    }

    const slug = title ? createSlug(title) : existingRelease.slug;
    // Status remains unchanged during wizard steps - only finalize route sets to 'review'
    const status = existingRelease.status;

    // Sanitize body content
    const sanitizedContent = content ? sanitizeReleaseBody(content) : content;

    // Update release
    await db
      .update(releases)
      .set({
        title,
        abstract,
        body: sanitizedContent,
        pullquote: pullquote || null,
        slug,
        companyId,
        primaryContactId: primaryContactId || null,
        location,
        releaseAt: releaseAt ? new Date(releaseAt) : null,
        timezone: timezone || null,
        videoUrl: videoUrl || null,
        landingPage: landingPage || null,
        publicDrive: publicDrive || null,
        status,
      })
      .where(eq(releases.id, existingRelease.id));

    // Update categories - delete existing and insert new (topcat first)
    await db
      .delete(releaseCategories)
      .where(eq(releaseCategories.releaseId, existingRelease.id));
    const allCategories: number[] = [];
    if (topcat) {
      allCategories.push(parseInt(topcat));
    }
    if (selectedCategories && Array.isArray(selectedCategories)) {
      selectedCategories.forEach((catId: number) => {
        if (!allCategories.includes(catId)) {
          allCategories.push(catId);
        }
      });
    }
    if (allCategories.length > 0) {
      await db.insert(releaseCategories).values(
        allCategories.map((categoryId: number) => ({
          releaseId: existingRelease.id,
          categoryId,
        })),
      );
    }

    // Update regions - delete existing and insert new
    await db
      .delete(releaseRegions)
      .where(eq(releaseRegions.releaseId, existingRelease.id));
    if (
      selectedRegions &&
      Array.isArray(selectedRegions) &&
      selectedRegions.length > 0
    ) {
      await db.insert(releaseRegions).values(
        selectedRegions.map((regionId: number) => ({
          releaseId: existingRelease.id,
          regionId,
        })),
      );
    }

    return NextResponse.json({
      uuid: existingRelease.uuid,
      id: existingRelease.id,
    });
  } catch (error) {
    console.error("Error updating release:", error);
    return NextResponse.json(
      { error: "Failed to update release" },
      { status: 500 },
    );
  }
}
