import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { influencer, influencerInventory } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Users, ShoppingCart, Briefcase } from 'lucide-react'

async function getInfluencerProfile(uuid: string) {
  const profile = await db.query.influencer.findFirst({
    where: eq(influencer.uuid, uuid),
  })

  if (!profile) return null

  // Get their active inventory
  const inventory = await db.query.influencerInventory.findMany({
    where: and(
      eq(influencerInventory.influencerId, profile.id),
      eq(influencerInventory.isDeleted, false)
    ),
  })

  return { profile, inventory }
}

interface PageProps {
  params: Promise<{ uuid: string }>
}

export default async function InfluencerProfilePage({ params }: PageProps) {
  const { uuid } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const data = await getInfluencerProfile(uuid)

  if (!data) {
    notFound()
  }

  const { profile, inventory } = data
  const isOwner = profile.userId === userId

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/influencer/search">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Search
          </Button>
        </Link>
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.name || ''}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium text-3xl">
                {profile.name?.[0] || '?'}
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {profile.name || 'Unnamed Influencer'}
              </h1>
              <div className="flex items-center gap-6 mt-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  {profile.completedJobs || 0} jobs completed
                </span>
              </div>
            </div>
            {isOwner && (
              <Link href="/influencer/become">
                <Button variant="outline">Edit Profile</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      {profile.bio && (
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 whitespace-pre-wrap">{profile.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Inventory / Services */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Services</h2>
        {inventory.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No services listed</h3>
              <p className="mt-2 text-gray-500">
                This influencer hasn&apos;t added any services yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inventory.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{item.handle || 'Service'}</h3>
                      {item.description && (
                        <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                      )}
                      {item.audienceSize && (
                        <p className="text-xs text-gray-400 mt-2">
                          Audience: {item.audienceSize.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {item.threshold && (
                        <p className="text-lg font-bold text-gray-900">
                          ${item.threshold.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                  {!isOwner && (
                    <Button className="w-full mt-4" size="sm">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Request Service
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Contact */}
      {!isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Contact This Influencer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Interested in working with this influencer? Send them a message to get started.
            </p>
            <Button>
              Send Message
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
