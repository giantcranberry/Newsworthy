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
import { Plus, Settings, GripVertical, FileText, Calendar, MessageSquare, Building2, Archive } from 'lucide-react'
import { StageManager, type Stage } from './stage-manager'
import { TaskFormDialog, type KanbanTask, type BrandCompany, getPriorityConfig } from './task-form'

export interface TaskBoardConfig {
  apiBase: string
  title: string
  showUserFilter: boolean
  showAssignee: boolean
  canManageStages: boolean
  showBrandFilter: boolean
}

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
  showAssignee = true,
  onArchive,
}: {
  task: KanbanTask
  onClick: () => void
  isDragging?: boolean
  showAssignee?: boolean
  onArchive?: () => void
}) {
  const assigneeName = task.assigneeFirstName || task.assigneeLastName
    ? `${task.assigneeFirstName || ''} ${task.assigneeLastName || ''}`.trim()
    : task.assigneeEmail

  const creatorName = task.creatorFirstName || task.creatorLastName
    ? `${task.creatorFirstName || ''} ${task.creatorLastName || ''}`.trim()
    : task.creatorEmail || null

  return (
    <div
      className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 cursor-pointer hover:border-gray-300 dark:border-gray-700 hover:shadow-sm dark:shadow-gray-900/50 transition-all ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 flex-1">{task.title}</h4>
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
        {task.companyName && (
          <span className="inline-flex items-center gap-1 text-xs text-cyan-700 bg-cyan-50 dark:bg-cyan-900/30 rounded-full px-2 py-0.5">
            <Building2 className="h-3 w-3" />
            {task.companyName}
          </span>
        )}

        {showAssignee && assigneeName && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">
            <i className="fa-light fa-circle-user text-xs" aria-hidden="true" />
            {assigneeName}
          </span>
        )}

        {task.files && task.files.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <FileText className="h-3 w-3" />
            {task.files.length}
          </span>
        )}

        {task.noteCount && task.noteCount > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <MessageSquare className="h-3 w-3" />
            {task.noteCount}
          </span>
        ) : null}

        <span className="inline-flex items-center gap-1 text-xs text-gray-400 ml-auto">
          <Calendar className="h-3 w-3" />
          {new Date(task.createdAt).toLocaleDateString()}
        </span>
      </div>

      {creatorName && (
        <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
          Created by {creatorName}
        </p>
      )}

      {onArchive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onArchive()
          }}
          className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <Archive className="h-3 w-3" />
          Archive
        </button>
      )}
    </div>
  )
}

function SortableTaskCard({
  task,
  onClick,
  showAssignee,
  tourId,
  onArchive,
}: {
  task: KanbanTask
  onClick: () => void
  showAssignee: boolean
  tourId?: string
  onArchive?: () => void
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
    <div ref={setNodeRef} style={style} className="relative group" {...(tourId ? { "data-tour": tourId } : {})}>
      <div
        className="absolute top-3 right-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
      <TaskCard task={task} onClick={onClick} showAssignee={showAssignee} onArchive={onArchive} />
    </div>
  )
}

