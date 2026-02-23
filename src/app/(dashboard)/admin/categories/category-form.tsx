'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface Category {
  id: number
  slug: string
  circuit: string | null
  parentSlug: string | null
  parentCategory: string | null
  name: string
  description: string | null
}

interface CategoryFormProps {
  category: Category | null
  parentOptions: string[]
  onSuccess: () => void
  onCancel: () => void
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export function CategoryForm({ category, parentOptions, onSuccess, onCancel }: CategoryFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: category?.name || '',
    slug: category?.slug || '',
    description: category?.description || '',
    circuit: category?.circuit || '',
    parentSlug: category?.parentSlug || '',
    parentCategory: category?.parentCategory || '',
  })
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!category)

  const handleChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      // Auto-generate slug from name unless manually edited
      if (field === 'name' && !slugManuallyEdited) {
        updated.slug = slugify(value)
      }
      return updated
    })
  }

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true)
    setFormData(prev => ({ ...prev, slug: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        circuit: formData.circuit || null,
        parentSlug: formData.parentSlug || null,
        parentCategory: formData.parentCategory || null,
      }

      const url = category
        ? `/api/admin/categories/${category.id}`
        : '/api/admin/categories'

      const response = await fetch(url, {
        method: category ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save category')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., Technology"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug *</Label>
        <Input
          id="slug"
          value={formData.slug}
          onChange={(e) => handleSlugChange(e.target.value)}
          placeholder="e.g., technology"
          required
          maxLength={64}
        />
        <p className="text-xs text-gray-500">
          URL-friendly identifier. Auto-generated from name.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Brief description of this category"
          maxLength={256}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="circuit">Circuit</Label>
        <Input
          id="circuit"
          value={formData.circuit}
          onChange={(e) => handleChange('circuit', e.target.value)}
          placeholder="e.g., Industry, Topic"
          maxLength={128}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="parentCategory">Parent Category</Label>
          <select
            id="parentCategory"
            value={formData.parentCategory}
            onChange={(e) => handleChange('parentCategory', e.target.value)}
            className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
          >
            <option value="">None</option>
            {parentOptions
              .filter(name => name !== category?.name)
              .map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="parentSlug">Parent Slug</Label>
          <Input
            id="parentSlug"
            value={formData.parentSlug}
            onChange={(e) => handleChange('parentSlug', e.target.value)}
            placeholder="e.g., technology"
            maxLength={128}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-cyan-800 text-white hover:bg-cyan-900">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            category ? 'Update Category' : 'Create Category'
          )}
        </Button>
      </div>
    </form>
  )
}
