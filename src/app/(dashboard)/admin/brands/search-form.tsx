'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

export function BrandSearchForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/admin/brands?q=${encodeURIComponent(query.trim())}`)
    } else {
      router.push('/admin/brands')
    }
  }

  const handleClear = () => {
    setQuery('')
    router.push('/admin/brands')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by brand name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <Button type="submit" className="bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer">Search</Button>
      {searchParams.get('q') && (
        <Button type="button" variant="outline" onClick={handleClear} className="cursor-pointer">
          <X className="h-4 w-4" />
        </Button>
      )}
    </form>
  )
}
