import { getEffectiveSession } from "@/lib/auth";
import { db } from "@/db";
import { company, brandCredits } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { CompanyList } from "./company-list";

async function getUserCompanies(userId: number) {
  return await db.query.company.findMany({
    where: and(
      eq(company.userId, userId),
      eq(company.isDeleted, false),
      eq(company.isArchived, false),
    ),
    orderBy: desc(company.id),
  });
}

async function getBrandCredits(
  companyIds: number[],
): Promise<Map<number, number>> {
  if (companyIds.length === 0) return new Map();

  const results = await db
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
      )})`,
    )
    .groupBy(brandCredits.companyId);

  const creditMap = new Map<number, number>();
  for (const row of results) {
    if (row.companyId !== null) {
      creditMap.set(row.companyId, Number(row.balance));
    }
  }
  return creditMap;
}

export default async function CompaniesPage() {
  const session = await getEffectiveSession();
  const userId = parseInt(session?.user?.id || "0");
  const companies = await getUserCompanies(userId);
  const companyIds = companies.map((c) => c.id);
  const creditsByCompany = await getBrandCredits(companyIds);

  // Convert Map to plain object for client component
  const creditsRecord: Record<number, number> = {};
  for (const [key, value] of creditsByCompany) {
    creditsRecord[key] = value;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
          <p className="text-gray-600">
            Manage your company and brand profiles
          </p>
        </div>
        <Link href="/company/add">
          <Button className="gap-2 bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer">
            <Plus className="h-4 w-4" />
            Add Brand
          </Button>
        </Link>
      </div>

      <CompanyList
        companies={companies.map((co) => ({
          id: co.id,
          uuid: co.uuid!,
          companyName: co.companyName,
          logoUrl: co.logoUrl,
          website: co.website,
          city: co.city,
          state: co.state,
        }))}
        creditsByCompany={creditsRecord}
      />
    </div>
  );
}
