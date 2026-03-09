'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Brand {
  id: number
  name: string
}

export function BrandFilter({ brands }: { brands: Brand[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentBrand = searchParams.get('brand') || ''
  const currentFilter = searchParams.get('filter') || ''

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams()
    if (currentFilter) params.set('filter', currentFilter)
    if (e.target.value) params.set('brand', e.target.value)
    const qs = params.toString()
    router.push(`/pr${qs ? `?${qs}` : ''}`)
  }

  if (brands.length <= 1) return null

  return (
    <select
      value={currentBrand}
      onChange={handleChange}
      className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300"
    >
      <option value="">All Brands</option>
      {brands.map((b) => (
        <option key={b.id} value={String(b.id)}>
          {b.name}
        </option>
      ))}
    </select>
  )
}