function DroppableStageColumn({
  stage,
  tasks,
  onTaskClick,
  isOver,
  showAssignee,
  isFirst,
  onArchiveTask,
}: {
  stage: Stage
  tasks: KanbanTask[]
  onTaskClick: (task: KanbanTask) => void
  isOver: boolean
  showAssignee: boolean
  isFirst?: boolean
  onArchiveTask?: (taskId: number) => void
}) {
  const { setNodeRef } = useDroppable({
    id: `stage-${stage.id}`,
    data: { type: 'stage', stageId: stage.id },
  })

  return (
    <div {...(isFirst ? { "data-tour": "tasks-first-column" } : {})} className={`flex flex-col w-72 min-w-72 rounded-lg border transition-colors ${isOver ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800'}`}>
      {/* Column header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1">{stage.name}</h3>
          <span className="text-xs text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5">
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
          {tasks.map((task, index) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              showAssignee={showAssignee}
              tourId={isFirst && index === 0 ? "tasks-first-card" : undefined}
              onArchive={onArchiveTask ? () => onArchiveTask(task.id) : undefined}
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

export function TaskBoard({ config }: { config: TaskBoardConfig }) {
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id

  const [stages, setStages] = useState<Stage[]>([])
  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [users, setUsers] = useState<EditorialUser[]>([])
  const [companies, setCompanies] = useState<BrandCompany[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  // Dialogs
  const [showStageManager, setShowStageManager] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null)

  // DnD
  const [activeId, setActiveId] = useState<number | null>(null)
  const [overStageId, setOverStageId] = useState<number | null>(null)
  const [dragOriginStageId, setDragOriginStageId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const fetchStages = useCallback(async () => {
    try {
      const res = await fetch(`${config.apiBase}/stages`)
      if (res.ok) setStages(await res.json())
    } catch (err) {
      console.error('Error fetching stages:', err)
    }
  }, [config.apiBase])

  const fetchTasks = useCallback(async () => {
    try {
      const searchParams = new URLSearchParams()
      if (filter && filter !== 'all') searchParams.set('assignedTo', filter)
      if (brandFilter && brandFilter !== 'all') searchParams.set('companyId', brandFilter)
      const qs = searchParams.toString()
      const res = await fetch(`${config.apiBase}${qs ? `?${qs}` : ''}`)
      if (res.ok) setTasks(await res.json())
    } catch (err) {
      console.error('Error fetching tasks:', err)
    }
  }, [filter, brandFilter, config.apiBase])

  const fetchUsers = useCallback(async () => {
    if (!config.showUserFilter) return
    try {
      const res = await fetch('/api/admin/users/search?role=editorial')
      if (res.ok) setUsers(await res.json())
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }, [config.showUserFilter])

  const fetchCompanies = useCallback(async () => {
    if (!config.showBrandFilter) return
    try {
      const res = await fetch(`${config.apiBase}/companies`)
      if (res.ok) setCompanies(await res.json())
    } catch (err) {
      console.error('Error fetching companies:', err)
    }
  }, [config.showBrandFilter, config.apiBase])

  useEffect(() => {
    Promise.all([fetchStages(), fetchTasks(), fetchUsers(), fetchCompanies()]).then(() =>
      setLoading(false)
    )
  }, [fetchStages, fetchTasks, fetchUsers, fetchCompanies])

  useEffect(() => {
    fetchTasks()
  }, [filter, brandFilter, fetchTasks])

  const getTasksForStage = (stageId: number) =>
    tasks
      .filter((t) => t.stageId === stageId)
      .sort((a, b) => a.sortOrder - b.sortOrder)

  const handleDragStart = (event: DragStartEvent) => {
    const idStr = String(event.active.id)
    if (idStr.startsWith('task-')) {
      const taskId = parseInt(idStr.replace('task-', ''))
      setActiveId(taskId)
      const task = tasks.find((t) => t.id === taskId)
      setDragOriginStageId(task ? task.stageId : null)
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
    const originStageId = dragOriginStageId
    setActiveId(null)
    setOverStageId(null)
    setDragOriginStageId(null)

    if (!over) return

    const activeIdStr = String(active.id)
    if (!activeIdStr.startsWith('task-')) return
    const taskId = parseInt(activeIdStr.replace('task-', ''))

    const draggedTask = tasks.find((t) => t.id === taskId)
    if (!draggedTask) return

    const targetStageId = findStageForId(over.id, tasks, stages)
    if (!targetStageId) return

    const isCrossStage = originStageId !== null && originStageId !== targetStageId
    const stageTasks = getTasksForStage(targetStageId)

    // Determine sort order
    let targetSortOrder: number
    const overIdStr = String(over.id)

    if (overIdStr.startsWith('task-')) {
      const overTaskId = parseInt(overIdStr.replace('task-', ''))
      const overIndex = stageTasks.findIndex((t) => t.id === overTaskId)
      const activeIndex = stageTasks.findIndex((t) => t.id === taskId)

      if (isCrossStage) {
        // Cross-stage drop on a task
        targetSortOrder = overIndex >= 0 ? overIndex : stageTasks.length
      } else if (activeIndex !== -1 && activeIndex !== overIndex) {
        // Same-stage reorder
        const reordered = arrayMove(stageTasks, activeIndex, overIndex)
        targetSortOrder = overIndex
        setTasks((prev) => {
          const others = prev.filter((t) => t.stageId !== targetStageId)
          const updated = reordered.map((t, i) => ({ ...t, sortOrder: i }))
          return [...others, ...updated]
        })
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
      const res = await fetch(`${config.apiBase}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, stageId: targetStageId, sortOrder: targetSortOrder }),
      })
      if (!res.ok) {
        fetchTasks()
      }
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

  const handleArchiveTask = async (taskId: number) => {
    try {
      const res = await fetch(`${config.apiBase}/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      })
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId))
      }
    } catch (err) {
      console.error('Error archiving task:', err)
    }
  }

  const handleStagesChanged = () => {
    fetchStages()
    fetchTasks()
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading task board...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div data-tour="tasks-topbar" className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{config.title}</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* Brand Filter */}
          {config.showBrandFilter && companies.length > 0 && (
            <Select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-48"
            >
              <option value="all">All Brands</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>
          )}

          {/* User Filter */}
          {config.showUserFilter && (
            <span data-tour="tasks-filter">
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
            </span>
          )}

          {config.canManageStages && (
            <Button data-tour="tasks-stages" variant="outline" onClick={() => setShowStageManager(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Stages
            </Button>
          )}

          <Button data-tour="tasks-new" onClick={handleNewTask} className="bg-cyan-800 dark:bg-cyan-600 hover:bg-cyan-900 dark:hover:bg-cyan-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div data-tour="tasks-board" className="overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-min">
            {stages.map((stage, index) => {
              const isDoneStage = stage.name.toLowerCase() === 'done'
              return (
                <DroppableStageColumn
                  key={stage.id}
                  stage={stage}
                  tasks={getTasksForStage(stage.id)}
                  onTaskClick={handleEditTask}
                  isOver={overStageId === stage.id}
                  showAssignee={config.showAssignee}
                  isFirst={index === 0}
                  onArchiveTask={isDoneStage ? handleArchiveTask : undefined}
                />
              )
            })}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="w-72">
                <TaskCard task={activeTask} onClick={() => {}} isDragging showAssignee={config.showAssignee} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Dialogs */}
      {config.canManageStages && (
        <StageManager
          open={showStageManager}
          onOpenChange={setShowStageManager}
          stages={stages}
          onStagesChanged={handleStagesChanged}
          apiBase={config.apiBase}
        />
      )}

      <TaskFormDialog
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        task={editingTask}
        stages={stages}
        users={users}
        companies={companies}
        defaultStageId={stages.find((s) => s.name.toLowerCase() === 'to do')?.id || stages[0]?.id}
        currentUserId={currentUserId ? parseInt(currentUserId) : null}
        onSaved={handleTaskSaved}
        apiBase={config.apiBase}
        showAssignee={config.showAssignee}
        showBrandSelector={config.showBrandFilter}
      />
    </div>
  )
}
