import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { eq, desc, and, inArray, or, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Plus, Edit } from 'lucide-react'

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

function getStatusLabel(status: string) {
  switch (status) {
    case 'draft':
    case 'draftnxt':
    case 'start':
      return 'Draft'
    default:
      return status
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'draft':
    case 'draftnxt':
    case 'start':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
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
          <p className="text-gray-500">
            Press releases not yet submitted for review
          </p>
        </div>
        <Link href="/pr/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Release
          </Button>
        </Link>
      </div>

      {/* Drafts List */}
      {drafts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No drafts
            </h3>
            <p className="mt-2 text-gray-500">
              You don&apos;t have any draft press releases. Start a new one to
              get going.
            </p>
            <Link href="/pr/create">
              <Button className="mt-6 gap-2">
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
                {release.banner?.url ? (
                  <>
                    <div className="sm:hidden w-full aspect-[1200/630] bg-gray-100">
                      <img
                        src={release.banner.url.includes('cdn.filestac') ? release.banner.url.replace(/RESIZE/i, 'resize=width:1200') : release.banner.url}
                        alt={release.title || ''}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="hidden sm:block w-56 flex-shrink-0 bg-gray-100">
                      <img
                        src={release.banner.url.includes('cdn.filestac') ? release.banner.url.replace(/RESIZE/i, 'resize=width:1200') : release.banner.url}
                        alt={release.title || ''}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </>
                ) : (
                  <div className="hidden sm:flex w-56 flex-shrink-0 bg-gray-100 items-center justify-center">
                    <FileText className="h-12 w-12 text-gray-300" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(release.status)}`}
                        >
                          {getStatusLabel(release.status)}
                        </span>
                      </div>
                      <Link href={`/pr/${release.uuid}`}>
                        <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 truncate">
                          {release.title || 'Untitled Release'}
                        </h3>
                      </Link>
                      <p className="text-sm text-gray-500 mt-1">
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
                    <div className="flex items-center gap-2">
                      <Link href={`/pr/${release.uuid}`}>
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
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
