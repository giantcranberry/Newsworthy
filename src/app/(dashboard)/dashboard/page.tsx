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
  CreditCard,
  TrendingUp,
  Plus,
  ArrowRight,
} from "lucide-react";

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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">
            Welcome back! Here&apos;s what&apos;s happening.
          </p>
        </div>
        <Link href="/pr/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Release
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Releases
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-500">
              {stats.published} published, {stats.drafts} drafts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Brands
            </CardTitle>
            <Building2 className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companies.length}</div>
            <p className="text-xs text-gray-500">Active brand profiles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              PR Credits
            </CardTitle>
            <CreditCard className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creditBalance}</div>
            <p className="text-xs text-gray-500">
              Available press release credits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              In Review
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inReview}</div>
            <p className="text-xs text-gray-500">Pending editorial review</p>
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
                className="text-sm text-blue-600 hover:underline"
              >
                View all
              </Link>
            </div>
            <CardDescription>Your latest press releases</CardDescription>
          </CardHeader>
          <CardContent>
            {releases.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No releases yet</p>
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
                    className="block rounded-lg border p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {release.title || "Untitled"}
                        </h4>
                        <p className="text-sm text-gray-500 truncate">
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
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <Link href="/pr/create">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                >
                  <FileText className="h-4 w-4" />
                  Create New Release
                  <ArrowRight className="ml-auto h-4 w-4" />
                </Button>
              </Link>
              <Link href="/company/add">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                >
                  <Building2 className="h-4 w-4" />
                  Add New Brand
                  <ArrowRight className="ml-auto h-4 w-4" />
                </Button>
              </Link>
              <Link href="/payment/paygo">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3"
                >
                  <CreditCard className="h-4 w-4" />
                  Buy Credits
                  <ArrowRight className="ml-auto h-4 w-4" />
                </Button>
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
              <Link
                href="/company"
                className="text-sm text-blue-600 hover:underline"
              >
                Manage brands
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companies.slice(0, 6).map((co) => (
                <Link
                  key={co.id}
                  href={`/company/${co.uuid}`}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-gray-50 transition-colors"
                >
                  {co.logoUrl ? (
                    <img
                      src={co.logoUrl}
                      alt={co.companyName}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                      <Building2 className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {co.companyName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
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
