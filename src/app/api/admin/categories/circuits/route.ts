import { auth } from '@/lib/auth'
import { db } from '@/db'
import { circuits, circuitCategories } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const session = await auth()
    const isAdmin = (session?.user as any)?.isAdmin

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Circuit name is required' },
        { status: 400 }
      )
    }

    const [newCircuit] = await db
      .insert(circuits)
      .values({ name: name.trim() })
      .returning()

    return NextResponse.json(newCircuit)
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'A circuit with this name already exists' },
        { status: 409 }
      )
    }
    console.error('Error creating circuit:', error)
    return NextResponse.json(
      { error: 'Failed to create circuit' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth()
    const isAdmin = (session?.user as any)?.isAdmin

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id, name } = await request.json()

    if (!id || !name?.trim()) {
      return NextResponse.json(
        { error: 'Circuit id and name are required' },
        { status: 400 }
      )
    }

    const [updated] = await db
      .update(circuits)
      .set({ name: name.trim() })
      .where(eq(circuits.id, id))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: 'Circuit not found' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'A circuit with this name already exists' },
        { status: 409 }
      )
    }
    console.error('Error renaming circuit:', error)
    return NextResponse.json(
      { error: 'Failed to rename circuit' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    const isAdmin = (session?.user as any)?.isAdmin

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { circuitId, categoryId } = await request.json()

    if (!circuitId || !categoryId) {
      return NextResponse.json(
        { error: 'circuitId and categoryId are required' },
        { status: 400 }
      )
    }

    await db
      .delete(circuitCategories)
      .where(
        and(
          eq(circuitCategories.circuitId, circuitId),
          eq(circuitCategories.categoryId, categoryId)
        )
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unlinking category from circuit:', error)
    return NextResponse.json(
      { error: 'Failed to unlink category' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth()
    const isAdmin = (session?.user as any)?.isAdmin

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Circuit id is required' },
        { status: 400 }
      )
    }

    const [deleted] = await db
      .delete(circuits)
      .where(eq(circuits.id, id))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Circuit not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting circuit:', error)
    return NextResponse.json(
      { error: 'Failed to delete circuit' },
      { status: 500 }
    )
  }
}
