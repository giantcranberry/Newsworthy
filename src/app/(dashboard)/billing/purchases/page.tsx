import { getEffectiveSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PurchasesList } from './purchases-list'

export default async function PurchasesPage() {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Purchases</h1>
        <p className="text-gray-500">Your payment history and receipts</p>
      </div>

      <PurchasesList />
    </div>
  )
}
