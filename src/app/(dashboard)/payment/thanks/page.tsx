import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { brandCredits } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

async function getCreditBalance(userId: number) {
  const result = await db
    .select({
      prCredits: sql<number>`COALESCE(SUM(CASE WHEN ${brandCredits.productType} IN ('pr', 'credits') THEN ${brandCredits.credits} ELSE 0 END), 0)`,
      yahooCredits: sql<number>`COALESCE(SUM(CASE WHEN ${brandCredits.productType} = 'yahoo' THEN ${brandCredits.credits} ELSE 0 END), 0)`,
      enhancedCredits: sql<number>`COALESCE(SUM(CASE WHEN ${brandCredits.productType} = 'enhanced' THEN ${brandCredits.credits} ELSE 0 END), 0)`,
    })
    .from(brandCredits)
    .where(eq(brandCredits.userId, userId))

  return {
    prCredits: Number(result[0]?.prCredits || 0),
    yahooCredits: Number(result[0]?.yahooCredits || 0),
    enhancedCredits: Number(result[0]?.enhancedCredits || 0),
  }
}

export default async function ThanksPage() {
  const session = await getEffectiveSession()
  if (!session?.user?.id) redirect('/login')

  const userId = parseInt(session.user.id)
  const userEmail = session.user.email || ''

  const balance = await getCreditBalance(userId)

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-500 mb-6">
            An email receipt has been sent to {userEmail}.
          </p>

          {/* Credit Balances */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{balance.prCredits}</p>
              <p className="text-sm text-gray-500">PR Credits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{balance.yahooCredits}</p>
              <p className="text-sm text-gray-500">Yahoo Credits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{balance.enhancedCredits}</p>
              <p className="text-sm text-gray-500">Enhanced Credits</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {balance.prCredits > 0 && (
              <Link href="/pr/create">
                <Button className="w-full bg-cyan-800 text-white hover:bg-cyan-900">
                  Distribute a Press Release
                </Button>
              </Link>
            )}
            <Link href="/dashboard">
              <Button variant="outline" className="w-full">
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/payment/paygo">
              <Button variant="outline" className="w-full">
                Buy More Credits
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
