import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, MAX_REQUESTS_AUTHENTICATED } from '@/lib/a2a/rate-limit'
import { createTask, updateTask, getTask, cancelTask } from '@/lib/a2a/task-manager'
import { searchReleases } from '@/lib/a2a/skills/search-releases'
import { getRelease } from '@/lib/a2a/skills/get-release'
import { analyzeRelease } from '@/lib/a2a/skills/analyze-release'
import { searchBrands } from '@/lib/a2a/skills/search-brands'
import { createBrand } from '@/lib/a2a/skills/create-brand'
import { updateBrand } from '@/lib/a2a/skills/update-brand'
import { listBrands } from '@/lib/a2a/skills/list-brands'
import { createRelease } from '@/lib/a2a/skills/create-release'
import { updateRelease } from '@/lib/a2a/skills/update-release'
import { deleteRelease } from '@/lib/a2a/skills/delete-release'
import { submitRelease } from '@/lib/a2a/skills/submit-release'
import { listReleases } from '@/lib/a2a/skills/list-releases'
import { extractApiKey, authenticateA2A } from '@/lib/a2a/auth'
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  Message,
  SkillHandler,
  AuthenticatedSkillHandler,
  AuthContext,
  SSEEvent,
} from '@/lib/a2a/types'
import { JSON_RPC_ERRORS } from '@/lib/a2a/types'

// ── Skill Registries ──

const publicSkills: Record<string, SkillHandler> = {
  search_releases: searchReleases,
  search_brands: searchBrands,
  get_release: getRelease,
  analyze_release: analyzeRelease,
}

const authenticatedSkills: Record<string, AuthenticatedSkillHandler> = {
  create_brand: createBrand,
  update_brand: updateBrand,
  list_brands: listBrands,
  create_release: createRelease,
  update_release: updateRelease,
  delete_release: deleteRelease,
  submit_release: submitRelease,
  list_releases: listReleases,
}

// Infer which public skill to invoke from the message content
function resolvePublicSkill(message: Message, metadata?: Record<string, unknown>): { id: string; handler: SkillHandler } | null {
  // Check explicit skill ID in metadata
  if (metadata?.skillId && typeof metadata.skillId === 'string' && publicSkills[metadata.skillId]) {
    return { id: metadata.skillId, handler: publicSkills[metadata.skillId] }
  }

  // Infer from message text
  const text = message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join(' ')
    .toLowerCase()

  if (text.match(/\b(brand|brands|company|companies|newsroom|newsrooms)\b/)) {
    return { id: 'search_brands', handler: searchBrands }
  }
  if (text.match(/\b(search|find|list|query|browse)\b/)) {
    return { id: 'search_releases', handler: searchReleases }
  }
  if (text.match(/\b(analyz|analyse|review|assess|evaluate|audit)\b/)) {
    return { id: 'analyze_release', handler: analyzeRelease }
  }
  if (text.match(/\b(get|read|fetch|show|retrieve|view)\b/) || text.match(/[0-9a-f]{8}-[0-9a-f]{4}/i)) {
    return { id: 'get_release', handler: getRelease }
  }

  // Default to search
  return { id: 'search_releases', handler: searchReleases }
}

// Infer which authenticated skill to invoke from the message content
function resolveAuthenticatedSkill(message: Message, metadata?: Record<string, unknown>): { id: string; handler: AuthenticatedSkillHandler } | null {
  // Check explicit skill ID in metadata
  if (metadata?.skillId && typeof metadata.skillId === 'string') {
    if (authenticatedSkills[metadata.skillId]) {
      return { id: metadata.skillId, handler: authenticatedSkills[metadata.skillId] }
    }
    // Also allow authenticated users to use public skills via explicit ID
    // (handled in the caller)
  }

  const text = message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join(' ')
    .toLowerCase()

  // Authenticated brand operations
  if (text.match(/\b(create|add|new)\s+(brand|company)\b/)) {
    return { id: 'create_brand', handler: createBrand }
  }
  if (text.match(/\b(update|edit|modify|change)\s+(brand|company)\b/)) {
    return { id: 'update_brand', handler: updateBrand }
  }
  if (text.match(/\b(list|my)\s+(brands|companies)\b/) || text.match(/\bmy\s+brands\b/)) {
    return { id: 'list_brands', handler: listBrands }
  }

  // Authenticated release operations
  if (text.match(/\b(create|add|new)\s+(release|pr|press\s*release)\b/)) {
    return { id: 'create_release', handler: createRelease }
  }
  if (text.match(/\b(update|edit|modify|change)\s+(release|pr|press\s*release)\b/)) {
    return { id: 'update_release', handler: updateRelease }
  }
  if (text.match(/\b(delete|remove)\s+(release|pr|press\s*release)\b/)) {
    return { id: 'delete_release', handler: deleteRelease }
  }
  if (text.match(/\b(submit|finalize|send\s+for\s+review)\s+(release|pr|press\s*release)?\b/)) {
    return { id: 'submit_release', handler: submitRelease }
  }
  if (text.match(/\b(list|my)\s+(releases|prs|press\s*releases)\b/) || text.match(/\bmy\s+releases\b/)) {
    return { id: 'list_releases', handler: listReleases }
  }

  // Not an authenticated skill — return null so we fall through to public
  return null
}

