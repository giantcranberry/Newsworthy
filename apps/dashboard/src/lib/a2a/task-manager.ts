import { randomUUID } from 'crypto'
import type { Task, TaskStatus, Message, Artifact, TaskStatusUpdate } from './types'

const tasks = new Map<string, Task>()

// Clean up tasks older than 1 hour every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 3_600_000
  for (const [id, task] of tasks) {
    const ts = new Date(task.status.timestamp).getTime()
    if (ts < cutoff) {
      tasks.delete(id)
    }
  }
}, 600_000)

export function createTask(message: Message, sessionId?: string): Task {
  const task: Task = {
    id: randomUUID(),
    sessionId: sessionId || randomUUID(),
    status: {
      state: 'submitted',
      timestamp: new Date().toISOString(),
    },
    messages: [message],
    artifacts: [],
    metadata: {},
  }
  tasks.set(task.id, task)
  return task
}

export function updateTask(
  id: string,
  state: TaskStatus,
  options?: { messages?: Message[]; artifacts?: Artifact[]; statusMessage?: Message }
): Task | null {
  const task = tasks.get(id)
  if (!task) return null

  const statusUpdate: TaskStatusUpdate = {
    state,
    timestamp: new Date().toISOString(),
  }
  if (options?.statusMessage) {
    statusUpdate.message = options.statusMessage
  }

  task.status = statusUpdate

  if (options?.messages) {
    task.messages.push(...options.messages)
  }
  if (options?.artifacts) {
    task.artifacts.push(...options.artifacts)
  }

  return task
}

export function getTask(id: string): Task | null {
  return tasks.get(id) || null
}

export function cancelTask(id: string): Task | null {
  const task = tasks.get(id)
  if (!task) return null

  // Only cancel non-terminal tasks
  if (task.status.state === 'completed' || task.status.state === 'failed' || task.status.state === 'canceled') {
    return task
  }

  task.status = {
    state: 'canceled',
    timestamp: new Date().toISOString(),
  }
  return task
}
