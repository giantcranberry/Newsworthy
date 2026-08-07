import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import { company, category, region, brandCredits, companyMembers, releases } from "@/db/schema";
import { eq, and, isNull, sql, inArray, notInArray, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PRForm } from "../pr-form";
import { getUserCompanyIds } from "@/lib/team-auth";
import { qualifiesForFreeFirstPr } from "@/lib/pr-checkout";
import { evaluateBrandSetup } from "@/lib/brand-setup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Info, Building2 } from "lucide-react";

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
    redirect("/company/add");
  }

  // Require a fully set up brand profile (through the newsroom) before the FIRST
  // release can be created. Scoped to users who have never submitted a
  // release, so existing customers with older, partially-filled brand
  // profiles are never locked out of creating new releases.
  const submittedBefore = await db
    .select({ id: releases.id })
    .from(releases)
    .where(
      and(
        eq(releases.userId, userId),
        notInArray(releases.status, ["draftnxt", "draft", "start"]),
        or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
      ),
    )
    .limit(1);

  const setupStatuses = companies.map((co) =>
    evaluateBrandSetup(co, co.contacts.length),
  );
  if (submittedBefore.length === 0 && !setupStatuses.some((s) => s.complete)) {
    const firstIncomplete = setupStatuses[0];
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Create Press Release
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Start a new press release for distribution
          </p>
        </div>

        <Card className="border-cyan-600/40">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-full">
                <Building2 className="h-6 w-6 text-cyan-700 dark:text-cyan-400" />
              </div>
              <CardTitle>Complete your brand profile first</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Your press releases publish with your brand&apos;s logo, contact, and
              newsroom settings — finish these steps and you&apos;ll be ready to write:
            </p>
            <ul className="space-y-1">
              {firstIncomplete.missing.map((item) => (
                <li key={item.href + item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-cyan-800 dark:text-cyan-400 underline hover:text-cyan-900 dark:hover:text-cyan-300"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {firstIncomplete.nextHref && (
              <Button asChild className="bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700">
                <Link href={firstIncomplete.nextHref}>Continue brand setup</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
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

  // Drafting is free — credits are consumed when the release is submitted for
  // editorial review, so users without credits still get the full form.
  const firstReleaseFree = !creditBalance.hasCredits
    ? await qualifiesForFreeFirstPr(userId)
    : false;

  return (
    <div className="space-y-6">
      {!creditBalance.hasCredits && (
        <div className="flex items-start gap-3 p-4 bg-cyan-700/5 border border-cyan-600 rounded-lg">
          <Info className="h-5 w-5 text-cyan-700 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-cyan-800 dark:text-cyan-400">
            {firstReleaseFree
              ? "Your first press release is on us — write it now and submit it for review at no cost."
              : canPurchase
                ? "Writing and previewing your press release is free. You'll purchase a press release credit when you submit it for review."
                : "Writing and previewing your press release is free. One press release credit is required at submission — ask the brand owner or a brand admin to purchase credits before you submit."}
          </p>
        </div>
      )}
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
    </div>
  );
}
