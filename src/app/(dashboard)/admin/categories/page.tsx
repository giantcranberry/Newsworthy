import { auth } from '@/lib/auth'
import { db } from '@/db'
import { category } from '@/db/schema'
import { asc, eq, ilike, or } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CategoryList } from './category-list'

async function getCategories(search: string | null) {
  const query = db.select().from(category).orderBy(asc(category.name))

  if (search) {
    return query.where(
      or(
        ilike(category.name, `%${search}%`),
        ilike(category.slug, `%${search}%`),
        ilike(category.circuit, `%${search}%`)
      )
    )
  }

  return query
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
  const categories = await getCategories(search || null)

  // Get unique circuits for filter
  const circuits = [...new Set(categories.map(c => c.circuit).filter(Boolean))] as string[]

  // Get unique parent categories for the form dropdown
  const parentOptions = [...new Set(categories.map(c => c.name))].sort()

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Admin
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        <p className="text-gray-600">Manage press release categories</p>
      </div>

      <CategoryList
        categories={categories}
        circuits={circuits}
        parentOptions={parentOptions}
        currentSearch={search || ''}
      />
    </div>
  )
}
