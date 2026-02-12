import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { influencer, mpRequests, users } from '@/db/schema'
import { eq, desc, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Inbox, ArrowLeft, Clock, CheckCircle, XCircle } from 'lucide-react'

async function getInfluencerRequests(userId: number) {
  // Get user's influencer profile
  const myInfluencer = await db.query.influencer.findFirst({
    where: eq(influencer.userId, userId),
  })

  if (!myInfluencer) return null

  // Get pending requests for this influencer
  const requests = await db
    .select({
      request: mpRequests,
      buyer: users,
    })
    .from(mpRequests)
    .innerJoin(users, eq(mpRequests.userId, users.id))
    .where(eq(mpRequests.influencerId, myInfluencer.id))
    .orderBy(desc(mpRequests.createdAt))
    .limit(50)

  return { myInfluencer, requests }
}

export default async function InfluencerRequestsPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const data = await getInfluencerRequests(userId)

  if (!data) {
    redirect('/influencer/become')
  }

  const { myInfluencer, requests } = data

  const getStatusBadge = (request: typeof requests[0]['request']) => {
    if (request.taskComplete) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3" />
          Completed
        </span>
      )
    }
    if (request.sellerDecline) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="h-3 w-3" />
          Declined
        </span>
      )
    }
    if (request.buyerWithdrawn) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Withdrawn
        </span>
      )
    }
    if (request.sellerAccept) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          In Progress
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/influencer">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
            <p className="text-gray-500">Manage your incoming requests</p>
          </div>
        </div>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No requests yet</h3>
            <p className="mt-2 text-gray-500">
              When clients request your services, they&apos;ll appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map(({ request, buyer }) => (
            <Card key={request.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(request)}
                    </div>
                    <p className="font-medium text-gray-900">
                      Request from {buyer.email}
                    </p>
                    {request.msg && (
                      <p className="text-sm text-gray-600 mt-2">{request.msg}</p>
                    )}
                    {request.offer && (
                      <p className="text-sm text-gray-500 mt-2">
                        Offer: <span className="font-medium">${request.offer}</span>
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Received: {request.createdAt ? new Date(request.createdAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>

                  {!request.sellerAccept && !request.sellerDecline && !request.buyerWithdrawn && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        Decline
                      </Button>
                      <Button size="sm">
                        Accept
                      </Button>
                    </div>
                  )}

                  {request.sellerAccept && !request.taskComplete && (
                    <Button size="sm">
                      Mark Complete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
