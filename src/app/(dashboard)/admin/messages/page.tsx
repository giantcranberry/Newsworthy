import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { MessagesAdmin } from './messages-admin'

export default async function AdminMessagesPage() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="text-gray-500">Manage global announcements and send messages to users</p>
      </div>
      <MessagesAdmin />
    </div>
  )
}
