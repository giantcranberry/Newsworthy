import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles, userSubscription } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ProfileForm } from './profile-form'
import { getUserCompanyIds } from '@/lib/team-auth'

async function getUserProfile(userId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  })

  const subscription = await db.query.userSubscription.findFirst({
    where: eq(userSubscription.userId, userId),
  })

  return { user, profile, subscription }
}

export default async function ProfilePage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const { user, profile, subscription } = await getUserProfile(userId)
  const editableIds = await getUserCompanyIds(userId, 'collaborator')
  const canPurchase = editableIds.length > 0

  return (
    <ProfileForm
      email={session?.user?.email || ''}
      hasPassword={!!user?.passwordHash}
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
      isAgency={user?.isAgency || false}
      subscription={{
        remainingPr: subscription?.remainingPr || 0,
        remainingPluspr: subscription?.remainingPluspr || 0,
        newsdbCredits: subscription?.newsdbCredits || 0,
      }}
      canPurchase={canPurchase}
    />
  )
}
