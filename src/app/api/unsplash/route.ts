import { getEffectiveSession } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const UNSPLASH_KEY = process.env.UNSPLASH_KEY

export async function GET(request: NextRequest) {
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!UNSPLASH_KEY) {
    return NextResponse.json({ error: 'Unsplash not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const page = searchParams.get('page') || '1'

  if (!query?.trim()) {
    return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
  }

  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=20&page=${page}`,
    {
      headers: {
        Authorization: `Client-ID ${UNSPLASH_KEY}`,
      },
    }
  )

  if (!res.ok) {
    return NextResponse.json({ error: 'Unsplash API error' }, { status: res.status })
  }

  const data = await res.json()

  const results = data.results.map((photo: any) => ({
    id: photo.id,
    urls: {
      small: photo.urls.small,
      regular: photo.urls.regular,
    },
    alt_description: photo.alt_description,
    user: {
      name: photo.user.name,
      links: { html: photo.user.links.html },
    },
    width: photo.width,
    height: photo.height,
  }))

  return NextResponse.json({
    results,
    total: data.total,
    total_pages: data.total_pages,
  })
}
