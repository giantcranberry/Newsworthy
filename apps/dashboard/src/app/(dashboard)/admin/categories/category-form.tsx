'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface Circuit {
  id: number
  name: string
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

interface CategoryFormProps {
  category: Category | null
  circuits: Circuit[]
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

export function CategoryForm({ category, circuits, parentOptions, onSuccess, onCancel }: CategoryFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: category?.name || '',
    slug: category?.slug || '',
    description: category?.description || '',
    circuitIds: category?.circuits.map(c => c.id) || [] as number[],
    parentSlug: category?.parentSlug || '',
    parentCategory: category?.parentCategory || 'top',
  })
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!category)

  const handleChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
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

  const toggleCircuit = (circuitId: number) => {
    setFormData(prev => ({
      ...prev,
      circuitIds: prev.circuitIds.includes(circuitId)
        ? prev.circuitIds.filter(id => id !== circuitId)
        : [...prev.circuitIds, circuitId],
    }))
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
        circuitIds: formData.circuitIds,
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
        <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 rounded-lg">
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
        <p className="text-xs text-gray-500 dark:text-gray-400">
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

      {circuits.length > 0 && (
        <div className="space-y-2">
          <Label>Circuits</Label>
          <div className="rounded-md border border-gray-200 dark:border-gray-800 p-3 space-y-2 max-h-48 overflow-y-auto">
            {circuits.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 cursor-pointer text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 rounded px-1 py-0.5"
              >
                <Checkbox
                  checked={formData.circuitIds.includes(c.id)}
                  onCheckedChange={() => toggleCircuit(c.id)}
                  className="border-gray-300 dark:border-gray-700 data-[state=checked]:bg-cyan-700 data-[state=checked]:border-cyan-700"
                />
                {c.name}
              </label>
            ))}
          </div>
          {formData.circuitIds.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formData.circuitIds.length} circuit{formData.circuitIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="parentCategory">Parent Category</Label>
          <SelectRoot
            value={formData.parentCategory || '_none'}
            onValueChange={(value) => handleChange('parentCategory', value === '_none' ? '' : value)}
          >
            <SelectTrigger id="parentCategory">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">None</SelectItem>
              {parentOptions
                .filter(name => name !== category?.name)
                .map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
            </SelectContent>
          </SelectRoot>
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
        <Button type="submit" disabled={isLoading} className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700">
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
