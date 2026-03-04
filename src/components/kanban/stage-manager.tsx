'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2, Plus } from 'lucide-react'

export interface Stage {
  id: number
  name: string
  color: string
  sortOrder: number
}

function SortableStageRow({
  stage,
  onUpdate,
  onDelete,
}: {
  stage: Stage
  onUpdate: (id: number, name: string, color: string) => void
  onDelete: (id: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-lg"
    >
      <div
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:text-gray-400"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <input
        type="color"
        value={stage.color}
        onChange={(e) => onUpdate(stage.id, stage.name, e.target.value)}
        className="h-8 w-8 rounded border border-gray-300 dark:border-gray-700 cursor-pointer p-0"
      />

      <Input
        value={stage.name}
        onChange={(e) => onUpdate(stage.id, e.target.value, stage.color)}
        className="flex-1"
      />

      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(stage.id)}
        className="text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function StageManager({
  open,
  onOpenChange,
  stages: initialStages,
  onStagesChanged,
  apiBase,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stages: Stage[]
  onStagesChanged: () => void
  apiBase: string
}) {
  const [stages, setStages] = useState<Stage[]>(initialStages)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#3b82f6')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sync when dialog opens with fresh stages
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setStages(initialStages)
    }
    onOpenChange(open)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = stages.findIndex((s) => s.id === active.id)
    const newIndex = stages.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(stages, oldIndex, newIndex)
    setStages(reordered)

    try {
      const res = await fetch(`${apiBase}/stages/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageIds: reordered.map((s) => s.id) }),
      })
      if (res.ok) onStagesChanged()
      else setStages(stages) // revert
    } catch {
      setStages(stages)
    }
  }

  const handleUpdate = async (id: number, name: string, color: string) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, name, color } : s)))
  }

  const handleSaveStage = async (stage: Stage) => {
    try {
      await fetch(`${apiBase}/stages/${stage.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: stage.name, color: stage.color }),
      })
      onStagesChanged()
    } catch (err) {
      console.error('Error saving stage:', err)
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      })
      if (res.ok) {
        const stage = await res.json()
        setStages((prev) => [...prev, stage])
        setNewName('')
        setNewColor('#3b82f6')
        onStagesChanged()
      }
    } catch (err) {
      console.error('Error adding stage:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    try {
      const res = await fetch(`${apiBase}/stages/${deleteId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setStages((prev) => prev.filter((s) => s.id !== deleteId))
        onStagesChanged()
      }
    } catch (err) {
      console.error('Error deleting stage:', err)
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Stages</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={stages.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {stages.map((stage) => (
                  <SortableStageRow
                    key={stage.id}
                    stage={stage}
                    onUpdate={handleUpdate}
                    onDelete={(id) => setDeleteId(id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {/* Add new stage */}
          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-2 block">Add Stage</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-9 w-9 rounded border border-gray-300 dark:border-gray-700 cursor-pointer p-0"
              />
              <Input
                placeholder="Stage name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                className="flex-1"
              />
              <Button onClick={handleAdd} disabled={saving || !newName.trim()} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                // Save all pending changes
                stages.forEach((stage) => {
                  const original = initialStages.find((s) => s.id === stage.id)
                  if (original && (original.name !== stage.name || original.color !== stage.color)) {
                    handleSaveStage(stage)
                  }
                })
                onOpenChange(false)
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stage</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this stage and all tasks within it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
