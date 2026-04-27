# Newsworthy A2A & MCP Integration Guide

## What is A2A?

[Agent-to-Agent (A2A)](https://a2a-protocol.org/) is an open protocol by Google (now under the Linux Foundation) that lets AI agents discover and communicate with each other over HTTP using JSON-RPC 2.0.

## What is MCP?

[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) is Anthropic's open protocol that lets AI models call external tools and access data sources. Think of it as giving an LLM a set of callable functions.

**A2A = agent-to-agent communication. MCP = model-to-tool communication.**

---

## Newsworthy A2A (Already Implemented)

### Discovery

Every A2A agent publishes an **Agent Card** at a well-known URL. Newsworthy's is:

```
GET https://www.newsworthy.ai/.well-known/agent-card.json
```

This returns a JSON document describing Newsworthy's capabilities, skills, and authentication requirements. Any A2A-compatible agent can discover Newsworthy by fetching this URL.

### Endpoint

All A2A communication goes through a single JSON-RPC 2.0 endpoint:

```
POST https://www.newsworthy.ai/api/a2a
Content-Type: application/json
```

### Available Skills

#### Public (no auth required)

| Skill             | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| `search_releases` | Search published press releases by keyword, category, region, date |
| `search_brands`   | Find companies with published releases                             |
| `get_release`     | Fetch full release content by UUID                                 |
| `analyze_release` | AI-powered SEO/readability analysis                                |

#### Authenticated (requires API key)

| Skill            | Description                          |
| ---------------- | ------------------------------------ |
| `create_brand`   | Create a new company                 |
| `update_brand`   | Modify company info                  |
| `list_brands`    | List your brands                     |
| `create_release` | Draft a new press release (1 credit) |
| `update_release` | Update a draft release               |
| `delete_release` | Delete a release                     |
| `submit_release` | Submit for editorial review          |
| `list_releases`  | List your releases                   |

### Authentication

1. Go to **Settings > API Keys** in the Newsworthy dashboard
2. Create an API key (scoped to a specific brand)
3. Use the key as a Bearer token:

```bash
curl -X POST https://www.newsworthy.ai/api/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer nw_a2a_your_key_here" \
  -d '{...}'
```

Key format: `nw_a2a_` followed by 32 hex characters. The full key is shown only once at creation.

### Quick Start: Search Releases

```bash
curl -X POST https://www.newsworthy.ai/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{ "type": "text", "text": "Search for AI press releases" }]
      },
      "metadata": {
        "skillId": "search_releases"
      }
    }
  }'
```

### Quick Start: Create a Release (Authenticated)

```bash
curl -X POST https://www.newsworthy.ai/api/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer nw_a2a_your_key_here" \
  -d '{
    "jsonrpc": "2.0",
    "id": "2",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{
          "type": "data",
          "data": {
            "title": "Acme Corp Launches New Product",
            "abstract": "Acme Corp today announced...",
            "body": "<p>Full press release body in HTML...</p>"
          }
        }]
      },
      "metadata": {
        "skillId": "create_release"
      }
    }
  }'
```

### Streaming

Use `message/stream` instead of `message/send` to receive Server-Sent Events:

```bash
curl -N -X POST https://www.newsworthy.ai/api/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "3",
    "method": "message/stream",
    "params": {
      "message": {
        "role": "user",
        "parts": [{ "type": "text", "text": "Analyze release abc-123" }]
      },
      "metadata": { "skillId": "analyze_release" }
    }
  }'
```

### Rate Limits

| Type            | Limit                        |
| --------------- | ---------------------------- |
| Unauthenticated | 60 requests/min per IP       |
| Authenticated   | 120 requests/min per API key |

---

## MCP Integration (Not Yet Implemented)

Newsworthy does not currently expose an MCP server, but the A2A skills map naturally to MCP tools. Here's what an MCP integration would look like:

### Conceptual MCP Tool Mapping

Each A2A skill would become an MCP tool:

```json
{
  "tools": [
    {
      "name": "search_releases",
      "description": "Search published press releases",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Search keywords" },
          "category": { "type": "string" },
          "region": { "type": "string" },
          "fromDate": { "type": "string", "format": "date" },
          "limit": { "type": "number", "default": 10 }
        },
        "required": ["query"]
      }
    },
    {
      "name": "get_release",
      "description": "Get full press release content by UUID",
      "inputSchema": {
        "type": "object",
        "properties": {
          "uuid": { "type": "string" }
        },
        "required": ["uuid"]
      }
    },
    {
      "name": "create_release",
      "description": "Create a new press release draft",
      "inputSchema": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "abstract": { "type": "string" },
          "body": { "type": "string", "description": "HTML content" }
        },
        "required": ["title", "abstract", "body"]
      }
    }
  ]
}
```

### How A2A and MCP Relate

```
┌─────────────┐    MCP     ┌──────────────┐    A2A     ┌─────────────┐
│  Claude /    │ ────────── │  Your Agent  │ ────────── │ Newsworthy  │
│  LLM        │  (tools)   │  (client)    │  (tasks)   │  (server)   │
└─────────────┘            └──────────────┘            └─────────────┘
```

- **MCP** connects an LLM to your agent (gives the model tools to call)
- **A2A** connects your agent to Newsworthy (agent-to-agent task execution)

You can build an MCP server that wraps Newsworthy's A2A endpoint, giving any MCP-compatible LLM (Claude, etc.) direct access to press release management.

### Using the TypeScript A2A Client

Newsworthy includes a built-in client at `apps/dashboard/src/lib/a2a/client.ts`:

```typescript
import { A2AClient } from '@/lib/a2a/client';

const client = new A2AClient('https://www.newsworthy.ai/api/a2a');

// Discover capabilities
const agentCard = await client.discoverAgent('https://www.newsworthy.ai');

// Search releases
const result = await client.sendMessage({
  message: {
    role: 'user',
    parts: [{ type: 'text', text: 'Search for technology releases' }]
  },
  metadata: { skillId: 'search_releases' }
});

// Authenticated: create a release
const result = await client.sendMessage(
  {
    message: {
      role: 'user',
      parts: [{
        type: 'data',
        data: { title: 'My Release', abstract: '...', body: '<p>...</p>' }
      }]
    },
    metadata: { skillId: 'create_release' }
  },
  'nw_a2a_your_key_here'
);
```

---

## Key Files

| File                                                          | Purpose                          |
| ------------------------------------------------------------- | -------------------------------- |
| `apps/dashboard/src/app/.well-known/agent-card.json/route.ts` | Agent Card endpoint              |
| `apps/dashboard/src/app/api/a2a/route.ts`                     | Main A2A JSON-RPC handler        |
| `apps/dashboard/src/lib/a2a/auth.ts`                          | API key authentication           |
| `apps/dashboard/src/lib/a2a/types.ts`                         | TypeScript type definitions      |
| `apps/dashboard/src/lib/a2a/client.ts`                        | A2A client library               |
| `apps/dashboard/src/lib/a2a/rate-limit.ts`                    | Rate limiting                    |
| `apps/dashboard/src/lib/a2a/task-manager.ts`                  | Task state management            |
| `apps/dashboard/src/lib/a2a/skills/*.ts`                      | Skill implementations (12 files) |
| `apps/dashboard/src/app/api/a2a/keys/route.ts`                | API key CRUD                     |
| `apps/dashboard/src/app/(dashboard)/settings/api-keys/`       | API key management UI            |
| `apps/dashboard/src/app/(dashboard)/admin/a2a/`               | Admin dashboard & tester         |
| `packages/db/src/schema/a2a-api-keys.ts`                      | Database schema for API keys     |

## Further Reading

- [A2A Protocol Spec](https://a2a-protocol.org/latest/specification/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Newsworthy A2A Technical Docs](./a2a.md)
