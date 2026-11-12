import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases, users, userProfiles, company, releaseEnhanced, releaseImages, banners } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const prId = request.nextUrl.searchParams.get('prId')

  if (!prId || !/^\d+$/.test(prId)) {
    return NextResponse.json({ error: 'Valid PR ID required' }, { status: 400 })
  }

  const release = await db.query.releases.findFirst({
    where: eq(releases.id, parseInt(prId)),
  })

  if (!release) {
    return NextResponse.json({ error: `Press release ${prId} not found` }, { status: 404 })
  }

  const [user, profile, brand, enhanced, banner, ri] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, release.userId) }),
    db.query.userProfiles.findFirst({ where: eq(userProfiles.userId, release.userId) }),
    db.query.company.findFirst({ where: eq(company.id, release.companyId) }),
    db.query.releaseEnhanced.findFirst({ where: eq(releaseEnhanced.prid, release.id) }),
    release.bannerId ? db.query.banners.findFirst({ where: eq(banners.id, release.bannerId) }) : Promise.resolve(null),
    db.query.releaseImages.findMany({
      where: eq(releaseImages.releaseId, release.id),
      orderBy: [asc(releaseImages.sortOrder)],
      with: { image: true },
    }),
  ])

  return NextResponse.json({
    release: {
      id: release.id,
      uuid: release.uuid,
      title: release.title,
      status: release.status,
      distribution: release.distribution,
      createdAt: release.createdAt,
      releaseAt: release.releaseAt,
      releasedAt: release.releasedAt,
      slug: release.slug,
      elasticDoc: release.elasticDoc,
      isDeleted: release.isDeleted,
      isArchived: release.isArchived,
    },
    user: user ? {
      id: user.id,
      email: user.email,
      firstName: profile?.firstName || null,
      lastName: profile?.lastName || null,
      isAdmin: user.isAdmin,
      isEditor: user.isEditor,
      isStaff: user.isStaff,
    } : null,
    brand: brand ? {
      id: brand.id,
      uuid: brand.uuid,
      companyName: brand.companyName,
      logoUrl: brand.logoUrl,
    } : null,
    reportUrl: enhanced?.reportUrl || null,
    banner: banner ? {
      id: banner.id,
      url: banner.url,
      title: banner.title,
      imgCredits: banner.imgCredits,
    } : null,
    images: ri
      .filter((r) => r.image)
      .map((r) => ({
        imageId: r.imageId,
        url: r.image!.url,
        title: r.image!.title,
        imgCredits: r.image!.imgCredits,
      })),
  })
}
