import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TaskBoard } from './task-board'

export default async function TasksPage() {
  const session = await auth()

  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor

  if (!isAdmin && !isEditor) {
    redirect('/dashboard')
  }

  return <TaskBoard isAdmin={!!isAdmin} />
}
