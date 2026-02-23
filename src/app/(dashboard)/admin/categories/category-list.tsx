'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Tag, Search, FolderTree } from 'lucide-react'
import { CategoryForm } from './category-form'

interface Category {
  id: number
  slug: string
  circuit: string | null
  parentSlug: string | null
  parentCategory: string | null
  name: string
  description: string | null
}

interface CategoryListProps {
  categories: Category[]
  circuits: string[]
  parentOptions: string[]
  currentSearch: string
}

export function CategoryList({
  categories,
  circuits,
  parentOptions,
  currentSearch,
}: CategoryListProps) {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [search, setSearch] = useState(currentSearch)
  const [circuitFilter, setCircuitFilter] = useState<string>('all')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    router.push(`/admin/categories${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const handleCreate = () => {
    setEditingCategory(null)
    setShowDialog(true)
  }

  const handleEdit = (cat: Category) => {
    setEditingCategory(cat)
    setShowDialog(true)
  }

  const handleDelete = async (categoryId: number) => {
    if (!confirm('Are you sure you want to delete this category?')) return

    setIsDeleting(categoryId)
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete category')
      }
    } catch {
      alert('An error occurred')
    } finally {
      setIsDeleting(null)
    }
  }

  const handleSuccess = () => {
    setShowDialog(false)
    setEditingCategory(null)
    router.refresh()
  }

  const filtered = circuitFilter === 'all'
    ? categories
    : categories.filter(c => c.circuit === circuitFilter)

  return (
    <>
      {/* Search & Filter & Add */}
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        {circuits.length > 0 && (
          <select
            value={circuitFilter}
            onChange={(e) => setCircuitFilter(e.target.value)}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
          >
            <option value="all">All Circuits</option>
            {circuits.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        <Button onClick={handleCreate} className="gap-2 bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer">
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      <p className="text-sm text-gray-500">{filtered.length} categories</p>

      {/* Category List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Tag className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No categories found</h3>
            <p className="mt-2 text-gray-600">
              {currentSearch ? 'Try a different search term.' : 'Create your first category.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((cat) => (
            <Card key={cat.id} className="overflow-hidden">
              <div className="flex-1 min-w-0 p-4 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-cyan-800/10 flex items-center justify-center w-10 h-10 flex-shrink-0">
                      {cat.parentSlug ? (
                        <FolderTree className="h-5 w-5 text-cyan-800" />
                      ) : (
                        <Tag className="h-5 w-5 text-cyan-800" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{cat.name}</h3>
                        <span className="text-xs text-gray-400 font-mono">/{cat.slug}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {cat.circuit && (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {cat.circuit}
                          </span>
                        )}
                        {cat.parentCategory && (
                          <span className="text-xs text-gray-500">
                            Parent: {cat.parentCategory}
                          </span>
                        )}
                        {cat.description && (
                          <span className="text-xs text-gray-500 truncate max-w-xs">
                            {cat.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(cat)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={isDeleting === cat.id}
                      className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 cursor-pointer transition-colors hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </DialogTitle>
          </DialogHeader>
          <CategoryForm
            category={editingCategory}
            parentOptions={parentOptions}
            onSuccess={handleSuccess}
            onCancel={() => setShowDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
