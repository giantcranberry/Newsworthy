import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import { releases } from "@/db/schema";
import { eq, desc, and, or, isNull, ne, inArray } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Eye, Edit } from "lucide-react";
import { DeleteReleaseButton } from "./delete-release-button";
import { RetractReleaseButton } from "./retract-release-button";
import { getUserCompanyIds } from "@/lib/team-auth";

async function getUserReleases(userId: number) {
  const companyIds = await getUserCompanyIds(userId);

  const results = await db.query.releases.findMany({
    where: and(
      or(
        eq(releases.userId, userId),
        companyIds.length > 0 ? inArray(releases.companyId, companyIds) : undefined,
      ),
      or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
    ),
    orderBy: desc(releases.createdAt),
    with: {
      company: true,
      primaryImage: true,
      banner: true,
    },
  });

  // Get company IDs where user can edit (collaborator+)
  const editableCompanyIds = new Set(await getUserCompanyIds(userId, 'collaborator'));

  return results.map((r) => ({
    ...r,
    // User can edit if they own the release or have collaborator+ on the company
    canEdit: r.userId === userId || (r.companyId ? editableCompanyIds.has(r.companyId) : false),
  }));
}

function getStatusColor(status: string) {
  switch (status) {
    case "sent":
      return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400";
    case "review":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400";
    case "approved":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400";
    case "hold":
      return "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400";
    case "draft":
    case "draftnxt":
    case "start":
      return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "sent":
      return "Published";
    case "review":
      return "In Review";
    case "approved":
      return "Approved";
    case "hold":
      return "Editorial Hold";
    case "draft":
    case "draftnxt":
    case "start":
      return "Draft";
    default:
      return status;
  }
}

