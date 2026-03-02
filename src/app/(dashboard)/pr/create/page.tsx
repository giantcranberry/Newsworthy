import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import { company, category, region, brandCredits, companyMembers } from "@/db/schema";
import { eq, and, isNull, sql, inArray, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PRForm } from "../pr-form";
import { NoCreditsBanner } from "./no-credits-banner";
import { getUserCompanyIds } from "@/lib/team-auth";

async function getUserCompanies(userId: number) {
  // Get companies owned by the user
  const owned = await db.query.company.findMany({
    where: and(eq(company.userId, userId), eq(company.isDeleted, false), or(eq(company.isArchived, false), isNull(company.isArchived))),
    with: {
      contacts: true,
    },
  });

  // Get companies where user is a team member (collaborator+ can create PRs)
  const memberships = await db
    .select({ companyId: companyMembers.companyId, role: companyMembers.role })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId));

  const ownedIds = new Set(owned.map((c) => c.id));
  // Exclude client-only members — they cannot create PRs
  const sharedIds = memberships
    .filter((m) => m.role !== 'client')
    .map((m) => m.companyId)
    .filter((id) => !ownedIds.has(id));

  let shared: typeof owned = [];
  if (sharedIds.length > 0) {
    shared = await db.query.company.findMany({
      where: and(
        inArray(company.id, sharedIds),
        eq(company.isDeleted, false),
        or(eq(company.isArchived, false), isNull(company.isArchived)),
      ),
      with: {
        contacts: true,
      },
    });
  }

  // User can purchase if they own any company or are brand_admin on any
  const hasOwned = owned.length > 0;
  const hasBrandAdmin = memberships.some((m) => m.role === 'brand_admin');
  const canPurchase = hasOwned || hasBrandAdmin;

  const all = [...owned, ...shared].map((c) => ({
    ...c,
    contacts: c.contacts.filter((ct) => !ct.isDeleted && !ct.isArchived),
  }));

  return { companies: all, canPurchase };
}

async function getCategories() {
  return await db.select().from(category).orderBy(category.name);
}

async function getRegions() {
  return await db.select().from(region).orderBy(region.name);
}

interface CreditBalance {
  brandCredits: { companyId: number; balance: number }[];
  userCredits: number;
  hasCredits: boolean;
}

async function getCreditBalance(
  userId: number,
  companyIds: number[],
): Promise<CreditBalance> {
  // Get brand-level PR credits (grouped by company) using net balance
  // Only count productType 'pr' or 'credits' — other types (yahoo, enhanced) don't apply
  const brandCreditResults =
    companyIds.length > 0
      ? await db
          .select({
            companyId: brandCredits.companyId,
            balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as(
              "balance",
            ),
          })
          .from(brandCredits)
          .where(
            sql`${brandCredits.companyId} IN (${sql.join(
              companyIds.map((id) => sql`${id}`),
              sql`, `,
            )}) AND ${brandCredits.productType} IN ('pr', 'credits')`,
          )
          .groupBy(brandCredits.companyId)
      : [];

  // Get user-level PR credits (where companyId is null) using net balance
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
        isNull(brandCredits.companyId),
        sql`${brandCredits.productType} IN ('pr', 'credits')`,
      ),
    );

  const brandBalances = brandCreditResults
    .filter((r) => r.companyId !== null)
    .map((r) => ({ companyId: r.companyId!, balance: Number(r.balance) }));

  const userBalance = Number(userCreditResult[0]?.balance || 0);

  // Check if any brand has positive PR credits or user has positive PR credits
  const hasPositiveBrandCredits = brandBalances.some((b) => b.balance > 0);
  const hasPositiveUserCredits = userBalance > 0;

  return {
    brandCredits: brandBalances,
    userCredits: userBalance,
    hasCredits: hasPositiveBrandCredits || hasPositiveUserCredits,
  };
}

export default async function CreatePRPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company: companyUuid } = await searchParams;
  const session = await getEffectiveSession();
  const userId = parseInt(session?.user?.id || "0");

  const [userCompanies, categories, regions] = await Promise.all([
    getUserCompanies(userId),
    getCategories(),
    getRegions(),
  ]);

  const { companies, canPurchase } = userCompanies;

  if (companies.length === 0) {
    // Check if user has any team memberships at all (client-only users)
    const allCompanyIds = await getUserCompanyIds(userId);
    if (allCompanyIds.length > 0) {
      // User has team access but only as client — redirect to PR list
      redirect("/pr");
    }
    redirect("/company/add?next=/pr/create");
  }

  // Check credit balance
  const companyIds = companies.map((c) => c.id);
  const creditBalance = await getCreditBalance(userId, companyIds);

  // Get top-level categories (where parent_category = 'top')
  const topCategories = categories.filter((c) => c.parentCategory === "top");

  // Build credit balance map per company (brand credits + user credits applied to each)
  const creditMap: Record<number, number> = {};
  for (const co of companies) {
    const brandBal = creditBalance.brandCredits.find((b) => b.companyId === co.id);
    creditMap[co.id] = (brandBal?.balance || 0);
  }

  // Pre-select company: from query param, or auto-select if only one brand
  const preselectedCompany = companyUuid
    ? companies.find((c) => c.uuid === companyUuid)
    : companies.length === 1
      ? companies[0]
      : undefined;

  // If no credits available, show the purchase credits banner
  if (!creditBalance.hasCredits) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Create Press Release
          </h1>
          <p className="text-gray-600">
            Start a new press release for distribution
          </p>
        </div>

        <NoCreditsBanner canPurchase={canPurchase} />
      </div>
    );
  }

  return (
    <PRForm
      companies={companies}
      categories={topCategories}
      topCategories={topCategories}
      regions={regions}
      creditsByCompany={creditMap}
      userCredits={creditBalance.userCredits}
      pageTitle="Create Press Release"
      pageDescription="Start a new press release for distribution"
      showPreview
      initialData={
        preselectedCompany ? { companyId: preselectedCompany.id } : undefined
      }
    />
  );
}
