import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import { releases, company, userSubscription, brandCredits } from "@/db/schema";
import { eq, desc, and, ne, or, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Building2,
  Plus,
} from "lucide-react";
import { FaIcon } from "@/components/ui/fa-icon";
import { faFilePlus } from "@awesome.me/kit-adf47b9acf/icons/duotone/light";
import { faFlag } from "@awesome.me/kit-adf47b9acf/icons/duotone/light";
import { faCoins } from "@awesome.me/kit-adf47b9acf/icons/duotone/light";
import { faNewspaper } from "@awesome.me/kit-adf47b9acf/icons/duotone/light";
import { faBuilding } from "@awesome.me/kit-adf47b9acf/icons/duotone/light";
import { faClipboardCheck } from "@awesome.me/kit-adf47b9acf/icons/duotone/light";

async function getCreditBalance(userId: number, companyIds: number[]) {
  // Get brand-level credits (sum across all user's companies)
  const brandCreditResult =
    companyIds.length > 0
      ? await db
          .select({
            balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as(
              "balance",
            ),
          })
          .from(brandCredits)
          .where(
            sql`${brandCredits.companyId} IN (${sql.join(
              companyIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
      : [{ balance: 0 }];

  // Get user-level credits (where companyId is null)
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

  const brandBalance = Number(brandCreditResult[0]?.balance || 0);
  const userBalance = Number(userCreditResult[0]?.balance || 0);

  return brandBalance + userBalance;
}

async function getDashboardData(userId: number) {
  // Get user's releases
  const userReleases = await db.query.releases.findMany({
    where: and(
      eq(releases.userId, userId),
      or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
    ),
    orderBy: desc(releases.createdAt),
    limit: 5,
    with: {
      company: true,
    },
  });

  // Get user's companies
  const userCompanies = await db.query.company.findMany({
    where: and(eq(company.userId, userId), eq(company.isDeleted, false)),
  });

  // Get subscription info
  const subscription = await db.query.userSubscription.findFirst({
    where: eq(userSubscription.userId, userId),
  });

  // Get credit balance from brand_credits table
  const companyIds = userCompanies.map((c) => c.id);
  const creditBalance = await getCreditBalance(userId, companyIds);

  // Count releases by status
  const allReleases = await db.query.releases.findMany({
    where: and(
      eq(releases.userId, userId),
      or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
    ),
  });

  const stats = {
    total: allReleases.length,
    published: allReleases.filter((r) => r.status === "sent").length,
    drafts: allReleases.filter(
      (r) =>
        r.status === "draftnxt" || r.status === "draft" || r.status === "start",
    ).length,
    inReview: allReleases.filter((r) => r.status === "editorial").length,
  };

  return {
    releases: userReleases,
    companies: userCompanies,
    subscription,
    creditBalance,
    stats,
  };
}

export default async function DashboardPage() {
  const session = await getEffectiveSession();
  const userId = parseInt(session?.user?.id || "0");

  const { releases, companies, subscription, creditBalance, stats } =
    await getDashboardData(userId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back! Here&apos;s what&apos;s happening.
          </p>
        </div>
        <Link href="/pr/create">
          <Button className="gap-2 bg-cyan-800 text-white hover:bg-cyan-900">
            <Plus className="h-4 w-4" />
            New Release
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Releases
            </CardTitle>
            <FaIcon icon={faNewspaper} className="h-6 w-6 text-cyan-700" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
            <p className="text-xs text-gray-600">
              {stats.published} published, {stats.drafts} drafts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Brands
            </CardTitle>
            <FaIcon icon={faFlag} className="h-6 w-6 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{companies.length}</div>
            <p className="text-xs text-gray-600">Active brand profiles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              PR Credits
            </CardTitle>
            <FaIcon icon={faCoins} className="h-6 w-6 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{creditBalance}</div>
            <p className="text-xs text-gray-600">
              Available press release credits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              In Review
            </CardTitle>
            <FaIcon icon={faClipboardCheck} className="h-6 w-6 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.inReview}</div>
            <p className="text-xs text-gray-600">Pending editorial review</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Releases */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Releases</CardTitle>
              <Link
                href="/pr"
                className="text-sm text-cyan-800 hover:underline cursor-pointer"
              >
                View all
              </Link>
            </div>
            <CardDescription>Your latest press releases</CardDescription>
          </CardHeader>
          <CardContent>
            {releases.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">No releases yet</p>
                <Link href="/pr/create">
                  <Button variant="outline" size="sm" className="mt-4">
                    Create your first release
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {releases.map((release) => (
                  <Link
                    key={release.id}
                    href={`/pr/${release.uuid}`}
                    className="block rounded-lg border p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {release.title || "Untitled"}
                        </h4>
                        <p className="text-sm text-gray-600 truncate">
                          {release.company?.companyName}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          release.status === "sent"
                            ? "bg-green-100 text-green-800"
                            : release.status === "editorial"
                              ? "bg-yellow-100 text-yellow-800"
                              : release.status === "approved"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {release.status === "sent"
                          ? "Published"
                          : release.status === "editorial"
                            ? "In Review"
                            : release.status === "approved"
                              ? "Approved"
                              : "Draft"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and actions</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="grid h-full grid-cols-3 gap-3">
              <Link
                href="/pr/create"
                className="flex flex-col items-center justify-center gap-3 rounded-xl border border-cyan-700 bg-cyan-800/10 p-4 text-center transition-colors hover:bg-cyan-800/20 cursor-pointer"
              >
                <FaIcon icon={faFilePlus} className="h-8 w-8 text-cyan-700" />
                <span className="text-sm font-semibold text-cyan-700">New Release</span>
              </Link>
              <Link
                href="/company/add"
                className="flex flex-col items-center justify-center gap-3 rounded-xl border border-indigo-500 bg-indigo-500/10 p-4 text-center transition-colors hover:bg-indigo-500/20 cursor-pointer"
              >
                <FaIcon icon={faFlag} className="h-8 w-8 text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-500">Add Brand</span>
              </Link>
              <Link
                href="/payment/paygo"
                className="flex flex-col items-center justify-center gap-3 rounded-xl border border-amber-500 bg-amber-500/10 p-4 text-center transition-colors hover:bg-amber-500/20 cursor-pointer"
              >
                <FaIcon icon={faCoins} className="h-8 w-8 text-amber-500" />
                <span className="text-sm font-semibold text-amber-500">Buy Credits</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Brands Section */}
      {companies.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Your Brands</CardTitle>
              <Link href="/company">
                <Button variant="outline" size="sm" className="cursor-pointer border-gray-300 text-gray-700 hover:bg-gray-200 hover:text-gray-900">
                  Manage Brands
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {companies.slice(0, 6).map((co) => (
                <Link
                  key={co.id}
                  href={`/company/${co.uuid}`}
                  className="flex flex-col items-center justify-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-center transition-colors hover:bg-gray-100 cursor-pointer"
                >
                  {co.logoUrl ? (
                    <img
                      src={co.logoUrl}
                      alt={co.companyName}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                      <FaIcon icon={faFlag} className="h-6 w-6 text-gray-500" />
                    </div>
                  )}
                  <div className="min-w-0 w-full">
                    <p className="font-semibold text-gray-900 truncate">
                      {co.companyName}
                    </p>
                    <p className="text-xs text-gray-600 truncate">
                      {co.website || "No website"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
