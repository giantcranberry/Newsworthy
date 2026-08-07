import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import { releases, company, userSubscription, brandCredits, companyMembers, companyInvites, couponLog } from "@/db/schema";
import { eq, desc, and, ne, or, isNull, sql, inArray, gt } from "drizzle-orm";
import { getUserCompanyIds } from "@/lib/team-auth";
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
import { faChartBar } from "@awesome.me/kit-adf47b9acf/icons/duotone/light";
import { faEye } from "@awesome.me/kit-adf47b9acf/icons/duotone/light";
import { faBullseye } from "@awesome.me/kit-adf47b9acf/icons/duotone/light";
import { CreditsCard } from "./credits-card";
import { PendingInvites } from "./pending-invites";
import { RedeemCourtesyCode } from "./redeem-courtesy-code";
import { getClipsTotalStats } from "@/services/report";
import { EngagementChart } from "./engagement-chart";
import { GettingStarted, BookPromoBanner } from "./getting-started";
import { qualifiesForFreeFirstPr } from "@/lib/pr-checkout";
import { getBrandSetupStatus } from "@/lib/brand-setup";

interface CreditsByType {
  pr: number
  yahoo: number
  enhanced: number
  concierge: number
  podcast: number
}

interface BrandCreditsBreakdown {
  companyId: number
  companyName: string
  credits: CreditsByType
}

interface AllCredits {
  personal: CreditsByType
  brands: BrandCreditsBreakdown[]
  totalPr: number
}

function sumCredits(rows: { productType: string | null; balance: number }[]): CreditsByType {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const key = row.productType || 'pr';
    totals[key] = (totals[key] || 0) + Number(row.balance);
  }
  return {
    pr: (totals['pr'] || 0) + (totals['credits'] || 0),
    yahoo: totals['yahoo'] || 0,
    enhanced: totals['enhanced'] || 0,
    concierge: totals['concierge'] || 0,
    podcast: totals['podcast_pr'] || 0,
  };
}

