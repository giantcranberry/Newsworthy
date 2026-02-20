import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { eq, desc, and, inArray, or, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Plus, Edit } from 'lucide-react'
import { DeleteReleaseButton } from '../delete-release-button'

async function getDraftReleases(userId: number) {
  return await db.query.releases.findMany({
    where: and(
      eq(releases.userId, userId),
      or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
      inArray(releases.status, ['start', 'draft', 'draftnxt'])
    ),
    orderBy: desc(releases.createdAt),
    with: {
      company: true,
      primaryImage: true,
      banner: true,
    },
  })
}

export default async function DraftsPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const drafts = await getDraftReleases(userId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drafts</h1>
          <p className="text-gray-600">
            Press releases not yet submitted for review
          </p>
        </div>
        <Link href="/pr/create">
          <Button className="gap-2 bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer">
            <Plus className="h-4 w-4" />
            New Release
          </Button>
        </Link>
      </div>

      {/* Drafts List */}
      {drafts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No drafts
            </h3>
            <p className="mt-2 text-gray-600">
              You don&apos;t have any draft press releases. Start a new one to
              get going.
            </p>
            <Link href="/pr/create">
              <Button className="mt-6 gap-2 bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer">
                <Plus className="h-4 w-4" />
                Create Release
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {drafts.map((release) => (
            <Card key={release.id} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                {/* Banner */}
                {release.banner?.url || release.primaryImage?.url ? (
                  <>
                    <div className="sm:hidden w-full">
                      <img
                        src={(() => {
                          const url = release.banner?.url || release.primaryImage!.url
                          return url.includes('cdn.filestac') ? url.replace(/RESIZE/i, 'resize=width:1200') : url
                        })()}
                        alt={release.title || ''}
                        className="w-full"
                      />
                    </div>
                    <div className="hidden sm:block w-48 flex-shrink-0 pt-6 pl-4 self-start">
                      <img
                        src={(() => {
                          const url = release.banner?.url || release.primaryImage!.url
                          return url.includes('cdn.filestac') ? url.replace(/RESIZE/i, 'resize=width:1200') : url
                        })()}
                        alt={release.title || ''}
                        className="w-full rounded"
                      />
                    </div>
                  </>
                ) : (
                  <div className="hidden sm:flex w-48 flex-shrink-0 items-center justify-center">
                    <FileText className="h-12 w-12 text-gray-400" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">
                          Draft
                        </span>
                      </div>
                      <Link href={`/pr/${release.uuid}`} className="cursor-pointer">
                        <h3 className="text-lg font-semibold text-gray-900 hover:text-cyan-800 truncate">
                          {release.title || 'Untitled Release'}
                        </h3>
                      </Link>
                      <p className="text-sm text-gray-600 mt-1">
                        {release.company?.companyName}
                      </p>
                      {release.abstract && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {release.abstract}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>
                          Created:{' '}
                          {new Date(release.createdAt!).toLocaleDateString()}
                        </span>
                        {release.releaseAt && (
                          <span>
                            Release:{' '}
                            {new Date(release.releaseAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link href={`/pr/${release.uuid}`}>
                        <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900">
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </Link>
                      <DeleteReleaseButton
                        uuid={release.uuid!}
                        title={release.title}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
