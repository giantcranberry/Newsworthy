import { db } from '@/db'
import { banners, contact, images } from '@/db/schema'
import { and, eq, isNull, or, sql } from 'drizzle-orm'

// Brand-profile setup completeness. A brand counts as fully set up once the
// wizard steps through the newsroom all have data: website (Edit Brand),
// logo, at least one PR contact, and newsroom title/description. SEO/AIO,
// Lists, and Brand Assets are optional and not required (saving the newsroom
// seeds the SEO/AIO meta defaults). While incomplete, the brand nav runs in
// setup mode (last step "Create PR" instead of "Brand Assets") and release
// creation is blocked.

export interface BrandSetupItem {
  label: string
  href: string
}

export interface BrandSetupStatus {
  complete: boolean
  missing: BrandSetupItem[]
  nextHref: string | null
}

type CompanyLike = {
  id: number
  uuid: string
  website: string | null
  logoUrl: string | null
  nrTitle: string | null
  nrDesc: string | null
}

export function evaluateBrandSetup(co: CompanyLike, contactCount: number): BrandSetupStatus {
  const base = `/company/${co.uuid}`
  const missing: BrandSetupItem[] = []

  if (!co.website) missing.push({ label: 'Add your website to the brand details', href: base })
  if (!co.logoUrl) missing.push({ label: 'Upload your logo', href: `${base}/logo` })
  if (contactCount === 0) missing.push({ label: 'Add a PR contact', href: `${base}/contacts` })
  if (!co.nrTitle || !co.nrDesc) missing.push({ label: 'Set up your newsroom (title and description)', href: `${base}/newsroom` })

  return {
    complete: missing.length === 0,
    missing,
    nextHref: missing[0]?.href ?? null,
  }
}

// Whether the brand has any media assets (news images or social banners).
// The Brand Assets nav tab stays hidden until there is something to manage.
export async function hasBrandAssets(companyId: number): Promise<boolean> {
  const [imageRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(images)
    .where(and(eq(images.companyId, companyId), sql`${images.isDeleted} IS NOT TRUE`))
  if (Number(imageRow?.count || 0) > 0) return true

  const [bannerRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(banners)
    .where(and(eq(banners.companyId, companyId), sql`${banners.isDeleted} IS NOT TRUE`))
  return Number(bannerRow?.count || 0) > 0
}

// Props for CompanyNav, computed in one place for every brand page.
export async function getBrandNavState(co: CompanyLike): Promise<{ setupMode: boolean; hasAssets: boolean }> {
  const [status, assets] = await Promise.all([getBrandSetupStatus(co), hasBrandAssets(co.id)])
  return { setupMode: !status.complete, hasAssets: assets }
}

export async function getBrandSetupStatus(co: CompanyLike): Promise<BrandSetupStatus> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contact)
    .where(
      and(
        eq(contact.companyId, co.id),
        or(eq(contact.isDeleted, false), isNull(contact.isDeleted)),
        or(eq(contact.isArchived, false), isNull(contact.isArchived)),
      ),
    )
  return evaluateBrandSetup(co, Number(row?.count || 0))
}
