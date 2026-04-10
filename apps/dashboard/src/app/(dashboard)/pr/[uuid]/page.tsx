import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import {
  releases,
  company,
  companyMembers,
  releaseOptions,
  releaseImages,
  category,
  region,
  releaseCategories,
  releaseRegions,
  queue,
} from "@/db/schema";
import { eq, and, asc, or, inArray, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { PRForm } from "../pr-form";
import { WizardNav } from "@/components/pr-wizard/wizard-nav";
import { RetractReleaseButton } from "../retract-release-button";
import { ContactAdminButton } from "../contact-admin-button";
import { SubmissionCompleteView } from "./submission-complete-view";
import { getUserCompanyIds, hasMinRole } from "@/lib/team-auth";

async function getRelease(uuid: string, userId: number, companyIds: number[]) {
  const release = await db.query.releases.findFirst({
    where: and(
      eq(releases.uuid, uuid),
      or(
        eq(releases.userId, userId),
        companyIds.length > 0 ? inArray(releases.companyId, companyIds) : undefined,
      ),
    ),
    with: {
      company: true,
      primaryContact: true,
      primaryImage: true,
      banner: true,
      releaseImages: {
        orderBy: [asc(releaseImages.sortOrder)],
        with: { image: true },
      },
    },
  });

  return release;
}

async function getUserCompanies(userId: number) {
  const owned = await db.query.company.findMany({
    where: and(eq(company.userId, userId), eq(company.isDeleted, false), or(eq(company.isArchived, false), isNull(company.isArchived))),
    with: { contacts: true },
  });

  // Include team companies where user has collaborator+ role
  const memberships = await db
    .select({ companyId: companyMembers.companyId, role: companyMembers.role })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId));

  const ownedIds = new Set(owned.map((c) => c.id));
  const sharedIds = memberships
    .filter((m) => m.role !== 'client')
    .map((m) => m.companyId)
    .filter((id) => !ownedIds.has(id));

  let shared: typeof owned = [];
  if (sharedIds.length > 0) {
    shared = await db.query.company.findMany({
      where: and(inArray(company.id, sharedIds), eq(company.isDeleted, false), or(eq(company.isArchived, false), isNull(company.isArchived))),
      with: { contacts: true },
    });
  }

  return [...owned, ...shared].map((c) => ({
    ...c,
    contacts: c.contacts.filter((ct) => !ct.isDeleted && !ct.isArchived),
  }));
}

async function getReleaseOptions(prId: number) {
  return await db.query.releaseOptions.findFirst({
    where: eq(releaseOptions.prId, prId),
  });
}

async function getCategories() {
  return await db.select().from(category).orderBy(category.name);
}

async function getRegions() {
  return await db.select().from(region).orderBy(region.name);
}

async function getReleaseCategories(releaseId: number) {
  const cats = await db
    .select({ categoryId: releaseCategories.categoryId })
    .from(releaseCategories)
    .where(eq(releaseCategories.releaseId, releaseId));
  return cats.map((c) => c.categoryId);
}

async function getReleaseRegions(releaseId: number) {
  const regs = await db
    .select({ regionId: releaseRegions.regionId })
    .from(releaseRegions)
    .where(eq(releaseRegions.releaseId, releaseId));
  return regs.map((r) => r.regionId);
}

