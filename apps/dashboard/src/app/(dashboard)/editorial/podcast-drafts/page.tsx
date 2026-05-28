import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases, company, users, podcastEpisodes, podcastFeeds } from '@/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Podcast } from 'lucide-react'

async function getPodcastDrafts() {
  return db
    .select({
      releaseId: releases.id,
      releaseUuid: releases.uuid,
      title: releases.title,
      createdAt: releases.createdAt,
      companyName: company.companyName,
      userEmail: users.email,
      feedTitle: podcastFeeds.title,
      episodeTitle: podcastEpisodes.title,
    })
    .from(podcastEpisodes)
    .innerJoin(releases, eq(podcastEpisodes.releaseId, releases.id))
    .innerJoin(podcastFeeds, eq(podcastEpisodes.feedId, podcastFeeds.id))
    .innerJoin(company, eq(releases.companyId, company.id))
    .innerJoin(users, eq(releases.userId, users.id))
    .where(and(eq(releases.status, 'draftnxt'), eq(releases.isDeleted, false)))
    .orderBy(desc(releases.createdAt))
}

export default async function PodcastDraftsPage() {
  const session = await auth()
  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isEditor && !isAdmin) {
    redirect('/dashboard')
  }

  const drafts = await getPodcastDrafts()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Podcast PR Drafts</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Unsubmitted press release drafts generated from podcast episodes
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-cyan-100 px-3 py-1.5 text-sm font-medium text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400">
          <Podcast className="h-4 w-4" />
          {drafts.length} draft{drafts.length === 1 ? '' : 's'}
        </span>
      </div>

      {drafts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Podcast className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">No podcast drafts</h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              There are no unsubmitted podcast PR drafts right now.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Brand</th>
                    <th className="px-4 py-3 font-medium">Podcast / Episode</th>
                    <th className="px-4 py-3 font-medium">Submitter</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => (
                    <tr
                      key={d.releaseId}
                      className="border-b border-slate-100 last:border-0 dark:border-gray-800/60"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {d.title || <span className="text-gray-400">Untitled</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{d.companyName}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        <div className="text-gray-900 dark:text-gray-200">{d.feedTitle || '—'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-500">{d.episodeTitle || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{d.userEmail}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
