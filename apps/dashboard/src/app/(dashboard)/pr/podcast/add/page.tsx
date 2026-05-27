import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getEffectiveSession } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getBrandsAvailableForFeed } from '@/lib/podcasts/access'
import { AddFeedForm } from './add-feed-form'

export default async function AddPodcastFeedPage() {
  const session = await getEffectiveSession()
  if (!session?.user?.id) redirect('/login')
  const userId = parseInt(session.user.id)
  const brands = await getBrandsAvailableForFeed(userId)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/pr/podcast" className="text-sm text-cyan-700 dark:text-cyan-400 hover:underline">
          ← Back to podcast feeds
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Add Podcast Feed</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Connect a podcast RSS feed to one of your brand profiles. Each brand can have one feed.
        </p>
      </div>

      {brands.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-700 dark:text-gray-300">
              All your brand profiles already have a podcast feed, or you don't have any brands you can
              edit.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Link href="/company/add">
                <Button variant="outline" className="cursor-pointer">Create a brand</Button>
              </Link>
              <Link href="/pr/podcast">
                <Button className="bg-cyan-800 hover:bg-cyan-900 text-white cursor-pointer">
                  Back to feeds
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <AddFeedForm brands={brands} />
      )}
    </div>
  )
}
