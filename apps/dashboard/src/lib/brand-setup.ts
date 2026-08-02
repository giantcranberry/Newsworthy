import { db } from '@/db'
import { contact } from '@/db/schema'
import { and, eq, isNull, or, sql } from 'drizzle-orm'

// Brand-profile setup completeness. A brand counts as fully set up once the
// wizard steps through SEO/AIO all have data: website (Edit Brand), logo,
// at least one PR contact, newsroom title/description, and a saved SEO/AIO
// config. Lists and Brand Assets are optional and not required. While
// incomplete, the brand nav runs in setup mode (last step "Create PR"
// instead of "Brand Assets") and release creation is blocked.

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
  seo: unknown
}

export function evaluateBrandSetup(co: CompanyLike, contactCount: number): BrandSetupStatus {
  const base = `/company/${co.uuid}`
  const missing: BrandSetupItem[] = []

  if (!co.website) missing.push({ label: 'Add your website to the brand details', href: base })
  if (!co.logoUrl) missing.push({ label: 'Upload your logo', href: `${base}/logo` })
  if (contactCount === 0) missing.push({ label: 'Add a PR contact', href: `${base}/contacts` })
  if (!co.nrTitle || !co.nrDesc) missing.push({ label: 'Set up your newsroom (title and description)', href: `${base}/newsroom` })
  if (!co.seo) missing.push({ label: 'Configure SEO/AIO', href: `${base}/seo` })

  return {
    complete: missing.length === 0,
    missing,
    nextHref: missing[0]?.href ?? null,
  }
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
