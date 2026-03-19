import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, banners } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getUserCompanyIds } from '@/lib/team-auth'

function isEditorialUser(session: any): boolean {
  const user = session?.user
  return !!(user && ((user as any).isEditor || (user as any).isAdmin))
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
    with: { banner: true },
  }) as any

  if (!release) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!isEditorialUser(session) && release.userId !== userId) {
    const companyIds = await getUserCompanyIds(userId)
    if (!companyIds.includes(release.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  if (!release?.banner?.url) {
    return NextResponse.json({ error: 'No banner found' }, { status: 404 })
  }

  try {
    const res = await fetch(release.banner.url)
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buffer = await res.arrayBuffer()

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to proxy image' }, { status: 502 })
  }
}