export default async function PRDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string }>;
  searchParams: Promise<{ wizard?: string; submitted?: string }>;
}) {
  const { uuid } = await params;
  const { wizard, submitted } = await searchParams;
  const session = await getEffectiveSession();
  const userId = parseInt(session?.user?.id || "0");

  const companyIds = await getUserCompanyIds(userId);

  const [release, companies, categories, regions] = await Promise.all([
    getRelease(uuid, userId, companyIds),
    getUserCompanies(userId),
    getCategories(),
    getRegions(),
  ]);

  // Get top-level categories (where parent_category = 'top')
  const topCategories = categories.filter((c) => c.parentCategory === "top");

  if (!release) {
    notFound();
  }

  // Published releases — redirect to the live URL
  if (release.status === "sent" && release.releaseAt) {
    const y = release.releaseAt.getFullYear();
    const m = String(release.releaseAt.getMonth() + 1).padStart(2, "0");
    const d = String(release.releaseAt.getDate()).padStart(2, "0");
    redirect(`https://www.newsworthy.ai/news/${y}${m}${d}${release.id}/${release.slug}`);
  }

  const [options, allSelectedCategories, selectedRegions, queueEntry] =
    await Promise.all([
      release.id ? getReleaseOptions(release.id) : null,
      getReleaseCategories(release.id),
      getReleaseRegions(release.id),
      release.id
        ? db.query.queue.findFirst({ where: eq(queue.releaseId, release.id) })
        : null,
    ]);

  const isEditorial = release.status === "review" || release.status === "hold";
  const canRetract = isEditorial;

  // Find topcat (first category that's a top-level category)
  const topCategoryIds = new Set(topCategories.map((c) => c.id));
  const topcat =
    allSelectedCategories.find((catId) => topCategoryIds.has(catId)) || null;
  // Other selected categories (excluding topcat)
  const selectedCategories = allSelectedCategories.filter(
    (catId) => catId !== topcat,
  );

  const showWizardComplete = wizard === "complete";

  // Check if user is client-only for this release's company
  let isClientOnly = false;
  if (release.companyId && release.userId !== userId) {
    const editableIds = await getUserCompanyIds(userId, 'collaborator');
    isClientOnly = !editableIds.includes(release.companyId);
  }

  const isReadOnly = isClientOnly || ["review", "hold", "approved", "sent"].includes(release.status || "");

  // Submission complete + editorial review: show simplified view
  if (showWizardComplete && isEditorial) {
    return (
      <SubmissionCompleteView
        releaseUuid={uuid}
        releaseTitle={release.title}
        canRetract={canRetract}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PRForm
        companies={companies}
        categories={categories}
        topCategories={topCategories}
        regions={regions}
        readOnly={isReadOnly}
        pageTitle={`${isReadOnly ? "View" : "Edit"} Press Release`}
        pageDescription={`Status: ${release.status?.replace("_", " ")}`}
        initialData={{
          id: release.id,
          uuid: release.uuid,
          title: release.title || "",
          abstract: release.abstract || "",
          body: release.body || "",
          pullquote: release.pullquote || "",
          companyId: release.companyId,
          primaryContactId: release.primaryContactId,
          status: release.status,
          location: release.location || "",
          releaseAt: release.releaseAt,
          timezone: release.timezone,
          videoUrl: release.videoUrl,
          landingPage: release.landingPage,
          publicDrive: release.publicDrive,
          selectedCategories,
          selectedRegions,
          topcat,
        }}
      >
        <div className="space-y-4">
          {showWizardComplete && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-medium text-green-800 dark:text-green-300">Submission Complete!</h3>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                Your press release has been submitted for review.
              </p>
            </div>
          )}

          {submitted === "true" && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 dark:text-blue-300">Submitted for Review</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                Your press release has been submitted to our editorial team for
                review.
              </p>
            </div>
          )}

          {isEditorial && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-amber-800 dark:text-amber-300">
                  {release.status === "hold" ? "Editorial Hold" : "In Editorial Review"}
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  {release.status === "hold"
                    ? "This release has been placed on hold by an editor. You can retract it to make changes."
                    : "This release is awaiting editorial review. You can retract it to make changes."}
                </p>
              </div>
              <RetractReleaseButton uuid={release.uuid!} title={release.title} />
            </div>
          )}

          {release.status === "approved" && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-green-800 dark:text-green-300">Approved</h3>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                  Your release has been approved. If you need immediate assistance, click here to send a message to admins.
                </p>
              </div>
              <ContactAdminButton uuid={release.uuid!} title={release.title} />
            </div>
          )}

          <WizardNav
            releaseUuid={uuid}
            currentStep={1}
            release={release}
            company={release.company || undefined}
            releaseOptions={options || undefined}
          />
        </div>
      </PRForm>
    </div>
  );
}
