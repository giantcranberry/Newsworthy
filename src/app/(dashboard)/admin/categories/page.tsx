import { auth } from '@/lib/auth'
import { db } from '@/db'
import { category, circuits, circuitCategories } from '@/db/schema'
import { and, asc, eq, ilike, or, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CategoryList } from './category-list'

async function getCategories(search: string | null) {
  const baseWhere = search
    ? or(
        ilike(category.name, `%${search}%`),
        ilike(category.slug, `%${search}%`)
      )
    : undefined

  const cats = await db
    .select()
    .from(category)
    .where(baseWhere)
    .orderBy(asc(category.name))

  // Get circuit assignments for all categories
  const assignments = await db
    .select({
      categoryId: circuitCategories.categoryId,
      circuitId: circuits.id,
      circuitName: circuits.name,
    })
    .from(circuitCategories)
    .innerJoin(circuits, eq(circuitCategories.circuitId, circuits.id))

  const assignmentMap = new Map<number, { id: number; name: string }[]>()
  for (const a of assignments) {
    if (!assignmentMap.has(a.categoryId)) {
      assignmentMap.set(a.categoryId, [])
    }
    assignmentMap.get(a.categoryId)!.push({ id: a.circuitId, name: a.circuitName })
  }

  return cats.map(c => ({
    ...c,
    circuits: assignmentMap.get(c.id) || [],
  }))
}

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    redirect('/dashboard')
  }

  const { search } = await searchParams
  const [categories, allCircuits] = await Promise.all([
    getCategories(search || null),
    db
      .select({
        id: circuits.id,
        name: circuits.name,
        count: sql<number>`(
          SELECT count(*) FROM circuit_categories
          WHERE circuit_categories.circuit_id = ${circuits.id}
        )`.as('count'),
      })
      .from(circuits)
      .orderBy(asc(circuits.name)),
  ])

  // Get unique parent categories for the form dropdown
  const parentOptions = [...new Set(categories.map(c => c.name))].sort()

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Admin
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Categories</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage press release categories</p>
      </div>

      <CategoryList
        categories={categories}
        circuits={allCircuits.map(c => ({ id: c.id, name: c.name }))}
        circuitsWithCounts={allCircuits.map(c => ({ id: c.id, name: c.name, count: Number(c.count) }))}
        parentOptions={parentOptions}
        currentSearch={search || ''}
      />
    </div>
  )
}
