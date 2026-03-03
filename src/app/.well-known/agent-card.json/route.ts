import { NextResponse } from 'next/server'
import type { AgentCard } from '@/lib/a2a/types'

const agentCard: AgentCard & { authentication?: Record<string, unknown> } = {
  name: 'Newsworthy',
  description: 'Press release distribution platform. Search, read, and analyze published press releases. Authenticated agents can create and manage brands and releases.',
  url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://newsworthy.ai'}/api/a2a`,
  version: '1.1.0',
  capabilities: {
    streaming: true,
    pushNotifications: false,
  },
  authentication: {
    schemes: ['bearer'],
    instructions: 'Create API keys at /settings/api-keys. Pass as Authorization: Bearer nw_a2a_...',
  },
  defaultInputModes: ['text/plain', 'application/json'],
  defaultOutputModes: ['text/plain', 'application/json'],
  skills: [
    // Public skills (no auth required)
    {
      id: 'search_releases',
      name: 'Search Press Releases',
      description: 'Search published press releases by keyword, category, region, or date range',
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['application/json'],
    },
    {
      id: 'search_brands',
      name: 'Search Brands',
      description: 'Search brands/companies with published press releases and their recent releases. No contact information is exposed.',
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['application/json'],
    },
    {
      id: 'get_release',
      name: 'Get Press Release',
      description: 'Retrieve the full content of a specific press release by UUID or slug',
      inputModes: ['text/plain'],
      outputModes: ['application/json'],
    },
    {
      id: 'analyze_release',
      name: 'Analyze Press Release',
      description: 'Analyze a press release for readability, SEO quality, and key entities',
      inputModes: ['text/plain'],
      outputModes: ['application/json'],
    },
    // Authenticated skills (Bearer token required)
    {
      id: 'create_brand',
      name: 'Create Brand',
      description: 'Create a new brand/company (requires authentication)',
      inputModes: ['application/json'],
      outputModes: ['application/json'],
    },
    {
      id: 'update_brand',
      name: 'Update Brand',
      description: 'Update the brand associated with the API key (requires authentication)',
      inputModes: ['application/json'],
      outputModes: ['application/json'],
    },
    {
      id: 'list_brands',
      name: 'List My Brands',
      description: 'List all brands the authenticated user has access to (requires authentication)',
      inputModes: ['text/plain'],
      outputModes: ['application/json'],
    },
    {
      id: 'create_release',
      name: 'Create Release',
      description: 'Create a new press release draft (requires authentication, consumes 1 credit)',
      inputModes: ['application/json'],
      outputModes: ['application/json'],
    },
    {
      id: 'update_release',
      name: 'Update Release',
      description: 'Update a draft press release (requires authentication)',
      inputModes: ['application/json'],
      outputModes: ['application/json'],
    },
    {
      id: 'delete_release',
      name: 'Delete Release',
      description: 'Soft-delete a press release and reallocate credits (requires authentication)',
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['application/json'],
    },
    {
      id: 'submit_release',
      name: 'Submit Release',
      description: 'Submit a press release for editorial review (requires authentication)',
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['application/json'],
    },
    {
      id: 'list_releases',
      name: 'List My Releases',
      description: 'List releases for the API key\'s brand with optional status filter (requires authentication)',
      inputModes: ['text/plain', 'application/json'],
      outputModes: ['application/json'],
    },
  ],
}

export async function GET() {
  return NextResponse.json(agentCard, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
