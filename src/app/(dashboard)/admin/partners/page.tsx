import { auth } from '@/lib/auth'
import { db } from '@/db'
import { partners } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus } from 'lucide-react'
import { PartnerList } from './partner-list'

async function getPartners() {
  const allPartners = await db
    .select()
    .from(partners)
    .where(eq(partners.isDeleted, false))
    .orderBy(desc(partners.createdAt))

  return allPartners
}

export default async function AdminPartnersPage() {
  const session = await auth()

  // Check admin access
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const allPartners = await getPartners()

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Admin
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partners</h1>
          <p className="text-gray-600">Manage partner accounts and settings</p>
        </div>
        <Button className="gap-2 bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer">
          <Plus className="h-4 w-4" />
          Add Partner
        </Button>
      </div>

      <PartnerList
        partners={allPartners.map((p) => ({
          id: p.id,
          company: p.company,
          brandName: p.brandName,
          handle: p.handle,
          logo: p.logo,
          isActive: p.isActive,
          partnerType: p.partnerType,
          contactEmail: p.contactEmail,
          basePrice: p.basePrice,
        }))}
      />
    </div>
  )
}
