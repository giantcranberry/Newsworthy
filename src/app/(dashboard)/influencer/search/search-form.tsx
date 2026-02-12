'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Search, X } from 'lucide-react'

interface Activity {
  id: number
  name: string
  icon: string | null
}

interface InfluencerSearchFormProps {
  initialQuery?: string
  initialActivity?: string
  activities: Activity[]
}

export function InfluencerSearchForm({
  initialQuery = '',
  initialActivity,
  activities,
}: InfluencerSearchFormProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [selectedActivity, setSelectedActivity] = useState(initialActivity)

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (selectedActivity) params.set('activity', selectedActivity)
    router.push(`/influencer/search?${params.toString()}`)
  }

  const handleClear = () => {
    setQuery('')
    setSelectedActivity(undefined)
    router.push('/influencer/search')
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
                placeholder="Search by name, tagline, or keyword..."
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedActivity || ''}
              onChange={(e) => setSelectedActivity(e.target.value || undefined)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Categories</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id.toString()}>
                  {activity.name}
                </option>
              ))}
            </select>
            <Button onClick={handleSearch}>Search</Button>
            {(query || selectedActivity) && (
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
