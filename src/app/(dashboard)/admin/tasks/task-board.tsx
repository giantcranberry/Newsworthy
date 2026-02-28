'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Plus, Settings, GripVertical, FileText, Calendar, MessageSquare } from 'lucide-react'
import { StageManager, type Stage } from './stage-manager'
import { TaskFormDialog, type KanbanTask, getPriorityConfig } from './task-form'

interface EditorialUser {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
}

function TaskCard({
  task,
  onClick,
  isDragging,
}: {
  task: KanbanTask
  onClick: () => void
  isDragging?: boolean
}) {
  const assigneeName = task.assigneeFirstName || task.assigneeLastName
    ? `${task.assigneeFirstName || ''} ${task.assigneeLastName || ''}`.trim()
    : task.assigneeEmail

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <h4 className="text-sm font-medium text-gray-900 line-clamp-2 flex-1">{task.title}</h4>
        {task.priority && task.priority !== 'medium' && (() => {
          const p = getPriorityConfig(task.priority)
          return (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${p.bg} ${p.color} flex-shrink-0`}>
              {p.label}
            </span>
          )
        })()}
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        {assigneeName && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
            <i className="fa-light fa-circle-user text-xs" aria-hidden="true" />
            {assigneeName}
          </span>
        )}

        {task.files && task.files.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <FileText className="h-3 w-3" />
            {task.files.length}
          </span>
        )}

        {task.noteCount && task.noteCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <MessageSquare className="h-3 w-3" />
            {task.noteCount}
          </span>
        ) : null}

        <span className="inline-flex items-center gap-1 text-xs text-gray-400 ml-auto">
          <Calendar className="h-3 w-3" />
          {new Date(task.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}

function SortableTaskCard({
  task,
  onClick,
}: {
  task: KanbanTask
  onClick: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `task-${task.id}`, data: { type: 'task', task } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        className="absolute top-3 right-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
      <TaskCard task={task} onClick={onClick} />
    </div>
  )
}

function DroppableStageColumn({
  stage,
  tasks,
  onTaskClick,
  isOver,
}: {
  stage: Stage
  tasks: KanbanTask[]
  onTaskClick: (task: KanbanTask) => void
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({
    id: `stage-${stage.id}`,
    data: { type: 'stage', stageId: stage.id },
  })

  return (
    <div className={`flex flex-col w-72 min-w-72 rounded-lg border transition-colors ${isOver ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'}`}>
      {/* Column header */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="text-sm font-semibold text-gray-700 flex-1">{stage.name}</h3>
          <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Task list — droppable area */}
      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px]">
        <SortableContext
          items={tasks.map((t) => `task-${t.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}

// Given a dnd-kit id, find which stage it belongs to
function findStageForId(id: string | number, tasks: KanbanTask[], stages: Stage[]): number | null {
  const idStr = String(id)
  if (idStr.startsWith('stage-')) {
    return parseInt(idStr.replace('stage-', ''))
  }
  if (idStr.startsWith('task-')) {
    const taskId = parseInt(idStr.replace('task-', ''))
    const task = tasks.find((t) => t.id === taskId)
    return task ? task.stageId : null
  }
  return null
}

export function TaskBoard({ isAdmin }: { isAdmin: boolean }) {
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id

  const [stages, setStages] = useState<Stage[]>([])
  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [users, setUsers] = useState<EditorialUser[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  // Dialogs
  const [showStageManager, setShowStageManager] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null)

  // DnD
  const [activeId, setActiveId] = useState<number | null>(null)
  const [overStageId, setOverStageId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const fetchStages = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tasks/stages')
      if (res.ok) setStages(await res.json())
    } catch (err) {
      console.error('Error fetching stages:', err)
    }
  }, [])

  const fetchTasks = useCallback(async () => {
    try {
      const params = filter && filter !== 'all' ? `?assignedTo=${filter}` : ''
      const res = await fetch(`/api/admin/tasks${params}`)
      if (res.ok) setTasks(await res.json())
    } catch (err) {
      console.error('Error fetching tasks:', err)
    }
  }, [filter])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users/search?role=editorial')
      if (res.ok) setUsers(await res.json())
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }, [])

  useEffect(() => {
    Promise.all([fetchStages(), fetchTasks(), fetchUsers()]).then(() =>
      setLoading(false)
    )
  }, [fetchStages, fetchTasks, fetchUsers])

  useEffect(() => {
    fetchTasks()
  }, [filter, fetchTasks])

  const getTasksForStage = (stageId: number) =>
    tasks
      .filter((t) => t.stageId === stageId)
      .sort((a, b) => a.sortOrder - b.sortOrder)

  const handleDragStart = (event: DragStartEvent) => {
    const idStr = String(event.active.id)
    if (idStr.startsWith('task-')) {
      setActiveId(parseInt(idStr.replace('task-', '')))
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) {
      setOverStageId(null)
      return
    }

    const activeStageId = findStageForId(active.id, tasks, stages)
    const overStageId = findStageForId(over.id, tasks, stages)

    setOverStageId(overStageId)

    if (!activeStageId || !overStageId || activeStageId === overStageId) return

    const activeIdStr = String(active.id)
    if (!activeIdStr.startsWith('task-')) return
    const taskId = parseInt(activeIdStr.replace('task-', ''))

    // Move task to the new stage optimistically for visual feedback
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, stageId: overStageId } : t
      )
    )
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverStageId(null)

    if (!over) return

    const activeIdStr = String(active.id)
    if (!activeIdStr.startsWith('task-')) return
    const taskId = parseInt(activeIdStr.replace('task-', ''))

    const draggedTask = tasks.find((t) => t.id === taskId)
    if (!draggedTask) return

    const targetStageId = findStageForId(over.id, tasks, stages)
    if (!targetStageId) return

    const stageTasks = getTasksForStage(targetStageId)

    // Determine sort order
    let targetSortOrder: number
    const overIdStr = String(over.id)

    if (overIdStr.startsWith('task-')) {
      const overTaskId = parseInt(overIdStr.replace('task-', ''))
      const overIndex = stageTasks.findIndex((t) => t.id === overTaskId)
      const activeIndex = stageTasks.findIndex((t) => t.id === taskId)

      if (activeIndex !== -1 && activeIndex !== overIndex) {
        // Same-stage reorder
        const reordered = arrayMove(stageTasks, activeIndex, overIndex)
        targetSortOrder = overIndex
        setTasks((prev) => {
          const others = prev.filter((t) => t.stageId !== targetStageId)
          const updated = reordered.map((t, i) => ({ ...t, sortOrder: i }))
          return [...others, ...updated]
        })
      } else if (activeIndex === -1) {
        // Cross-stage drop on a task
        targetSortOrder = overIndex >= 0 ? overIndex : stageTasks.length
      } else {
        // Dropped on self, no-op
        return
      }
    } else {
      // Dropped on the stage droppable (empty area)
      targetSortOrder = stageTasks.filter((t) => t.id !== taskId).length
    }

    // Persist
    try {
      await fetch('/api/admin/tasks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, stageId: targetStageId, sortOrder: targetSortOrder }),
      })
    } catch {
      fetchTasks()
    }
  }

  const handleNewTask = () => {
    setEditingTask(null)
    setShowTaskForm(true)
  }

  const handleEditTask = (task: KanbanTask) => {
    setEditingTask(task)
    setShowTaskForm(true)
  }

  const handleTaskSaved = () => {
    fetchTasks()
  }

  const handleStagesChanged = () => {
    fetchStages()
    fetchTasks()
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading task board...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Task Board</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* Filter */}
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-44"
          >
            <option value="all">All Tasks</option>
            {currentUserId && <option value={currentUserId}>My Tasks</option>}
            {users
              .filter((u) => String(u.id) !== String(currentUserId))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName || u.lastName
                    ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
                    : u.email}
                </option>
              ))}
          </Select>

          {isAdmin && (
            <Button variant="outline" onClick={() => setShowStageManager(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Stages
            </Button>
          )}

          <Button onClick={handleNewTask}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-min">
            {stages.map((stage) => (
              <DroppableStageColumn
                key={stage.id}
                stage={stage}
                tasks={getTasksForStage(stage.id)}
                onTaskClick={handleEditTask}
                isOver={overStageId === stage.id}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="w-72">
                <TaskCard task={activeTask} onClick={() => {}} isDragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Dialogs */}
      {isAdmin && (
        <StageManager
          open={showStageManager}
          onOpenChange={setShowStageManager}
          stages={stages}
          onStagesChanged={handleStagesChanged}
        />
      )}

      <TaskFormDialog
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        task={editingTask}
        stages={stages}
        users={users}
        defaultStageId={stages[0]?.id}
        currentUserId={currentUserId ? parseInt(currentUserId) : null}
        onSaved={handleTaskSaved}
      />
    </div>
  )
}
