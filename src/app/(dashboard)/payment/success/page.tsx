import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

export default function PaymentSuccessPage() {
  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Payment Successful!</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Thank you for your purchase. Your credits have been added to your account.
          </p>
          <div className="flex flex-col gap-3">
            <Link href="/dashboard">
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
            <Link href="/payment/paygo">
              <Button variant="outline" className="w-full">Buy More Credits</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
