import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { pitchGroups, pitchList } from '@/db/schema'
import { eq, desc, count } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, List, Users, Trash2 } from 'lucide-react'

async function getUserLists(userId: number) {
  const lists = await db.query.pitchGroups.findMany({
    where: eq(pitchGroups.userId, userId),
    orderBy: [desc(pitchGroups.createdAt)],
  })

  // Get contact counts for each list
  const listsWithCounts = await Promise.all(
    lists.map(async (list) => {
      const [contactCount] = await db
        .select({ count: count() })
        .from(pitchList)
        .where(eq(pitchList.groupId, list.id))

      return {
        ...list,
        contactCount: contactCount.count,
      }
    })
  )

  return listsWithCounts
}

export default async function NewsDbListsPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const lists = await getUserLists(userId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/newsdb">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pitch Lists</h1>
            <p className="text-gray-500">Manage your media contact lists</p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create List
        </Button>
      </div>

      {/* Lists */}
      {lists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <List className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No lists yet</h3>
            <p className="mt-2 text-gray-500">
              Create your first list to start organizing contacts
            </p>
            <div className="mt-6">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create List
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <Card key={list.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <List className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {list.groupName || 'Unnamed List'}
                      </h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <Users className="h-3 w-3" />
                        {list.contactCount} contact{list.contactCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Created: {list.createdAt ? new Date(list.createdAt).toLocaleDateString() : 'N/A'}
                </p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" className="flex-1" size="sm">
                    View
                  </Button>
                  <Button className="flex-1" size="sm">
                    Export
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
