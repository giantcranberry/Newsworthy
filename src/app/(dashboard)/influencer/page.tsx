import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { influencer, influencerInventory, activities } from '@/db/schema'
import { eq, and, desc, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, ShoppingBag, DollarSign, Plus, Search } from 'lucide-react'

async function getInfluencerStats(userId: number) {
  // Get user's influencer profile if they have one
  const myInfluencer = await db.query.influencer.findFirst({
    where: eq(influencer.userId, userId),
  })

  // Get active inventory count if they're an influencer
  let inventoryCount = 0
  if (myInfluencer) {
    const inventory = await db.query.influencerInventory.findMany({
      where: and(
        eq(influencerInventory.influencerId, myInfluencer.id),
        eq(influencerInventory.isDeleted, false)
      ),
    })
    inventoryCount = inventory.length
  }

  return { myInfluencer, inventoryCount }
}

async function getFeaturedInfluencers() {
  const influencers = await db
    .select()
    .from(influencer)
    .orderBy(desc(influencer.completedJobs))
    .limit(6)

  return influencers
}

async function getActivities() {
  const allActivities = await db.query.activities.findMany({
    where: eq(activities.isActive, true),
  })
  return allActivities
}

export default async function InfluencerPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const [{ myInfluencer, inventoryCount }, featuredInfluencers, allActivities] = await Promise.all([
    getInfluencerStats(userId),
    getFeaturedInfluencers(),
    getActivities(),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Influencer Marketplace</h1>
          <p className="text-gray-500">Connect with influencers to amplify your PR</p>
        </div>
        <div className="flex gap-3">
          <Link href="/influencer/search">
            <Button variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Search Influencers
            </Button>
          </Link>
          {!myInfluencer && (
            <Link href="/influencer/become">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Become an Influencer
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* My Influencer Stats (if applicable) */}
      {myInfluencer && (
        <Card>
          <CardHeader>
            <CardTitle>Your Influencer Profile</CardTitle>
            <CardDescription>Manage your influencer presence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{inventoryCount}</p>
                <p className="text-sm text-gray-500">Active Offerings</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">
                  {myInfluencer.completedJobs || 0}
                </p>
                <p className="text-sm text-gray-500">Completed Jobs</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link href={`/influencer/${myInfluencer.uuid}`}>
                <Button variant="outline">View Profile</Button>
              </Link>
              <Link href="/influencer/requests">
                <Button>View Requests</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories */}
      {allActivities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Browse by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {allActivities.map((activity) => (
                <Link
                  key={activity.id}
                  href={`/influencer/search?activity=${activity.id}`}
                  className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {activity.icon && (
                    <span className="text-lg">{activity.icon}</span>
                  )}
                  <span className="text-sm font-medium">{activity.name}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Featured Influencers */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Featured Influencers</h2>
        {featuredInfluencers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No influencers yet</h3>
              <p className="mt-2 text-gray-500">Be the first to join our marketplace!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredInfluencers.map((inf) => (
              <Card key={inf.id}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium text-lg">
                      {inf.name?.[0] || '?'}
                    </div>
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
                  <div className="mt-4">
                    <Link href={`/influencer/${inf.uuid}`}>
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
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-medium">1. Find Influencers</h3>
              <p className="text-sm text-gray-500 mt-1">
                Search our marketplace for influencers in your industry
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <ShoppingBag className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-medium">2. Purchase Services</h3>
              <p className="text-sm text-gray-500 mt-1">
                Browse their offerings and add to your cart
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-medium">3. Get Results</h3>
              <p className="text-sm text-gray-500 mt-1">
                Track your campaigns and measure impact
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
