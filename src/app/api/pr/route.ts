import { NextRequest, NextResponse } from "next/server";
import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import {
  releases,
  releaseCategories,
  releaseRegions,
  brandCredits,
} from "@/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import slugify from "slugify";

// Check if user has credits (either for specific company or user-level)
// Uses net balance (sum of all credits including deductions) rather than filtering by prId
async function hasCredits(userId: number, companyId: number): Promise<boolean> {
  // Check brand-level credits for this company
  const brandCreditResult = await db
    .select({
      balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as(
        "balance",
      ),
    })
    .from(brandCredits)
    .where(
      and(
        eq(brandCredits.companyId, companyId),
        eq(brandCredits.userId, userId),
      ),
    );

  if (Number(brandCreditResult[0]?.balance || 0) > 0) {
    return true;
  }

  // Check user-level credits
  const userCreditResult = await db
    .select({
      balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as(
        "balance",
      ),
    })
    .from(brandCredits)
    .where(
      and(
        eq(brandCredits.userId, userId),
        isNull(brandCredits.companyId), // User-level credits
      ),
    );

  return Number(userCreditResult[0]?.balance || 0) > 0;
}

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

    // Check if user has credits for this company
    if (!companyId) {
      return NextResponse.json(
        { error: "Company is required" },
        { status: 400 },
      );
    }

    const userHasCredits = await hasCredits(userId, companyId);
    if (!userHasCredits) {
      return NextResponse.json(
        {
          error:
            "No press release credits available. Please purchase credits to create a release.",
        },
        { status: 402 }, // 402 Payment Required
      );
    }

    const uuid = uuidv4().replace(/-/g, "");
    const slug = title ? createSlug(title) : null;
    // Status remains 'draftnxt' until finalize step submits for review
    const status = "draftnxt";

    // Create release
    const [newRelease] = await db
      .insert(releases)
      .values({
        uuid,
        userId,
        companyId,
        primaryContactId: primaryContactId || null,
        title,
        abstract,
        body: content,
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

    // Deduct one credit for this PR creation
    // First try brand-level credits, then fall back to user-level
    const brandBalance = await db
      .select({
        balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as(
          "balance",
        ),
      })
      .from(brandCredits)
      .where(
        and(
          eq(brandCredits.companyId, companyId),
          eq(brandCredits.userId, userId),
        ),
      );

    if (Number(brandBalance[0]?.balance || 0) > 0) {
      // Deduct from brand-level credits
      await db.insert(brandCredits).values({
        userId,
        companyId,
        prId: newRelease.id,
        credits: -1,
        productType: "pr",
        notes: `PR: ${title?.substring(0, 40) || newRelease.uuid}`,
      });
    } else {
      // Deduct from user-level credits
      await db.insert(brandCredits).values({
        userId,
        companyId: null,
        prId: newRelease.id,
        credits: -1,
        productType: "pr",
        notes: `PR: ${title?.substring(0, 40) || newRelease.uuid}`,
      });
    }

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

    return NextResponse.json({ uuid: newRelease.uuid, id: newRelease.id });
  } catch (error) {
    console.error("Error creating release:", error);
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Prevent edits to releases in certain statuses
    const lockedStatuses = ["editorial", "approved", "published"];
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
    // Status remains unchanged during wizard steps - only finalize route sets to 'editorial'
    const status = existingRelease.status;

    // Update release
    await db
      .update(releases)
      .set({
        title,
        abstract,
        body: content,
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
