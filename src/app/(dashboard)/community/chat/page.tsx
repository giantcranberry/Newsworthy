import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ChatLayout } from '@/components/community/chat-layout'

export default async function ChatPage() {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) redirect('/login')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
        <p className="text-gray-600">Direct messages with other community members</p>
      </div>

      <ChatLayout currentUserId={userId} />
    </div>
  )
}
