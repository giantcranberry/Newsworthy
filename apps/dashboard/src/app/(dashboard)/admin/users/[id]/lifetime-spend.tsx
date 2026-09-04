'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type LifetimeSpendContextValue = {
  cents: number | null
  updatedAt: string | Date | null
  setLifetimeSpend: (cents: number, updatedAt?: string | Date | null) => void
}

const LifetimeSpendContext = createContext<LifetimeSpendContextValue | null>(null)

export function LifetimeSpendProvider({
  initialCents,
  initialUpdatedAt,
  children,
}: {
  initialCents: number | null
  initialUpdatedAt: string | Date | null
  children: React.ReactNode
}) {
  const [cents, setCents] = useState<number | null>(initialCents)
  const [updatedAt, setUpdatedAt] = useState<string | Date | null>(initialUpdatedAt)

  const setLifetimeSpend = useCallback((nextCents: number, nextUpdatedAt?: string | Date | null) => {
    setCents(nextCents)
    setUpdatedAt(nextUpdatedAt ?? new Date())
  }, [])

  const value = useMemo(
    () => ({ cents, updatedAt, setLifetimeSpend }),
    [cents, updatedAt, setLifetimeSpend],
  )

  return (
    <LifetimeSpendContext.Provider value={value}>
      {children}
    </LifetimeSpendContext.Provider>
  )
}

export function useLifetimeSpend() {
  const ctx = useContext(LifetimeSpendContext)
  if (!ctx) {
    throw new Error('useLifetimeSpend must be used within LifetimeSpendProvider')
  }
  return ctx
}

export function LifetimeSpendDetailsRow() {
  const { cents, updatedAt } = useLifetimeSpend()
  const formatted =
    typeof cents === 'number'
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
      : '—'

  return (
    <p>
      <span className="text-gray-500 dark:text-gray-400">Lifetime spend:</span>{' '}
      <strong>{formatted}</strong>
      {updatedAt && (
        <span className="text-xs text-gray-400 ml-1">
          (updated {new Date(updatedAt).toLocaleDateString()})
        </span>
      )}
    </p>
  )
}
