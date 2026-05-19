'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FaIcon } from '@/components/ui/fa-icon'
import { faCoins } from '@awesome.me/kit-adf47b9acf/icons/duotone/light'
import { Building2, User } from 'lucide-react'
import { RedeemCourtesyCode } from './redeem-courtesy-code'

interface CreditsByType {
  pr: number
  yahoo: number
  enhanced: number
  concierge: number
}

interface BrandCreditsBreakdown {
  companyId: number
  companyName: string
  credits: CreditsByType
}

interface AllCredits {
  personal: CreditsByType
  brands: BrandCreditsBreakdown[]
  totalPr: number
}

const CREDIT_LABELS: { key: keyof CreditsByType; label: string }[] = [
  { key: 'pr', label: 'Press Release Credits' },
  { key: 'yahoo', label: 'Yahoo News Credits' },
  { key: 'enhanced', label: 'Enhanced Distribution Credits' },
  { key: 'concierge', label: 'Concierge DFY Credits' },
]

function hasAnyCredits(credits: CreditsByType) {
  return credits.pr > 0 || credits.yahoo > 0 || credits.enhanced > 0 || credits.concierge > 0
}

function CreditRows({ credits }: { credits: CreditsByType }) {
  return (
    <>
      {CREDIT_LABELS.map(({ key, label }) => (
        credits[key] > 0 && (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{credits[key]}</span>
          </div>
        )
      ))}
    </>
  )
}

export function CreditsCard({ allCredits, canPurchase = true, hasRedeemedCoupon = true }: { allCredits: AllCredits; canPurchase?: boolean; hasRedeemedCoupon?: boolean }) {
  const [open, setOpen] = useState(false)
  const hasPersonal = hasAnyCredits(allCredits.personal)
  const hasBrands = allCredits.brands.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Card
          className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 cursor-pointer h-full"
          onClick={(e) => {
            e.preventDefault()
            setOpen(!open)
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              PR Credits
            </CardTitle>
            <FaIcon icon={faCoins} className="h-6 w-6 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{allCredits.totalPr}</div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Click to see all credits</p>
          </CardContent>
        </Card>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 border-b">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Credit Breakdown</p>
        </div>

        <div className="divide-y">
          {/* Personal credits */}
          {hasPersonal && (
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{allCredits.brands.length > 1 ? 'My Account / Unallocated' : 'My Account'}</p>
              </div>
              <div className="space-y-1.5">
                <CreditRows credits={allCredits.personal} />
              </div>
            </div>
          )}

          {/* Per-brand credits */}
          {allCredits.brands.map((brand) => (
            <div key={brand.companyId} className="p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">{brand.companyName}</p>
              </div>
              <div className="space-y-1.5">
                <CreditRows credits={brand.credits} />
              </div>
            </div>
          ))}

          {/* No credits at all */}
          {!hasPersonal && !hasBrands && (
            <div className="p-3">
              <p className="text-sm text-gray-400 text-center">No credits available</p>
            </div>
          )}
        </div>

        {canPurchase && (
          <div className="p-3 border-t flex items-center justify-between">
            <Link
              href="/credits/manage"
              className="text-xs text-cyan-700 hover:text-cyan-900 dark:hover:text-cyan-300 font-medium"
              onClick={() => setOpen(false)}
            >
              Manage/Purchase Credits
            </Link>
            {!hasRedeemedCoupon && <RedeemCourtesyCode variant="link" />}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