// ── Helpers ──

function jsonRpcError(id: string | number | null, error: { code: number; message: string }, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    error: { code: error.code, message: error.message, data },
    id,
  }
}

function jsonRpcSuccess(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', result, id }
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '127.0.0.1'
}

// ── CORS ──

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}

// ── POST Handler ──

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const hasAuthHeader = !!extractApiKey(request)

  // Authenticate if Bearer token is present
  let authContext: AuthContext | null = null
  if (hasAuthHeader) {
    authContext = await authenticateA2A(request)
    if (!authContext) {
      return NextResponse.json(
        jsonRpcError(null, { code: 401, message: 'Invalid or expired API key' }),
        { status: 401, headers: corsHeaders }
      )
    }
  }

  // Rate limiting: per API key (120/min) or per IP (60/min)
  const rateLimitId = authContext ? `key:${authContext.keyId}` : ip
  const rateLimitMax = authContext ? MAX_REQUESTS_AUTHENTICATED : undefined
  const rateLimit = checkRateLimit(rateLimitId, rateLimitMax)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      jsonRpcError(null, { code: 429, message: 'Rate limit exceeded' }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimit.resetAt),
        },
      }
    )
  }

  // Parse request
  let body: JsonRpcRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      jsonRpcError(null, JSON_RPC_ERRORS.PARSE_ERROR),
      { status: 400, headers: corsHeaders }
    )
  }

  // Validate JSON-RPC structure
  if (body.jsonrpc !== '2.0' || !body.method || !body.id) {
    return NextResponse.json(
      jsonRpcError(body?.id ?? null, JSON_RPC_ERRORS.INVALID_REQUEST),
      { status: 400, headers: corsHeaders }
    )
  }

  const rateLimitHeaders = {
    ...corsHeaders,
    'X-RateLimit-Remaining': String(rateLimit.remaining),
    'X-RateLimit-Reset': String(rateLimit.resetAt),
  }

  try {
    switch (body.method) {
      case 'message/send':
        return await handleMessageSend(body, rateLimitHeaders, authContext)

      case 'message/stream':
        return await handleMessageStream(body, rateLimitHeaders, authContext)

      case 'tasks/get':
        return handleTasksGet(body, rateLimitHeaders)

      case 'tasks/cancel':
        return handleTasksCancel(body, rateLimitHeaders)

      default:
        return NextResponse.json(
          jsonRpcError(body.id, JSON_RPC_ERRORS.METHOD_NOT_FOUND),
          { status: 400, headers: rateLimitHeaders }
        )
    }
  } catch (error) {
    console.error('[A2A] Error processing request:', error)
    return NextResponse.json(
      jsonRpcError(body.id, JSON_RPC_ERRORS.INTERNAL_ERROR, error instanceof Error ? error.message : undefined),
      { status: 500, headers: rateLimitHeaders }
    )
  }
}

// ── Method Handlers ──

