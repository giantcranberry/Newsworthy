'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

export function UserSearchForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/admin/users?q=${encodeURIComponent(query.trim())}`)
    } else {
      router.push('/admin/users')
    }
  }

  const handleClear = () => {
    setQuery('')
    router.push('/admin/users')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>
      <Button type="submit">Search</Button>
      {searchParams.get('q') && (
        <Button type="button" variant="outline" onClick={handleClear}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </form>
  )
}
