import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TaskBoard, type TaskBoardConfig } from '@/components/kanban/task-board'

export default async function TasksPage() {
  const session = await auth()

  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor

  if (!isAdmin && !isEditor) {
    redirect('/dashboard')
  }

  const config: TaskBoardConfig = {
    apiBase: '/api/admin/tasks',
    title: 'Task Board',
    showUserFilter: true,
    showAssignee: true,
    canManageStages: !!isAdmin,
    showBrandFilter: false,
  }

  return <TaskBoard config={config} />
}
