import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getEffectiveSession } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Podcast, ExternalLink } from 'lucide-react'
import {
  getUserFeedByUuid,
  getFeedEpisodes,
  getPodcastCreditsForCompany,
} from '@/lib/podcasts/access'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { EpisodeList } from './episode-list'
import { TabsNav } from './tabs-nav'
import { NotificationsTab } from './notifications-tab'
import { FundingTab } from './funding-tab'

const VALID_TABS = ['episodes', 'notifications', 'funding'] as const
type Tab = (typeof VALID_TABS)[number]

export default async function PodcastFeedPage({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { uuid } = await params
  const { tab: rawTab } = await searchParams
  const session = await getEffectiveSession()
  if (!session?.user?.id) redirect('/login')
  const userId = parseInt(session.user.id)

  const feed = await getUserFeedByUuid(userId, uuid)
  if (!feed) notFound()

  const tab: Tab = (VALID_TABS as readonly string[]).includes(rawTab || '')
    ? (rawTab as Tab)
    : 'episodes'

  const credits = await getPodcastCreditsForCompany(feed.companyId)

  const stepsDone = {
    episodes: true,
    notifications: !!feed.notificationsSavedAt,
    funding: credits.totalCredits > 0 || credits.batches.length > 0,
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/pr/podcast" className="text-sm text-cyan-700 dark:text-cyan-400 hover:underline">
          ← All podcast feeds
        </Link>
      </div>

      <Card>
        <CardContent className="flex gap-6 p-6">
          <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
            {feed.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={feed.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Podcast className="h-12 w-12 text-gray-400" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {feed.company?.companyName}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {feed.title || feed.feedUrl}
            </h1>
            {feed.author && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{feed.author}</p>
            )}
            {feed.description && (
              <p className="mt-3 line-clamp-3 text-sm text-gray-700 dark:text-gray-300">
                {feed.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <a
                href={feed.feedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                RSS feed
              </a>
              {feed.link && (
                <a
                  href={feed.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Show website
                </a>
              )}
              {feed.itunesCategory && <span>Category: {feed.itunesCategory}</span>}
              {feed.lastFetchedAt && (
                <span>Last fetched: {new Date(feed.lastFetchedAt).toLocaleString()}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <TabsNav feedUuid={feed.uuid} active={tab} stepsDone={stepsDone} />

      {tab === 'episodes' && (await renderEpisodesTab(feed.id, feed.uuid))}
      {tab === 'notifications' && (await renderNotificationsTab(feed, userId))}
      {tab === 'funding' && <FundingTab feedUuid={feed.uuid} credits={serializeCredits(credits)} />}
    </div>
  )
}

async function renderEpisodesTab(feedId: number, feedUuid: string) {
  const episodes = await getFeedEpisodes(feedId)
  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Episodes ({episodes.length})
      </h2>
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        Toggle <strong>Skip</strong> on any episode you don't want turned into a press release.
      </p>
      <EpisodeList
        feedUuid={feedUuid}
        episodes={episodes.map((e) => ({
          uuid: e.uuid,
          title: e.title,
          publishedAt: e.publishedAt ? e.publishedAt.toISOString() : null,
          durationSeconds: e.durationSeconds,
          episodeNumber: e.episodeNumber,
          seasonNumber: e.seasonNumber,
          imageUrl: e.imageUrl,
          link: e.link,
          skip: e.skip,
          transcriptionStatus: e.transcriptionStatus,
          transcriptionError: e.transcriptionError,
          releaseId: e.releaseId,
          releaseUuid: e.release?.uuid ?? null,
          releaseStatus: e.release?.status ?? null,
        }))}
      />
    </div>
  )
}

async function renderNotificationsTab(
  feed: NonNullable<Awaited<ReturnType<typeof getUserFeedByUuid>>>,
  userId: number,
) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true },
  })
  return (
    <NotificationsTab
      feedUuid={feed.uuid}
      accountEmail={user?.email || ''}
      initial={{
        notifyEmail: feed.notifyEmail,
        notifyEmailTo: feed.notifyEmailTo,
        notifySms: feed.notifySms,
        notifySmsPhone: feed.notifySmsPhone,
        notifyInApp: feed.notifyInApp,
        notifySlack: feed.notifySlack,
        notifySlackWebhookUrl: feed.notifySlackWebhookUrl,
        savedAt: feed.notificationsSavedAt ? feed.notificationsSavedAt.toISOString() : null,
      }}
    />
  )
}

function serializeCredits(credits: Awaited<ReturnType<typeof getPodcastCreditsForCompany>>) {
  return {
    totalCredits: credits.totalCredits,
    earliestExpiresAt: credits.earliestExpiresAt ? credits.earliestExpiresAt.toISOString() : null,
    batches: credits.batches.map((b) => ({
      id: b.id,
      credits: b.credits,
      expiresAt: b.expiresAt ? b.expiresAt.toISOString() : null,
      createdAt: b.createdAt.toISOString(),
    })),
  }
}
