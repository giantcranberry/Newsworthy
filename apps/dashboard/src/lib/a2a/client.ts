import type { AgentCard, JsonRpcResponse, Message, Task, SSEEvent } from './types'

export class A2AClient {
  private timeout: number

  constructor(options?: { timeout?: number }) {
    this.timeout = options?.timeout ?? 30_000
  }

  async discoverAgent(baseUrl: string): Promise<AgentCard> {
    const url = new URL('/.well-known/agent-card.json', baseUrl)
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok) {
      throw new Error(`Failed to discover agent at ${baseUrl}: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async sendMessage(
    agentUrl: string,
    message: Message,
    metadata?: Record<string, unknown>
  ): Promise<Task> {
    const response = await this.rpcCall(agentUrl, 'message/send', { message, metadata })

    if (response.error) {
      throw new Error(`A2A error ${response.error.code}: ${response.error.message}`)
    }

    return response.result as Task
  }

  async *streamMessage(
    agentUrl: string,
    message: Message,
    metadata?: Record<string, unknown>
  ): AsyncGenerator<SSEEvent> {
    const id = crypto.randomUUID()
    const body = JSON.stringify({
      jsonrpc: '2.0',
      method: 'message/stream',
      params: { message, metadata },
      id,
    })

    const response = await fetch(agentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok) {
      throw new Error(`A2A stream error: ${response.status} ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('No response body for stream')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data) {
              yield JSON.parse(data) as SSEEvent
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async getTask(agentUrl: string, taskId: string): Promise<Task> {
    const response = await this.rpcCall(agentUrl, 'tasks/get', { taskId })

    if (response.error) {
      throw new Error(`A2A error ${response.error.code}: ${response.error.message}`)
    }

    return response.result as Task
  }

  async cancelTask(agentUrl: string, taskId: string): Promise<Task> {
    const response = await this.rpcCall(agentUrl, 'tasks/cancel', { taskId })

    if (response.error) {
      throw new Error(`A2A error ${response.error.code}: ${response.error.message}`)
    }

    return response.result as Task
  }

  private async rpcCall(url: string, method: string, params: Record<string, unknown>): Promise<JsonRpcResponse> {
    const id = crypto.randomUUID()
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id }),
      signal: AbortSignal.timeout(this.timeout),
    })

    if (!response.ok && response.status !== 429 && response.status !== 404) {
      throw new Error(`A2A request failed: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }
}
