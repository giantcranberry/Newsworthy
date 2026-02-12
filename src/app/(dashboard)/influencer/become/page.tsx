import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { influencer } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { BecomeInfluencerForm } from './become-form'

async function checkExistingInfluencer(userId: number) {
  const existing = await db.query.influencer.findFirst({
    where: eq(influencer.userId, userId),
  })
  return existing
}

export default async function BecomeInfluencerPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  // Check if already an influencer
  const existing = await checkExistingInfluencer(userId)
  if (existing) {
    redirect('/influencer/profile')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Become an Influencer</h1>
        <p className="text-gray-500">Join our marketplace and monetize your social reach</p>
      </div>

      <BecomeInfluencerForm userEmail={session?.user?.email || ''} />
    </div>
  )
}