export default async function PressReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const session = await getEffectiveSession();
  const userId = parseInt(session?.user?.id || "0");
  const allReleases = await getUserReleases(userId);
  const canCreate = allReleases.some((r) => r.canEdit) || (await getUserCompanyIds(userId, 'collaborator')).length > 0;

  // Filter releases based on query param
  const userReleases = filter
    ? allReleases.filter((r) => {
        switch (filter) {
          case "drafts":
            return (
              r.status === "draftnxt" ||
              r.status === "draft" ||
              r.status === "start"
            );
          case "review":
            return r.status === "review";
          case "published":
            return r.status === "sent";
          default:
            return true;
        }
      })
    : allReleases;

  const counts = {
    all: allReleases.length,
    drafts: allReleases.filter(
      (r) =>
        r.status === "draftnxt" || r.status === "draft" || r.status === "start",
    ).length,
    review: allReleases.filter((r) => r.status === "review").length,
    published: allReleases.filter((r) => r.status === "sent").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Press Releases</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your press releases</p>
        </div>
        {canCreate && (
          <Link href="/pr/create" data-tour="pr-new-release">
            <Button className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer">
              <Plus className="h-4 w-4" />
              New Release
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <div data-tour="pr-filters" className="flex gap-2">
        <Link href="/pr">
          <button className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
            !filter ? "bg-cyan-800/10 dark:bg-cyan-400/10 text-cyan-800 dark:text-cyan-400" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800"
          }`}>
            All ({counts.all})
          </button>
        </Link>
        <Link href="/pr?filter=drafts">
          <button className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
            filter === "drafts" ? "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800"
          }`}>
            Drafts ({counts.drafts})
          </button>
        </Link>
        <Link href="/pr?filter=review">
          <button className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
            filter === "review" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800"
          }`}>
            In Review ({counts.review})
          </button>
        </Link>
        <Link href="/pr?filter=published">
          <button className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
            filter === "published" ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400" : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800"
          }`}>
            Published ({counts.published})
          </button>
        </Link>
      </div>

      {/* Releases List */}
      {userReleases.length === 0 ? (
        <Card data-tour="pr-empty">
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              {filter ? `No ${filter} releases` : "No press releases yet"}
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {filter
                ? "Try a different filter or create a new release."
                : "Get started by creating your first press release."}
            </p>
            {canCreate && (
              <Link href="/pr/create">
                <Button className="mt-6 gap-2 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer">
                  <Plus className="h-4 w-4" />
                  Create Release
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div data-tour="pr-releases-list" className="space-y-4">
          {userReleases.map((release, index) => (
            <Card key={release.id} className="overflow-hidden" {...(index === 0 ? { "data-tour": "pr-first-release" } : {})}>
              <div className={`flex flex-col sm:flex-row ${release.status === "sent" ? "group" : ""}`}>
                {/* Banner */}
                {release.banner?.url || release.primaryImage?.url ? (
                  <>
                    {release.status === "sent" && release.releaseAt ? (
                      <>
                        <Link
                          href={`https://www.newsworthy.ai/news/${release.releaseAt.getFullYear()}${String(release.releaseAt.getMonth() + 1).padStart(2, "0")}${String(release.releaseAt.getDate()).padStart(2, "0")}${release.id}/${release.slug}`}
                          target="_blank"
                          className="sm:hidden w-full cursor-pointer"
                        >
                          <img
                            src={(() => {
                              const url = release.banner?.url || release.primaryImage!.url;
                              return url.includes("cdn.filestac") ? url.replace(/RESIZE/i, "resize=width:1200") : url;
                            })()}
                            alt={release.title || ""}
                            className="w-full"
                          />
                        </Link>
                        <Link
                          href={`https://www.newsworthy.ai/news/${release.releaseAt.getFullYear()}${String(release.releaseAt.getMonth() + 1).padStart(2, "0")}${String(release.releaseAt.getDate()).padStart(2, "0")}${release.id}/${release.slug}`}
                          target="_blank"
                          className="hidden sm:block w-48 flex-shrink-0 pt-6 pl-4 self-start cursor-pointer"
                        >
                          <img
                            src={(() => {
                              const url = release.banner?.url || release.primaryImage!.url;
                              return url.includes("cdn.filestac") ? url.replace(/RESIZE/i, "resize=width:1200") : url;
                            })()}
                            alt={release.title || ""}
                            className="w-full rounded"
                          />
                        </Link>
                      </>
                    ) : (
                      <>
                        <div className="sm:hidden w-full">
                          <img
                            src={(() => {
                              const url = release.banner?.url || release.primaryImage!.url;
                              return url.includes("cdn.filestac") ? url.replace(/RESIZE/i, "resize=width:1200") : url;
                            })()}
                            alt={release.title || ""}
                            className="w-full"
                          />
                        </div>
                        <div className="hidden sm:block w-48 flex-shrink-0 pt-6 pl-4 self-start">
                          <img
                            src={(() => {
                              const url = release.banner?.url || release.primaryImage!.url;
                              return url.includes("cdn.filestac") ? url.replace(/RESIZE/i, "resize=width:1200") : url;
                            })()}
                            alt={release.title || ""}
                            className="w-full rounded"
                          />
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="hidden sm:flex w-48 flex-shrink-0 pt-6 pl-4 self-start items-center justify-center">
                    <FileText className="h-12 w-12 text-gray-400" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1" {...(index === 0 ? { "data-tour": "pr-status-badge" } : {})}>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                            release.status,
                          )}`}
                        >
                          {getStatusLabel(release.status)}
                        </span>
                        {release.distribution && (
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {release.distribution}
                          </span>
                        )}
                      </div>
                      <Link href={`/pr/${release.uuid}`} className="cursor-pointer">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-cyan-800 dark:text-cyan-400 group-hover:text-cyan-800 dark:text-cyan-400 truncate">
                          {release.title || "Untitled Release"}
                        </h3>
                      </Link>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {release.company?.companyName}
                      </p>
                      {release.abstract && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                          {release.abstract}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          Created:{" "}
                          {new Date(release.createdAt!).toLocaleDateString()}
                        </span>
                        {release.releaseAt && (
                          <span>
                            Release:{" "}
                            {new Date(release.releaseAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0" {...(index === 0 ? { "data-tour": "pr-release-actions" } : {})}>
                      {release.canEdit && !["approved", "sent", "review"].includes(
                        release.status,
                      ) && (
                        <Link href={`/pr/${release.uuid}`}>
                          <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100">
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </Link>
                      )}
                      {release.canEdit && release.status === "review" && (
                        <RetractReleaseButton
                          uuid={release.uuid!}
                          title={release.title}
                        />
                      )}
                      {release.status === "sent" && release.releaseAt && (
                        <Link
                          href={`https://www.newsworthy.ai/news/${release.releaseAt.getFullYear()}${String(
                            release.releaseAt.getMonth() + 1,
                          ).padStart(2, "0")}${String(
                            release.releaseAt.getDate(),
                          ).padStart(2, "0")}${release.id}/${release.slug}`}
                          target="_blank"
                        >
                          <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100">
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                        </Link>
                      )}
                      {release.canEdit && !["approved", "sent", "review"].includes(
                        release.status,
                      ) && (
                        <DeleteReleaseButton
                          uuid={release.uuid!}
                          title={release.title}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
