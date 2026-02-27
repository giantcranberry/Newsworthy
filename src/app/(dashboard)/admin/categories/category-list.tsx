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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Plus, Pencil, Trash2, Tag, Search, FolderTree, Settings, Check, X, ChevronRight } from 'lucide-react'
import { CategoryForm } from './category-form'

interface Circuit {
  id: number
  name: string
}

interface CircuitWithCount extends Circuit {
  count: number
}

interface Category {
  id: number
  slug: string
  circuit: string | null
  parentSlug: string | null
  parentCategory: string | null
  name: string
  description: string | null
  circuits: Circuit[]
}

interface CategoryListProps {
  categories: Category[]
  circuits: Circuit[]
  circuitsWithCounts: CircuitWithCount[]
  parentOptions: string[]
  currentSearch: string
}

export function CategoryList({
  categories,
  circuits,
  circuitsWithCounts,
  parentOptions,
  currentSearch,
}: CategoryListProps) {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)
  const [search, setSearch] = useState(currentSearch)
  const [circuitFilter, setCircuitFilter] = useState<number | 'all'>('all')
  const [levelFilter, setLevelFilter] = useState<'top' | 'all'>('top')
  const [circuitsOpen, setCircuitsOpen] = useState(false)
  const [editingCircuit, setEditingCircuit] = useState<number | null>(null)
  const [editingCircuitValue, setEditingCircuitValue] = useState('')
  const [newCircuitName, setNewCircuitName] = useState('')
  const [circuitLoading, setCircuitLoading] = useState(false)
  const [expandedCircuit, setExpandedCircuit] = useState<number | null>(null)

  // Build a map of circuit ID → categories for the expanded view
  const categoriesByCircuit = new Map<number, Category[]>()
  for (const cat of categories) {
    for (const ci of cat.circuits) {
      if (!categoriesByCircuit.has(ci.id)) {
        categoriesByCircuit.set(ci.id, [])
      }
      categoriesByCircuit.get(ci.id)!.push(cat)
    }
  }

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

  const handleAddCircuit = async () => {
    const name = newCircuitName.trim()
    if (!name) return

    if (circuits.some(c => c.name === name)) {
      alert('A circuit with this name already exists')
      return
    }

    setCircuitLoading(true)
    try {
      const response = await fetch('/api/admin/categories/circuits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (response.ok) {
        setNewCircuitName('')
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to add circuit')
      }
    } catch {
      alert('An error occurred')
    } finally {
      setCircuitLoading(false)
    }
  }

  const handleRenameCircuit = async (circuitId: number) => {
    const newName = editingCircuitValue.trim()
    if (!newName) {
      setEditingCircuit(null)
      return
    }

    const current = circuitsWithCounts.find(c => c.id === circuitId)
    if (current && newName === current.name) {
      setEditingCircuit(null)
      return
    }

    setCircuitLoading(true)
    try {
      const response = await fetch('/api/admin/categories/circuits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: circuitId, name: newName }),
      })

      if (response.ok) {
        setEditingCircuit(null)
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to rename circuit')
      }
    } catch {
      alert('An error occurred')
    } finally {
      setCircuitLoading(false)
    }
  }

  const handleUnlinkCategory = async (circuitId: number, categoryId: number) => {
    setCircuitLoading(true)
    try {
      const response = await fetch('/api/admin/categories/circuits', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circuitId, categoryId }),
      })

      if (response.ok) {
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to remove category from circuit')
      }
    } catch {
      alert('An error occurred')
    } finally {
      setCircuitLoading(false)
    }
  }

  const handleDeleteCircuit = async (circuitId: number, name: string) => {
    if (!confirm(`Remove circuit "${name}"? This will unassign it from all categories.`)) return

    setCircuitLoading(true)
    try {
      const response = await fetch('/api/admin/categories/circuits', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: circuitId }),
      })

      if (response.ok) {
        if (circuitFilter === circuitId) setCircuitFilter('all')
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to remove circuit')
      }
    } catch {
      alert('An error occurred')
    } finally {
      setCircuitLoading(false)
    }
  }

  const filtered = categories.filter(c => {
    if (levelFilter === 'top' && c.parentCategory !== 'top') return false
    if (circuitFilter !== 'all' && !c.circuits.some(ci => ci.id === circuitFilter)) return false
    return true
  })

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

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as 'top' | 'all')}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
        >
          <option value="top">Top Level</option>
          <option value="all">All Categories</option>
        </select>

        {circuits.length > 0 && (
          <select
            value={circuitFilter === 'all' ? 'all' : String(circuitFilter)}
            onChange={(e) => setCircuitFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm"
          >
            <option value="all">All Circuits</option>
            {circuits.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        <Button onClick={handleCreate} className="gap-2 bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer">
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Circuits Management Panel */}
      <Collapsible open={circuitsOpen} onOpenChange={setCircuitsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="gap-2 cursor-pointer">
            <Settings className="h-4 w-4" />
            Manage Circuits
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Circuits</h3>
                <span className="text-xs text-gray-500">{circuitsWithCounts.length} circuits</span>
              </div>

              {circuitsWithCounts.length === 0 ? (
                <p className="text-sm text-gray-500">No circuits defined yet. Add a circuit below.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {circuitsWithCounts.map((c) => {
                    const isExpanded = expandedCircuit === c.id
                    const circuitCats = categoriesByCircuit.get(c.id) || []

                    return (
                      <div key={c.id}>
                        <div className="flex items-center gap-3 py-2">
                          {editingCircuit === c.id ? (
                            <>
                              <Input
                                value={editingCircuitValue}
                                onChange={(e) => setEditingCircuitValue(e.target.value)}
                                className="flex-1 h-8 text-sm"
                                autoFocus
                                disabled={circuitLoading}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameCircuit(c.id)
                                  if (e.key === 'Escape') setEditingCircuit(null)
                                }}
                              />
                              <button
                                onClick={() => handleRenameCircuit(c.id)}
                                disabled={circuitLoading}
                                className="p-1 rounded text-green-600 hover:bg-green-50 cursor-pointer"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setEditingCircuit(null)}
                                disabled={circuitLoading}
                                className="p-1 rounded text-gray-400 hover:bg-gray-100 cursor-pointer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setExpandedCircuit(isExpanded ? null : c.id)}
                                className="p-0.5 rounded text-gray-400 hover:text-gray-600 cursor-pointer"
                              >
                                <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              </button>
                              <button
                                onClick={() => setExpandedCircuit(isExpanded ? null : c.id)}
                                className="flex-1 text-left text-sm text-gray-900 hover:text-cyan-800 cursor-pointer"
                              >
                                {c.name}
                              </button>
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                                {c.count} {c.count === 1 ? 'category' : 'categories'}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingCircuit(c.id)
                                  setEditingCircuitValue(c.name)
                                }}
                                disabled={circuitLoading}
                                className="p-1 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteCircuit(c.id, c.name)}
                                disabled={circuitLoading}
                                className="p-1 rounded text-red-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="ml-7 mb-2 pl-3 border-l-2 border-gray-200">
                            {circuitCats.length === 0 ? (
                              <p className="text-xs text-gray-400 py-1">No categories assigned</p>
                            ) : (
                              <div className="space-y-1 py-1">
                                {circuitCats.map(cat => (
                                  <div key={cat.id} className="flex items-center gap-2 text-xs group">
                                    <span className="text-gray-700">{cat.name}</span>
                                    <span className="text-gray-400 font-mono flex-1">/{cat.slug}</span>
                                    <button
                                      onClick={() => handleUnlinkCategory(c.id, cat.id)}
                                      disabled={circuitLoading}
                                      className="p-0.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                      title={`Remove ${cat.name} from ${c.name}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add New Circuit */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <Input
                  value={newCircuitName}
                  onChange={(e) => setNewCircuitName(e.target.value)}
                  placeholder="New circuit name..."
                  className="flex-1 h-8 text-sm"
                  disabled={circuitLoading}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddCircuit()
                    }
                  }}
                />
                <Button
                  onClick={handleAddCircuit}
                  size="sm"
                  variant="outline"
                  disabled={!newCircuitName.trim() || circuitLoading}
                  className="gap-1 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

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
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {cat.circuits.map(ci => (
                          <span key={ci.id} className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {ci.name}
                          </span>
                        ))}
                        {cat.parentCategory && cat.parentCategory !== 'top' && (
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
            circuits={circuits}
            parentOptions={parentOptions}
            onSuccess={handleSuccess}
            onCancel={() => setShowDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
