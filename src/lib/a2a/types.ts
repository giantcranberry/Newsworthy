// A2A Protocol Types
// Based on the Agent-to-Agent (A2A) protocol specification

// ── Agent Card ──

export interface AgentCard {
  name: string
  description: string
  url: string
  version: string
  capabilities: AgentCapabilities
  defaultInputModes: string[]
  defaultOutputModes: string[]
  skills: AgentSkill[]
}

export interface AgentCapabilities {
  streaming: boolean
  pushNotifications: boolean
}

export interface AgentSkill {
  id: string
  name: string
  description: string
  inputModes: string[]
  outputModes: string[]
}

// ── JSON-RPC 2.0 ──

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
  id: string | number
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  result?: unknown
  error?: JsonRpcError
  id: string | number | null
}

export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

// Standard JSON-RPC error codes
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid Request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },
} as const

// ── Tasks ──

export type TaskStatus = 'submitted' | 'working' | 'completed' | 'failed' | 'canceled' | 'input-required'

export interface Task {
  id: string
  sessionId: string
  status: TaskStatusUpdate
  messages: Message[]
  artifacts: Artifact[]
  metadata: Record<string, unknown>
}

export interface TaskStatusUpdate {
  state: TaskStatus
  message?: Message
  timestamp: string
}

// ── Messages ──

export type MessageRole = 'user' | 'agent'

export interface Message {
  role: MessageRole
  parts: Part[]
}

// ── Parts ──

export type Part = TextPart | DataPart | FilePart

export interface TextPart {
  type: 'text'
  text: string
}

export interface DataPart {
  type: 'data'
  mimeType: string
  data: Record<string, unknown>
}

export interface FilePart {
  type: 'file'
  mimeType: string
  name: string
  uri: string
}

// ── Artifacts ──

export interface Artifact {
  id: string
  name: string
  parts: Part[]
  metadata?: Record<string, unknown>
}

// ── SSE Events ──

export interface TaskStatusEvent {
  type: 'TaskStatusUpdate'
  taskId: string
  status: TaskStatusUpdate
}

export interface TaskArtifactEvent {
  type: 'TaskArtifactUpdate'
  taskId: string
  artifact: Artifact
}

export type SSEEvent = TaskStatusEvent | TaskArtifactEvent

// ── Skill Handler ──

export interface SkillResult {
  artifacts: Artifact[]
  messages?: Message[]
}

export type SkillHandler = (message: Message) => Promise<SkillResult>

// ── Authenticated A2A ──

export interface AuthContext {
  userId: number
  companyId: number
  keyId: number
}

export type AuthenticatedSkillHandler = (message: Message, auth: AuthContext) => Promise<SkillResult>
