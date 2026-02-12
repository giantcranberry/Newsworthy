import { auth } from '@/lib/auth'
import { db } from '@/db'
import { partners } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, Settings } from 'lucide-react'

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Partners</h1>
            <p className="text-gray-500">Manage partner accounts and settings</p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Partner
        </Button>
      </div>

      {/* Partners Grid */}
      {allPartners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">No partners found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allPartners.map((partner) => (
            <Card key={partner.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {partner.logo ? (
                    <img
                      src={partner.logo}
                      alt={partner.company || ''}
                      className="h-12 w-12 rounded object-contain bg-gray-100"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-gray-200 flex items-center justify-center text-gray-500 font-medium">
                      {partner.company?.[0] || '?'}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {partner.company || partner.brandName || 'Unnamed Partner'}
                    </h3>
                    {partner.handle && (
                      <p className="text-sm text-gray-500">@{partner.handle}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        partner.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {partner.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {partner.partnerType && (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                          {partner.partnerType}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm text-gray-500 space-y-1">
                    {partner.contactEmail && (
                      <p>Contact: {partner.contactEmail}</p>
                    )}
                    {partner.basePrice !== null && partner.basePrice !== undefined && (
                      <p>Base Price: ${(partner.basePrice / 100).toFixed(2)}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <Button variant="outline" className="w-full" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
