'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X, Building2 } from 'lucide-react'

export function UserSearchForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [brand, setBrand] = useState(searchParams.get('brand') || '')

  const buildUrl = (q: string, b: string) => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (b.trim()) params.set('brand', b.trim())
    const qs = params.toString()
    return `/admin/users${qs ? `?${qs}` : ''}`
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(buildUrl(query, brand))
  }

  const handleClear = () => {
    setQuery('')
    setBrand('')
    router.push('/admin/users')
  }

  const hasSearch = searchParams.get('q') || searchParams.get('brand')

  return (
    <form data-tour="users-search" onSubmit={handleSubmit} className="inline-flex gap-2 flex-wrap">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="relative max-w-sm">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by brand..."
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="pl-9"
        />
      </div>
      <Button type="submit" className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer">Search</Button>
      {hasSearch && (
        <Button type="button" variant="outline" onClick={handleClear} className="cursor-pointer">
          <X className="h-4 w-4" />
        </Button>
      )}
    </form>
  )
}
