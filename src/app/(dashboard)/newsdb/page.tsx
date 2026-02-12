import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { pitchList, pitchGroups, userSubscription } from '@/db/schema'
import { eq, desc, count } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, Users, List, Mail, Database } from 'lucide-react'

async function getNewsDbStats(userId: number) {
  // Get user's credits
  const subscription = await db.query.userSubscription.findFirst({
    where: eq(userSubscription.userId, userId),
  })

  // Get pitch lists
  const lists = await db.query.pitchGroups.findMany({
    where: eq(pitchGroups.userId, userId),
  })

  // Get total contacts in lists
  const [contactCount] = await db
    .select({ count: count() })
    .from(pitchList)
    .where(eq(pitchList.userId, userId))

  return {
    credits: subscription?.newsdbCredits || 0,
    listCount: lists.length,
    contactCount: contactCount.count,
  }
}

export default async function NewsDbPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const stats = await getNewsDbStats(userId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media Database</h1>
          <p className="text-gray-500">Find and connect with journalists and media contacts</p>
        </div>
        <Link href="/newsdb/search">
          <Button>
            <Search className="h-4 w-4 mr-2" />
            Search Database
          </Button>
        </Link>
      </div>

      {/* Credits Balance */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">NewsDB Credits</p>
                <p className="text-2xl font-bold">{stats.credits}</p>
              </div>
            </div>
            <Link href="/payment/paygo">
              <Button variant="outline">Buy More Credits</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <List className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pitch Lists</p>
                <p className="text-xl font-bold">{stats.listCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Saved Contacts</p>
                <p className="text-xl font-bold">{stats.contactCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Mail className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pitches Sent</p>
                <p className="text-xl font-bold">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Search Journalists</CardTitle>
            <CardDescription>
              Find journalists by name, publication, or beat
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/newsdb/search">
              <Button className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Start Searching
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Pitch Lists</CardTitle>
            <CardDescription>
              Manage your saved journalist lists
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/newsdb/lists">
              <Button variant="outline" className="w-full">
                <List className="h-4 w-4 mr-2" />
                View Lists
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How NewsDB Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-medium">1. Search</h3>
              <p className="text-sm text-gray-500 mt-1">
                Find journalists by name, outlet, or topic
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-medium">2. Save to List</h3>
              <p className="text-sm text-gray-500 mt-1">
                Build targeted lists for your campaigns
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mb-3">
                <Mail className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-medium">3. Pitch</h3>
              <p className="text-sm text-gray-500 mt-1">
                Export contacts or send pitches directly
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
