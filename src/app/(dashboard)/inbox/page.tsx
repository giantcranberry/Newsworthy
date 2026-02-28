import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InboxList } from './inbox-list'

export default async function InboxPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
        <p className="text-gray-500">Your messages and notifications</p>
      </div>
      <InboxList />
    </div>
  )
}
