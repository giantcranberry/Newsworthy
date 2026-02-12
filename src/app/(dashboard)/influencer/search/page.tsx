import { db } from '@/db'
import { influencer, activities } from '@/db/schema'
import { eq, desc, ilike, or, and } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users } from 'lucide-react'
import { InfluencerSearchForm } from './search-form'

interface SearchParams {
  q?: string
  activity?: string
}

async function searchInfluencers(params: SearchParams) {
  const conditions = []

  if (params.q) {
    conditions.push(
      or(
        ilike(influencer.name, `%${params.q}%`),
        ilike(influencer.bio, `%${params.q}%`)
      )
    )
  }

  let results
  if (conditions.length > 0) {
    results = await db
      .select()
      .from(influencer)
      .where(and(...conditions))
      .orderBy(desc(influencer.completedJobs))
      .limit(50)
  } else {
    results = await db
      .select()
      .from(influencer)
      .orderBy(desc(influencer.completedJobs))
      .limit(50)
  }

  return results
}

async function getActivities() {
  const allActivities = await db.query.activities.findMany({
    where: eq(activities.isActive, true),
  })
  return allActivities
}

interface PageProps {
  searchParams: Promise<SearchParams>
}

export default async function InfluencerSearchPage({ searchParams }: PageProps) {
  const params = await searchParams
  const [influencers, allActivities] = await Promise.all([
    searchInfluencers(params),
    getActivities(),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Search Influencers</h1>
        <p className="text-gray-500">Find the perfect influencer for your campaign</p>
      </div>

      {/* Search Form */}
      <InfluencerSearchForm
        initialQuery={params.q}
        initialActivity={params.activity}
        activities={allActivities}
      />

      {/* Results */}
      {influencers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No influencers found</h3>
            <p className="mt-2 text-gray-500">Try adjusting your search criteria</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {influencers.map((inf) => (
            <Card key={inf.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {inf.avatar ? (
                    <img
                      src={inf.avatar}
                      alt={inf.name || ''}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium text-xl">
                      {inf.name?.[0] || '?'}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {inf.name || 'Unnamed'}
                    </h3>
                    {inf.bio && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{inf.bio}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{inf.completedJobs || 0} jobs completed</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/influencer/${inf.uuid}`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      View Profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-500 text-center">
        Showing {influencers.length} {influencers.length === 1 ? 'influencer' : 'influencers'}
      </p>
    </div>
  )
}
