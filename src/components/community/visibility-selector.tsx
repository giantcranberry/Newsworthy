'use client'

import { Select } from '@/components/ui/select'

interface VisibilitySelectorProps {
  value: string
  onChange: (value: string) => void
  companies?: { id: number; companyName: string }[]
  selectedCompanyId?: number | null
  onCompanyChange?: (id: number | null) => void
}

export function VisibilitySelector({
  value,
  onChange,
  companies = [],
  selectedCompanyId,
  onCompanyChange,
}: VisibilitySelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-auto text-xs h-8"
      >
        <option value="public">Public</option>
        <option value="team">Team Only</option>
        <option value="followers">Followers Only</option>
      </Select>

      {value === 'team' && companies.length > 0 && (
        <Select
          value={selectedCompanyId?.toString() || ''}
          onChange={(e) => onCompanyChange?.(e.target.value ? parseInt(e.target.value) : null)}
          className="w-auto text-xs h-8"
        >
          <option value="">Select team...</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
      )}
    </div>
  )
}
