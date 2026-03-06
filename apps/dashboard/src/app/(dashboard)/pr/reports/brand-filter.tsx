'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/select'

interface Brand {
  id: number
  name: string
}

export function BrandFilter({ brands, currentBrand }: { brands: Brand[]; currentBrand: number | null }) {
  const router = useRouter()

  return (
    <Select
      value={currentBrand?.toString() || ''}
      onChange={(e) => {
        const val = e.target.value
        if (val) {
          router.push(`/pr/reports?brand=${val}`)
        } else {
          router.push('/pr/reports')
        }
      }}
      className="w-48 cursor-pointer"
    >
      <option value="">All Brands</option>
      {brands.map((b) => (
        <option key={b.id} value={b.id.toString()}>
          {b.name}
        </option>
      ))}
    </Select>
  )
}