async function handleMessageSend(body: JsonRpcRequest, headers: Record<string, string>, authContext: AuthContext | null) {
  const params = body.params as { message?: Message; metadata?: Record<string, unknown> } | undefined

  if (!params?.message || !Array.isArray(params.message.parts)) {
    return NextResponse.json(
      jsonRpcError(body.id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Missing or invalid message'),
      { status: 400, headers }
    )
  }

  const message = params.message

  // Try authenticated skill first if auth context is present
  if (authContext) {
    const authSkill = resolveAuthenticatedSkill(message, params.metadata)
    if (authSkill) {
      const task = createTask(message)
      updateTask(task.id, 'working')
      try {
        const result = await authSkill.handler(message, authContext)
        const completedTask = updateTask(task.id, 'completed', {
          artifacts: result.artifacts,
          messages: result.messages,
          statusMessage: {
            role: 'agent',
            parts: result.artifacts[0]?.parts || [{ type: 'text', text: 'Done' }],
          },
        })
        return NextResponse.json(jsonRpcSuccess(body.id, completedTask), { headers })
      } catch (error) {
        updateTask(task.id, 'failed', {
          statusMessage: {
            role: 'agent',
            parts: [{ type: 'text', text: error instanceof Error ? error.message : 'Skill execution failed' }],
          },
        })
        throw error
      }
    }
    // Fall through to public skills if no authenticated skill matched
  }

  // Public skill resolution
  const skill = resolvePublicSkill(message, params.metadata)

  if (!skill) {
    return NextResponse.json(
      jsonRpcError(body.id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Could not determine which skill to invoke'),
      { status: 400, headers }
    )
  }

  const task = createTask(message)
  updateTask(task.id, 'working')

  try {
    const result = await skill.handler(message)
    const completedTask = updateTask(task.id, 'completed', {
      artifacts: result.artifacts,
      messages: result.messages,
      statusMessage: {
        role: 'agent',
        parts: result.artifacts[0]?.parts || [{ type: 'text', text: 'Done' }],
      },
    })

    return NextResponse.json(
      jsonRpcSuccess(body.id, completedTask),
      { headers }
    )
  } catch (error) {
    updateTask(task.id, 'failed', {
      statusMessage: {
        role: 'agent',
        parts: [{ type: 'text', text: error instanceof Error ? error.message : 'Skill execution failed' }],
      },
    })
    throw error
  }
}

async function handleMessageStream(body: JsonRpcRequest, headers: Record<string, string>, authContext: AuthContext | null) {
  const params = body.params as { message?: Message; metadata?: Record<string, unknown> } | undefined

  if (!params?.message || !Array.isArray(params.message.parts)) {
    return NextResponse.json(
      jsonRpcError(body.id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Missing or invalid message'),
      { status: 400, headers }
    )
  }

  const message = params.message

  // Determine handler (authenticated or public)
  let skillId: string
  let executeSkill: () => Promise<{ artifacts: any[]; messages?: any[] }>

  if (authContext) {
    const authSkill = resolveAuthenticatedSkill(message, params.metadata)
    if (authSkill) {
      skillId = authSkill.id
      executeSkill = () => authSkill.handler(message, authContext)
    } else {
      const publicSkill = resolvePublicSkill(message, params.metadata)
      if (!publicSkill) {
        return NextResponse.json(
          jsonRpcError(body.id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Could not determine which skill to invoke'),
          { status: 400, headers }
        )
      }
      skillId = publicSkill.id
      executeSkill = () => publicSkill.handler(message)
    }
  } else {
    const publicSkill = resolvePublicSkill(message, params.metadata)
    if (!publicSkill) {
      return NextResponse.json(
        jsonRpcError(body.id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Could not determine which skill to invoke'),
        { status: 400, headers }
      )
    }
    skillId = publicSkill.id
    executeSkill = () => publicSkill.handler(message)
  }

  const task = createTask(message)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: SSEEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      // Send submitted status
      sendEvent({
        type: 'TaskStatusUpdate',
        taskId: task.id,
        status: { state: 'submitted', timestamp: new Date().toISOString() },
      })

      // Working
      updateTask(task.id, 'working')
      sendEvent({
        type: 'TaskStatusUpdate',
        taskId: task.id,
        status: { state: 'working', timestamp: new Date().toISOString() },
      })

      try {
        const result = await executeSkill()

        // Send artifact updates
        for (const artifact of result.artifacts) {
          sendEvent({
            type: 'TaskArtifactUpdate',
            taskId: task.id,
            artifact,
          })
        }

        // Completed
        updateTask(task.id, 'completed', {
          artifacts: result.artifacts,
          messages: result.messages,
        })
        sendEvent({
          type: 'TaskStatusUpdate',
          taskId: task.id,
          status: { state: 'completed', timestamp: new Date().toISOString() },
        })
      } catch (error) {
        updateTask(task.id, 'failed', {
          statusMessage: {
            role: 'agent',
            parts: [{ type: 'text', text: error instanceof Error ? error.message : 'Skill execution failed' }],
          },
        })
        sendEvent({
          type: 'TaskStatusUpdate',
          taskId: task.id,
          status: {
            state: 'failed',
            message: {
              role: 'agent',
              parts: [{ type: 'text', text: error instanceof Error ? error.message : 'Skill execution failed' }],
            },
            timestamp: new Date().toISOString(),
          },
        })
      }

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      ...headers,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function handleTasksGet(body: JsonRpcRequest, headers: Record<string, string>) {
  const params = body.params as { taskId?: string } | undefined

  if (!params?.taskId) {
    return NextResponse.json(
      jsonRpcError(body.id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Missing taskId'),
      { status: 400, headers }
    )
  }

  const task = getTask(params.taskId)
  if (!task) {
    return NextResponse.json(
      jsonRpcError(body.id, { code: -32001, message: 'Task not found' }),
      { status: 404, headers }
    )
  }

  return NextResponse.json(jsonRpcSuccess(body.id, task), { headers })
}

function handleTasksCancel(body: JsonRpcRequest, headers: Record<string, string>) {
  const params = body.params as { taskId?: string } | undefined

  if (!params?.taskId) {
    return NextResponse.json(
      jsonRpcError(body.id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Missing taskId'),
      { status: 400, headers }
    )
  }

  const task = cancelTask(params.taskId)
  if (!task) {
    return NextResponse.json(
      jsonRpcError(body.id, { code: -32001, message: 'Task not found' }),
      { status: 404, headers }
    )
  }

  return NextResponse.json(jsonRpcSuccess(body.id, task), { headers })
}
