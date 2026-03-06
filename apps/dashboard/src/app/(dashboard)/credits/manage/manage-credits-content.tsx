'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { FaIcon } from '@/components/ui/fa-icon'
import { faCoins } from '@awesome.me/kit-adf47b9acf/icons/duotone/light'
import { Building2, User, ArrowRight } from 'lucide-react'

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

interface Company {
  id: number
  companyName: string
}

const CREDIT_LABELS: { key: keyof CreditsByType; label: string }[] = [
  { key: 'pr', label: 'Press Release' },
  { key: 'yahoo', label: 'Yahoo News' },
  { key: 'enhanced', label: 'Enhanced Distribution' },
  { key: 'concierge', label: 'Concierge DFY' },
]

function CreditRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <Badge variant={count > 0 ? 'default' : 'secondary'} className={count > 0 ? 'bg-cyan-800 dark:bg-cyan-600' : ''}>
        {count}
      </Badge>
    </div>
  )
}

export function ManageCreditsContent({
  allCredits,
  companies,
}: {
  allCredits: AllCredits
  companies: Company[]
}) {
  const router = useRouter()
  const [allocateOpen, setAllocateOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<keyof CreditsByType | ''>('')
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [amount, setAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const hasPersonalCredits =
    allCredits.personal.pr > 0 ||
    allCredits.personal.yahoo > 0 ||
    allCredits.personal.enhanced > 0 ||
    allCredits.personal.concierge > 0

  const allocatableTypes = CREDIT_LABELS.filter(({ key }) => allCredits.personal[key] > 0)

  const maxAmount = selectedType ? allCredits.personal[selectedType] : 0

  async function handleAllocate() {
    if (!selectedType || !selectedCompany || !amount) return

    const numAmount = parseInt(amount)
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > maxAmount) {
      setError(`Amount must be between 1 and ${maxAmount}`)
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/credits/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditType: selectedType,
          amount: numAmount,
          companyId: parseInt(selectedCompany),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to allocate credits')
        return
      }

      setAllocateOpen(false)
      setSelectedType('')
      setSelectedCompany('')
      setAmount('')
      router.refresh()
    } catch {
      setError('Failed to allocate credits')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Manage Credits</h1>
          <p className="text-gray-600 dark:text-gray-400">View your credit balances and allocate credits to brands.</p>
        </div>
        <div className="flex items-center gap-3">
          {hasPersonalCredits && companies.length > 0 && (
            <Button
              variant="outline"
              className="gap-2 cursor-pointer"
              onClick={() => setAllocateOpen(true)}
            >
              <ArrowRight className="h-4 w-4" />
              Allocate to Brand
            </Button>
          )}
          <Link href="/payment/paygo">
            <Button className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer">
              <FaIcon icon={faCoins} className="h-4 w-4" />
              Purchase Credits
            </Button>
          </Link>
        </div>
      </div>

      {/* Unallocated / Personal Credits */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-gray-400" />
            <CardTitle>Unallocated Credits</CardTitle>
          </div>
          <CardDescription>
            Credits in your account that are not assigned to any brand. These can be used when creating a release or allocated to a specific brand.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPersonalCredits ? (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {CREDIT_LABELS.map(({ key, label }) => (
                <CreditRow key={key} label={label} count={allCredits.personal[key]} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">No unallocated credits</p>
          )}
        </CardContent>
      </Card>

      {/* Per-brand Credits */}
      {allCredits.brands.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Brand Credits</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {allCredits.brands.map((brand) => (
              <Card key={brand.companyId}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-gray-400" />
                    <CardTitle className="text-base">{brand.companyName}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {CREDIT_LABELS.map(({ key, label }) => (
                      <CreditRow key={key} label={label} count={brand.credits[key]} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state if no brands have credits */}
      {allCredits.brands.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No credits allocated to brands yet.
              {hasPersonalCredits && companies.length > 0 && ' Use the "Allocate to Brand" button to assign credits.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Allocate Dialog */}
      <Dialog open={allocateOpen} onOpenChange={setAllocateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate Credits to Brand</DialogTitle>
            <DialogDescription>
              Move credits from your unallocated balance to a specific brand.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Credit Type</label>
              <SelectRoot
                value={selectedType}
                onValueChange={(v) => {
                  setSelectedType(v as keyof CreditsByType)
                  setAmount('')
                  setError('')
                }}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Select credit type" />
                </SelectTrigger>
                <SelectContent>
                  {allocatableTypes.map(({ key, label }) => (
                    <SelectItem key={key} value={key} className="cursor-pointer">
                      {label} ({allCredits.personal[key]} available)
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Brand</label>
              <SelectRoot
                value={selectedCompany}
                onValueChange={(v) => {
                  setSelectedCompany(v)
                  setError('')
                }}
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((co) => (
                    <SelectItem key={co.id} value={co.id.toString()} className="cursor-pointer">
                      {co.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Amount {selectedType && `(max ${maxAmount})`}
              </label>
              <Input
                type="number"
                min={1}
                max={maxAmount}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setError('')
                }}
                placeholder="Enter amount"
              />
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAllocateOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAllocate}
              disabled={!selectedType || !selectedCompany || !amount || isSubmitting}
              className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
            >
              {isSubmitting ? 'Allocating...' : 'Allocate Credits'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
