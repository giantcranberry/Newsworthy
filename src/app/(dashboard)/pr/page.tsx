import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import { releases } from "@/db/schema";
import { eq, desc, and, or, isNull, ne } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Eye, Edit } from "lucide-react";
import { DeleteReleaseButton } from "./delete-release-button";
import { RetractReleaseButton } from "./retract-release-button";

async function getUserReleases(userId: number) {
  return await db.query.releases.findMany({
    where: and(
      eq(releases.userId, userId),
      or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
    ),
    orderBy: desc(releases.createdAt),
    with: {
      company: true,
      primaryImage: true,
      banner: true,
    },
  });
}

function getStatusColor(status: string) {
  switch (status) {
    case "sent":
      return "bg-green-100 text-green-800";
    case "editorial":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
      return "bg-blue-100 text-blue-800";
    case "hold":
      return "bg-amber-100 text-amber-800";
    case "draft":
    case "draftnxt":
    case "start":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "sent":
      return "Published";
    case "editorial":
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
            return r.status === "editorial";
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
    review: allReleases.filter((r) => r.status === "editorial").length,
    published: allReleases.filter((r) => r.status === "sent").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Press Releases</h1>
          <p className="text-gray-500">Manage your press releases</p>
        </div>
        <Link href="/pr/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Release
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Link href="/pr">
          <Button
            variant={!filter ? "outline" : "ghost"}
            size="sm"
            className={!filter ? "bg-white" : ""}
          >
            All ({counts.all})
          </Button>
        </Link>
        <Link href="/pr?filter=drafts">
          <Button
            variant={filter === "drafts" ? "outline" : "ghost"}
            size="sm"
            className={filter === "drafts" ? "bg-white" : ""}
          >
            Drafts ({counts.drafts})
          </Button>
        </Link>
        <Link href="/pr?filter=review">
          <Button
            variant={filter === "review" ? "outline" : "ghost"}
            size="sm"
            className={filter === "review" ? "bg-white" : ""}
          >
            In Review ({counts.review})
          </Button>
        </Link>
        <Link href="/pr?filter=published">
          <Button
            variant={filter === "published" ? "outline" : "ghost"}
            size="sm"
            className={filter === "published" ? "bg-white" : ""}
          >
            Published ({counts.published})
          </Button>
        </Link>
      </div>

      {/* Releases List */}
      {userReleases.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {filter ? `No ${filter} releases` : "No press releases yet"}
            </h3>
            <p className="mt-2 text-gray-500">
              {filter
                ? "Try a different filter or create a new release."
                : "Get started by creating your first press release."}
            </p>
            <Link href="/pr/create">
              <Button className="mt-6 gap-2">
                <Plus className="h-4 w-4" />
                Create Release
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {userReleases.map((release) => (
            <Card key={release.id} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                {/* Banner */}
                {release.banner?.url || release.primaryImage?.url ? (
                  <>
                    <div className="sm:hidden w-full aspect-[1200/630] bg-gray-100">
                      <img
                        src={(() => {
                          const url =
                            release.banner?.url || release.primaryImage!.url;
                          return url.includes("cdn.filestac")
                            ? url.replace(/RESIZE/i, "resize=width:1200")
                            : url;
                        })()}
                        alt={release.title || ""}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="hidden sm:block w-56 flex-shrink-0 bg-gray-100">
                      <img
                        src={(() => {
                          const url =
                            release.banner?.url || release.primaryImage!.url;
                          return url.includes("cdn.filestac")
                            ? url.replace(/RESIZE/i, "resize=width:1200")
                            : url;
                        })()}
                        alt={release.title || ""}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </>
                ) : (
                  <div className="hidden sm:flex w-56 flex-shrink-0 bg-gray-100 items-center justify-center">
                    <FileText className="h-12 w-12 text-gray-300" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(
                            release.status,
                          )}`}
                        >
                          {getStatusLabel(release.status)}
                        </span>
                        {release.distribution && (
                          <span className="text-xs text-gray-500">
                            {release.distribution}
                          </span>
                        )}
                      </div>
                      <Link href={`/pr/${release.uuid}`}>
                        <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 truncate">
                          {release.title || "Untitled Release"}
                        </h3>
                      </Link>
                      <p className="text-sm text-gray-500 mt-1">
                        {release.company?.companyName}
                      </p>
                      {release.abstract && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {release.abstract}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
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
                    <div className="flex items-center gap-2 shrink-0">
                      {!["approved", "sent", "editorial"].includes(
                        release.status,
                      ) && (
                        <Link href={`/pr/${release.uuid}`}>
                          <Button variant="ghost" size="icon" title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      {release.status === "editorial" && (
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
                          <Button variant="ghost" size="icon" title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      {!["approved", "sent", "editorial"].includes(
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
