import { createHash } from 'crypto'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { ProfileForm } from './profile-form'

async function getUserProfile(userId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  })

  return { user, profile }
}

export default async function ProfilePage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const { user, profile } = await getUserProfile(userId)

  const email = session?.user?.email || ''
  const emailHash = createHash('md5').update(email.trim().toLowerCase()).digest('hex')
  const gravatarUrl = `https://www.gravatar.com/avatar/${emailHash}?s=160&d=404`

  return (
    <ProfileForm
      email={email}
      hasPassword={!!user?.passwordHash}
      avatar={profile?.avatar || null}
      gravatarUrl={gravatarUrl}
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
    />
  )
}
