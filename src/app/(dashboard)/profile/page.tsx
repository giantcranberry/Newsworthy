import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { userProfiles, userSubscription } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-500">Manage your profile and preferences</p>
      </div>

      {/* Subscription Info */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
          <CardDescription>Your current plan and credits</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {subscription?.remainingPr || 0}
              </p>
              <p className="text-sm text-gray-500">PR Credits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {subscription?.remainingPluspr || 0}
              </p>
              <p className="text-sm text-gray-500">Enhanced Credits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {subscription?.newsdbCredits || 0}
              </p>
              <p className="text-sm text-gray-500">NewsDB Credits</p>
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" asChild>
              <a href="/payment/paygo">Buy More Credits</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
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
      />
    </div>
  )
}
