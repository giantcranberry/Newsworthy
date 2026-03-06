import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TaskBoard, type TaskBoardConfig } from '@/components/kanban/task-board'

export default async function UserTasksPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const config: TaskBoardConfig = {
    apiBase: '/api/tasks',
    title: 'My Tasks',
    showUserFilter: false,
    showAssignee: true,
    canManageStages: true,
    showBrandFilter: true,
  }

  return <TaskBoard config={config} />
}
