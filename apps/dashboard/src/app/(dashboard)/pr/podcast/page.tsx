import Link from 'next/link'
import { getEffectiveSession } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Podcast, Coins } from 'lucide-react'
import { getUserFeeds } from '@/lib/podcasts/access'

export default async function PodcastPRPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const feeds = await getUserFeeds(userId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Podcast PR</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect a podcast feed to a brand and we'll turn each new episode into a press release.
          </p>
        </div>
        <Link href="/pr/podcast/add">
          <Button className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer">
            <Plus className="h-4 w-4" />
            Add Podcast Feed
          </Button>
        </Link>
      </div>

      {feeds.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Podcast className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              No podcast feeds yet
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Add your first podcast RSS feed to start generating press releases from new episodes.
            </p>
            <Link href="/pr/podcast/add">
              <Button className="mt-6 gap-2 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer">
                <Plus className="h-4 w-4" />
                Add Podcast Feed
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {feeds.map((feed) => {
            const remaining = Math.max(0, feed.episodeCount - feed.skippedCount)
            const hasCredits = feed.credits > 0
            return (
              <Card key={feed.id} className="overflow-hidden">
                <Link href={`/pr/podcast/${feed.uuid}`} className="block">
                  <CardContent className="flex gap-4 p-4">
                    <div className="h-20 w-20 flex-shrink-0 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      {feed.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={feed.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Podcast className="h-8 w-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {feed.company?.companyName}
                          </p>
                          <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {feed.title || feed.feedUrl}
                          </h3>
                        </div>
                        <span
                          className={
                            'inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ' +
                            (hasCredits
                              ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300')
                          }
                          title={hasCredits ? 'Active podcast PR credits' : 'No credits — purchase to publish'}
                        >
                          <Coins className="h-3 w-3" />
                          {feed.credits} credit{feed.credits === 1 ? '' : 's'}
                        </span>
                      </div>
                      {feed.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                          {feed.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>{remaining} active / {feed.episodeCount} episodes</span>
                        {feed.lastEpisodePublishedAt && (
                          <span>
                            Last episode:{' '}
                            {new Date(feed.lastEpisodePublishedAt).toLocaleDateString()}
                          </span>
                        )}
                        {!feed.isActive && <span className="text-amber-700 dark:text-amber-500">Paused</span>}
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
