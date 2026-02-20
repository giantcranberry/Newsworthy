import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { userProfiles, userSubscription } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ProfileForm } from './profile-form'

async function getUserProfile(userId: number) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  })

  const subscription = await db.query.userSubscription.findFirst({
    where: eq(userSubscription.userId, userId),
  })

  return { profile, subscription }
}

export default async function ProfilePage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const { profile, subscription } = await getUserProfile(userId)

  return (
    <ProfileForm
      email={session?.user?.email || ''}
      initialData={{
        firstName: profile?.firstName || '',
        lastName: profile?.lastName || '',
        company: profile?.company || '',
        phone: profile?.phone || '',
        mobile: profile?.mobile || '',
        addr1: profile?.addr1 || '',
        addr2: profile?.addr2 || '',
        city: profile?.city || '',
        state: profile?.state || '',
        postalCode: profile?.postalCode || '',
        countryCode: profile?.countryCode || 'US',
      }}
      subscription={{
        remainingPr: subscription?.remainingPr || 0,
        remainingPluspr: subscription?.remainingPluspr || 0,
        newsdbCredits: subscription?.newsdbCredits || 0,
      }}
    />
  )
}
