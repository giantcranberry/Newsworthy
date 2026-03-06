'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Play, Loader2 } from 'lucide-react'

interface Props {
  endpoint: string
}

export function A2ATester({ endpoint }: Props) {
  const [skill, setSkill] = useState('search_releases')
  const [input, setInput] = useState('')
  const [bearerToken, setBearerToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleTest() {
    if (!input.trim()) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (bearerToken.trim()) {
        headers['Authorization'] = `Bearer ${bearerToken.trim()}`
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'message/send',
          params: {
            message: {
              role: 'user',
              parts: [{ type: 'text', text: input }],
            },
            metadata: { skillId: skill },
          },
          id: crypto.randomUUID(),
        }),
      })

      const data = await response.json()

      if (data.error) {
        setError(`Error ${data.error.code}: ${data.error.message}`)
      } else {
        setResult(data.result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test A2A Endpoint</CardTitle>
        <CardDescription>Send a test message to the local A2A agent</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-1.5 block text-sm">Bearer Token <span className="text-gray-400">(optional, for authenticated skills)</span></Label>
          <Input
            type="password"
            placeholder="nw_a2a_..."
            value={bearerToken}
            onChange={(e) => setBearerToken(e.target.value)}
          />
        </div>

        <div className="flex gap-4">
          <div className="w-48">
            <Label className="mb-1.5 block text-sm">Skill</Label>
            <SelectRoot value={skill} onValueChange={setSkill}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="search_releases">Search Releases</SelectItem>
                <SelectItem value="search_brands">Search Brands</SelectItem>
                <SelectItem value="get_release">Get Release</SelectItem>
                <SelectItem value="analyze_release">Analyze Release</SelectItem>
                <SelectItem value="create_brand">Create Brand *</SelectItem>
                <SelectItem value="update_brand">Update Brand *</SelectItem>
                <SelectItem value="list_brands">List Brands *</SelectItem>
                <SelectItem value="create_release">Create Release *</SelectItem>
                <SelectItem value="update_release">Update Release *</SelectItem>
                <SelectItem value="delete_release">Delete Release *</SelectItem>
                <SelectItem value="submit_release">Submit Release *</SelectItem>
                <SelectItem value="list_releases">List Releases *</SelectItem>
              </SelectContent>
            </SelectRoot>
          </div>
          <div className="flex-1">
            <Label className="mb-1.5 block text-sm">Message</Label>
            <div className="flex gap-2">
              <Input
                placeholder={
                  skill === 'search_releases'
                    ? 'Search for technology press releases'
                    : skill === 'search_brands'
                      ? 'Search for a brand name'
                      : skill === 'get_release'
                        ? 'Enter a release UUID'
                        : 'Enter a release UUID to analyze'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTest()}
              />
              <Button onClick={handleTest} disabled={loading || !input.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={result.status?.state === 'completed' ? 'default' : 'destructive'}>
                {result.status?.state}
              </Badge>
              <span className="text-xs text-gray-500 dark:text-gray-400">Task: {result.id}</span>
            </div>
            <pre className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg overflow-auto max-h-96 text-xs font-mono">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
