import { auth } from '@/lib/auth'
import { db } from '@/db'
import { category, circuitCategories } from '@/db/schema'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const session = await auth()
    const isAdmin = (session?.user as any)?.isAdmin

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { name, slug, description, circuitIds, parentSlug, parentCategory } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    const [newCategory] = await db
      .insert(category)
      .values({
        name,
        slug,
        description: description || null,
        parentSlug: parentSlug || null,
        parentCategory: parentCategory || null,
      })
      .returning()

    if (circuitIds?.length > 0) {
      await db.insert(circuitCategories).values(
        circuitIds.map((circuitId: number) => ({
          circuitId,
          categoryId: newCategory.id,
        }))
      )
    }

    return NextResponse.json(newCategory)
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'A category with this slug already exists' },
        { status: 409 }
      )
    }
    console.error('Error creating category:', error)
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
}
