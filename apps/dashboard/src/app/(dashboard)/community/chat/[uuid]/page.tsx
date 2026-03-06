import { getEffectiveSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ChatLayout } from '@/components/community/chat-layout'

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const session = await getEffectiveSession()
  const userId = (session?.user as any)?.id
  if (!userId) redirect('/login')

  const { uuid } = await params

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Chat</h1>
        <p className="text-gray-600 dark:text-gray-400">Direct messages with other community members</p>
      </div>

      <ChatLayout currentUserId={userId} initialConversationUuid={uuid} />
    </div>
  )
}
