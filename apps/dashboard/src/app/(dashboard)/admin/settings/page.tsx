import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getBoolSetting, FREE_FIRST_PR_KEY } from '@/lib/app-settings'
import { SettingsForm } from '@/components/admin/settings/settings-form'

export default async function AdminSettingsPage() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) {
    redirect('/dashboard')
  }

  const freeFirstPr = await getBoolSetting(FREE_FIRST_PR_KEY, true)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Application-wide feature toggles and offers
        </p>
      </div>

      <SettingsForm initialFreeFirstPr={freeFirstPr} />
    </div>
  )
}
