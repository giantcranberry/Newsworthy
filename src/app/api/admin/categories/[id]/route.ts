import { auth } from '@/lib/auth'
import { db } from '@/db'
import { category, circuitCategories } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const isAdmin = (session?.user as any)?.isAdmin

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const categoryId = parseInt(id)

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, slug, description, circuitIds, parentSlug, parentCategory } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(category)
      .set({
        name,
        slug,
        description: description || null,
        parentSlug: parentSlug || null,
        parentCategory: parentCategory || null,
      })
      .where(eq(category.id, categoryId))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Replace circuit assignments
    await db.delete(circuitCategories).where(eq(circuitCategories.categoryId, categoryId))

    if (circuitIds?.length > 0) {
      await db.insert(circuitCategories).values(
        circuitIds.map((circuitId: number) => ({
          circuitId,
          categoryId,
        }))
      )
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'A category with this slug already exists' },
        { status: 409 }
      )
    }
    console.error('Error updating category:', error)
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const isAdmin = (session?.user as any)?.isAdmin

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const categoryId = parseInt(id)

    if (isNaN(categoryId)) {
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(category)
      .where(eq(category.id, categoryId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    )
  }
}