async function getAllCredits(
  userId: number,
  companies: { id: number; companyName: string }[]
): Promise<AllCredits> {
  // Get user-level credits (where companyId is null)
  const userResult = await db
    .select({
      productType: brandCredits.productType,
      balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as("balance"),
    })
    .from(brandCredits)
    .where(
      and(
        eq(brandCredits.userId, userId),
        isNull(brandCredits.companyId),
      ),
    )
    .groupBy(brandCredits.productType);

  const personal = sumCredits(userResult);

  // Get brand-level credits grouped by company and type
  const companyIds = companies.map((c) => c.id);
  const brandResult =
    companyIds.length > 0
      ? await db
          .select({
            companyId: brandCredits.companyId,
            productType: brandCredits.productType,
            balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as("balance"),
          })
          .from(brandCredits)
          .where(
            sql`${brandCredits.companyId} IN (${sql.join(
              companyIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
          .groupBy(brandCredits.companyId, brandCredits.productType)
      : [];

  // Group by company
  const byCompany = new Map<number, { productType: string | null; balance: number }[]>();
  for (const row of brandResult) {
    if (row.companyId === null) continue;
    const list = byCompany.get(row.companyId) || [];
    list.push({ productType: row.productType, balance: row.balance });
    byCompany.set(row.companyId, list);
  }

  const brands: BrandCreditsBreakdown[] = [];
  for (const co of companies) {
    const rows = byCompany.get(co.id);
    if (!rows) continue;
    const credits = sumCredits(rows);
    if (credits.pr > 0 || credits.yahoo > 0 || credits.enhanced > 0 || credits.concierge > 0 || credits.podcast > 0) {
      brands.push({ companyId: co.id, companyName: co.companyName, credits });
    }
  }

  const totalPr = personal.pr + brands.reduce((sum, b) => sum + b.credits.pr, 0);

  return { personal, brands, totalPr };
}

async function getPendingInvites(email: string) {
  return db
    .select({
      id: companyInvites.id,
      token: companyInvites.token,
      role: companyInvites.role,
      companyName: company.companyName,
      companyLogo: company.logoUrl,
    })
    .from(companyInvites)
    .innerJoin(company, eq(company.id, companyInvites.companyId))
    .where(and(
      eq(companyInvites.email, email),
      isNull(companyInvites.acceptedAt),
      gt(companyInvites.expiresAt, new Date()),
    ))
}

async function getDashboardData(userId: number) {
  // Get user's owned companies (need this first for release queries)
  const ownedCompanies = await db.query.company.findMany({
    where: and(eq(company.userId, userId), eq(company.isDeleted, false), eq(company.isArchived, false)),
  });

  // Get team member companies
  const memberships = await db
    .select({ companyId: companyMembers.companyId })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId));

  const ownedIds = new Set(ownedCompanies.map((c) => c.id));
  const sharedIds = memberships.map((m) => m.companyId).filter((id) => !ownedIds.has(id));

  let sharedCompanies: typeof ownedCompanies = [];
  if (sharedIds.length > 0) {
    sharedCompanies = await db.query.company.findMany({
      where: and(inArray(company.id, sharedIds), eq(company.isDeleted, false), eq(company.isArchived, false)),
    });
  }

  const userCompanies = [...ownedCompanies, ...sharedCompanies];
  const allCompanyIds = userCompanies.map((c) => c.id);

  // Get user's releases (owned + team companies)
  const userReleases = await db.query.releases.findMany({
    where: and(
      or(
        eq(releases.userId, userId),
        allCompanyIds.length > 0 ? inArray(releases.companyId, allCompanyIds) : undefined,
      ),
      or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
    ),
    orderBy: desc(releases.createdAt),
    limit: 5,
    with: {
      company: true,
    },
  });

  // Get subscription info
  const subscription = await db.query.userSubscription.findFirst({
    where: eq(userSubscription.userId, userId),
  });

  // Get credit balances by type from brand_credits table
  const allCredits = await getAllCredits(userId, userCompanies.map(c => ({ id: c.id, companyName: c.companyName })));

  // Count releases by status (owned + team companies)
  const allReleases = await db.query.releases.findMany({
    where: and(
      or(
        eq(releases.userId, userId),
        allCompanyIds.length > 0 ? inArray(releases.companyId, allCompanyIds) : undefined,
      ),
      or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
    ),
  });

  const sentReleases = allReleases.filter((r) => r.status === "sent");

  const stats = {
    total: allReleases.length,
    published: sentReleases.length,
    drafts: allReleases.filter(
      (r) =>
        r.status === "draftnxt" || r.status === "draft" || r.status === "start",
    ).length,
    inReview: allReleases.filter((r) => r.status === "review").length,
  };

  // Fetch engagement stats from OpenSearch
  let totalPageviews = 0;
  let totalShares = 0;
  let lifetimeEcpc: string | null = null;

  const prhashIds = sentReleases
    .map((r) => r.prhashId)
    .filter((id): id is string => !!id);

  if (prhashIds.length > 0) {
    try {
      const { pageviews, shares } = await getClipsTotalStats(prhashIds);
      totalPageviews = Object.values(pageviews).reduce((sum, v) => sum + v, 0);
      totalShares = Object.values(shares).reduce((sum, v) => sum + v, 0);

      const totalEngagement = totalPageviews + totalShares;
      if (totalEngagement > 0) {
        const cost = sentReleases.length * 129;
        lifetimeEcpc = (Math.floor((cost / totalEngagement) * 100) / 100).toFixed(2);
      }
    } catch (err) {
      console.error("Dashboard engagement stats error:", err);
    }
  }

  // Check if user has already redeemed a courtesy code
  const couponLogRows = await db
    .select({ id: couponLog.id })
    .from(couponLog)
    .where(eq(couponLog.userId, userId))
    .limit(1);
  const hasRedeemedCoupon = couponLogRows.length > 0;

  return {
    releases: userReleases,
    companies: userCompanies,
    subscription,
    allCredits,
    stats,
    hasRedeemedCoupon,
    engagement: {
      pageviews: totalPageviews,
      shares: totalShares,
      total: totalPageviews + totalShares,
      lifetimeEcpc,
    },
  };
}

export default async function DashboardPage() {
  const session = await getEffectiveSession();
  const userId = parseInt(session?.user?.id || "0");

  const { releases, companies, subscription, allCredits, stats, engagement, hasRedeemedCoupon } =
    await getDashboardData(userId);

  const userEmail = session?.user?.email?.toLowerCase() || '';
  const pendingInvites = await getPendingInvites(userEmail);

  // Check if user can create content (owns companies or has collaborator+ role)
  const editableIds = await getUserCompanyIds(userId, 'collaborator');
  const canCreate = editableIds.length > 0;

  // Guided onboarding path: shown until the user has submitted a release
  // (anything beyond draft status). Client-only team members can't create
  // content, so they keep the regular dashboard.
  const isClientOnly = !canCreate && companies.length > 0;
  const hasSubmittedRelease = stats.total > stats.drafts;
  const showGettingStarted = !hasSubmittedRelease && !isClientOnly;
  const draftStatuses = ["draftnxt", "draft", "start"];
  const draft = releases.find((r) => draftStatuses.includes(r.status)) ?? null;
  const draftUuid = draft?.uuid ?? null;

  // Deep-link the getting-started CTA to the draft's first incomplete
  // required wizard step (mirrors isStepComplete in wizard-nav.tsx) instead
  // of always restarting at Details.
  let draftNextHref: string | null = null;
  if (draft) {
    const base = `/pr/${draft.uuid}`;
    if (!draft.title || !draft.abstract || !draft.body) draftNextHref = base;
    else if (!draft.company?.logoUrl) draftNextHref = `${base}/logo`;
    else if (!draft.bannerId) draftNextHref = `${base}/images`;
    else if (!draft.distribution) draftNextHref = `${base}/upgrades`;
    else draftNextHref = `${base}/review`;
  }

  // First-press-release-free offer: live check (toggle + zero credits + no
  // press releases), so flipping the admin toggle changes this immediately
  const firstReleaseFree =
    showGettingStarted && allCredits.totalPr <= 0
      ? await qualifiesForFreeFirstPr(userId)
      : false;

  // Brand-profile setup state for the checklist: step 1 counts as done only
  // when the profile is complete through the newsroom, not merely created
  const brandSetup =
    showGettingStarted && companies.length > 0
      ? await getBrandSetupStatus(companies[0])
      : null;

  return (
    <div className="space-y-6">
      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <PendingInvites invites={pendingInvites.map(inv => ({
          id: inv.id,
          token: inv.token,
          role: inv.role,
          companyName: inv.companyName,
          companyLogo: inv.companyLogo,
        }))} />
      )}

      {showGettingStarted && <BookPromoBanner />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {showGettingStarted
              ? "Welcome! Let's get your first press release published."
              : "Welcome back! Here's what's happening."}
          </p>
        </div>
        {canCreate && (
          <Link href="/pr/create">
            <Button className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700">
              <Plus className="h-4 w-4" />
              New Release
            </Button>
          </Link>
        )}
      </div>

      {showGettingStarted ? (
        <>
          {!canCreate && <div data-tour="dashboard-empty" className="hidden" />}
          <GettingStarted
            brandSetup={brandSetup}
            brandUuid={companies[0]?.uuid ?? null}
            hasDraft={stats.drafts > 0}
            draftUuid={draftUuid}
            draftNextHref={draftNextHref}
            hasCredits={allCredits.totalPr > 0}
            firstReleaseFree={firstReleaseFree}
          />
        </>
      ) : (
      <>
      {/* Stats Grid */}
      <div data-tour="dashboard-stats" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Link href="/pr" data-tour="dashboard-stat-releases">
          <Card className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Releases
              </CardTitle>
              <FaIcon icon={faNewspaper} className="h-6 w-6 text-cyan-700" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {stats.published} published, {stats.drafts} drafts
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/company" data-tour="dashboard-stat-brands">
          <Card className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Brands
              </CardTitle>
              <FaIcon icon={faFlag} className="h-6 w-6 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{companies.length}</div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Active brand profiles</p>
            </CardContent>
          </Card>
        </Link>

        <div data-tour="dashboard-stat-credits">
          <CreditsCard allCredits={allCredits} canPurchase={canCreate} hasRedeemedCoupon={hasRedeemedCoupon} />
        </div>

        <Link href="/pr?filter=review" data-tour="dashboard-stat-review">
          <Card className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                In Review
              </CardTitle>
              <FaIcon icon={faClipboardCheck} className="h-6 w-6 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.inReview}</div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Pending editorial review</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/pr/reports">
          <Card className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Engagement
              </CardTitle>
              <FaIcon icon={faEye} className="h-6 w-6 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {engagement.total.toLocaleString()}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {engagement.pageviews.toLocaleString()} views, {engagement.shares.toLocaleString()} shares
              </p>
            </CardContent>
          </Card>
        </Link>

        <Card className="dark:bg-gray-950 h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Lifetime eCPC*
            </CardTitle>
            <FaIcon icon={faBullseye} className="h-6 w-6 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {engagement.lifetimeEcpc ? `$${engagement.lifetimeEcpc}` : 'N/A'}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400" title="Assumes standard distribution rate of $129 per release. Calculated on trackable engagement numbers.">
              Cost per engagement
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Chart */}
      {stats.published > 0 && (
        <EngagementChart
          brands={companies.map((co) => ({ id: co.id, name: co.companyName }))}
        />
      )}

      {/* Quick Actions */}
      {!canCreate && <div data-tour="dashboard-empty" className="hidden" />}
      {canCreate && (
        <Card data-tour="dashboard-quick-actions">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and actions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`grid grid-cols-2 gap-3 ${hasRedeemedCoupon ? 'sm:grid-cols-4' : 'sm:grid-cols-5'}`}>
              <Link
                href="/pr/create"
                data-tour="dashboard-action-new-release"
                className="flex flex-col items-center justify-center gap-2 sm:gap-3 rounded-xl border border-cyan-700 bg-cyan-800/10 dark:bg-cyan-400/10 p-3 sm:p-4 text-center transition-colors hover:bg-cyan-800/20 cursor-pointer"
              >
                <FaIcon icon={faFilePlus} className="h-6 w-6 sm:h-8 sm:w-8 text-cyan-700" />
                <span className="text-sm font-semibold text-cyan-700">New Release</span>
              </Link>
              <Link
                href="/company/add"
                data-tour="dashboard-action-add-brand"
                className="flex flex-col items-center justify-center gap-2 sm:gap-3 rounded-xl border border-indigo-500 bg-indigo-500/10 p-3 sm:p-4 text-center transition-colors hover:bg-indigo-500/20 cursor-pointer"
              >
                <FaIcon icon={faFlag} className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-500" />
                <span className="text-sm font-semibold text-indigo-500">Add Brand</span>
              </Link>
              <Link
                href="/pr/reports"
                data-tour="dashboard-action-reports"
                className="flex flex-col items-center justify-center gap-2 sm:gap-3 rounded-xl border border-emerald-600 bg-emerald-600/10 p-3 sm:p-4 text-center transition-colors hover:bg-emerald-600/20 cursor-pointer"
              >
                <FaIcon icon={faChartBar} className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-600">Reports</span>
              </Link>
              <Link
                href="/payment/paygo"
                data-tour="dashboard-action-buy-credits"
                className="flex flex-col items-center justify-center gap-2 sm:gap-3 rounded-xl border border-amber-500 bg-amber-500/10 p-3 sm:p-4 text-center transition-colors hover:bg-amber-500/20 cursor-pointer"
              >
                <FaIcon icon={faCoins} className="h-6 w-6 sm:h-8 sm:w-8 text-amber-500" />
                <span className="text-sm font-semibold text-amber-500">Buy Credits</span>
              </Link>
              {!hasRedeemedCoupon && <RedeemCourtesyCode />}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        {/* Recent Releases */}
        <Card data-tour="dashboard-recent-releases">
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg">Recent Releases</CardTitle>
              <Link
                href="/pr"
                className="text-sm text-cyan-800 dark:text-cyan-400 hover:underline cursor-pointer"
              >
                View all
              </Link>
            </div>
            <CardDescription>Your latest press releases</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {releases.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">No releases yet</p>
                {canCreate && (
                  <Link href="/pr/create">
                    <Button variant="outline" size="sm" className="mt-4">
                      Create your first release
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {releases.map((release) => (
                  <Link
                    key={release.id}
                    href={`/pr/${release.uuid}`}
                    className="block rounded-lg border p-3 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {release.title || "Untitled"}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {release.company?.companyName}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${
                          release.status === "sent"
                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                            : release.status === "review"
                              ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400"
                              : release.status === "approved"
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                        }`}
                      >
                        {release.status === "sent"
                          ? "Published"
                          : release.status === "review"
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

        {/* Your Brands */}
        {companies.length > 0 && (
          <Card data-tour="dashboard-brands">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base sm:text-lg">Your Brands</CardTitle>
                <Link href="/company">
                  <Button variant="outline" size="sm" className="cursor-pointer border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 dark:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100 text-xs sm:text-sm">
                    Manage Brands
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
                {companies.slice(0, 6).map((co) => (
                  <Link
                    key={co.id}
                    href={`/company/${co.uuid}`}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50 p-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 cursor-pointer sm:flex-col sm:items-center sm:justify-center sm:gap-2 sm:p-4 sm:text-center"
                  >
                    {co.logoUrl ? (
                      <img
                        src={co.logoUrl}
                        alt={co.companyName}
                        className="h-10 w-10 rounded-full object-cover shrink-0 sm:h-12 sm:w-12"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 shrink-0 sm:h-12 sm:w-12">
                        <FaIcon icon={faFlag} className="h-5 w-5 text-gray-500 dark:text-gray-400 sm:h-6 sm:w-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1 sm:w-full sm:flex-initial">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {co.companyName}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
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
      </>
      )}
    </div>
  );
}
