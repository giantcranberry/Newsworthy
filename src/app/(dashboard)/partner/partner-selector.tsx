'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface PartnerOption {
  id: number
  company: string | null
  brandName: string | null
  handle: string | null
}

export function PartnerSelector({
  partners,
  currentPartnerId,
}: {
  partners: PartnerOption[]
  currentPartnerId: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (partners.length <= 1) return null

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('partner', e.target.value)
    // Reset page when switching partners
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <select
      value={currentPartnerId}
      onChange={handleChange}
      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
    >
      {partners.map((p) => (
        <option key={p.id} value={p.id}>
          {p.company || p.brandName || p.handle || `Partner ${p.id}`}
        </option>
      ))}
    </select>
  )
}
