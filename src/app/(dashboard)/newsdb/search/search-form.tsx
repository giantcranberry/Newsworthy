'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Search, X } from 'lucide-react'

interface NewsDbSearchFormProps {
  initialQuery?: string
  initialIndustry?: string
}

export function NewsDbSearchForm({ initialQuery = '', initialIndustry = '' }: NewsDbSearchFormProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [industry, setIndustry] = useState(initialIndustry)

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (industry) params.set('industry', industry)
    router.push(`/newsdb/search?${params.toString()}`)
  }

  const handleClear = () => {
    setQuery('')
    setIndustry('')
    router.push('/newsdb/search')
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, or publication..."
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Industry/Beat"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSearch}>Search</Button>
            {(query || industry) && (
              <Button variant="outline" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
