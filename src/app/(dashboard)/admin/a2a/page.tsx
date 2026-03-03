import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bot, Zap, Search, FileText, BarChart3, Building2, Lock, PenLine, Trash2, Send, List } from 'lucide-react'
import { A2ATester } from './a2a-tester'

export default async function A2AAdminPage() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    redirect('/dashboard')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://newsworthy.ai'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">A2A Protocol</h1>
        <p className="text-gray-500">Agent-to-Agent protocol configuration and testing</p>
      </div>

      {/* Agent Card Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Bot className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Newsworthy Agent</CardTitle>
              <CardDescription>Agent Card served at <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{appUrl}/.well-known/agent-card.json</code></CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="font-medium text-sm">Capabilities</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">Streaming</Badge>
                <Badge variant="outline">HTTP</Badge>
                <Badge variant="secondary">Bearer Auth</Badge>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm">Endpoint</span>
              </div>
              <code className="text-xs text-gray-600 break-all">{appUrl}/api/a2a</code>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium text-sm">Rate Limit</span>
              </div>
              <p className="text-sm text-gray-600">60/min (public) &middot; 120/min (authenticated)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Public Skills */}
      <Card>
        <CardHeader>
          <CardTitle>Public Skills</CardTitle>
          <CardDescription>Skills available to any A2A agent without authentication</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Search className="h-4 w-4 text-blue-500" />
                <span className="font-medium">search_releases</span>
              </div>
              <p className="text-sm text-gray-600">Search published press releases by keyword, category, region, or date range</p>
              <div className="mt-2 flex gap-1">
                <Badge variant="outline" className="text-xs">text/plain</Badge>
                <Badge variant="outline" className="text-xs">application/json</Badge>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-orange-500" />
                <span className="font-medium">search_brands</span>
              </div>
              <p className="text-sm text-gray-600">Search brands with published releases and their recent press releases. No contact info exposed.</p>
              <div className="mt-2 flex gap-1">
                <Badge variant="outline" className="text-xs">text/plain</Badge>
                <Badge variant="outline" className="text-xs">application/json</Badge>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-green-500" />
                <span className="font-medium">get_release</span>
              </div>
              <p className="text-sm text-gray-600">Retrieve the full content of a specific press release by UUID or slug</p>
              <div className="mt-2 flex gap-1">
                <Badge variant="outline" className="text-xs">text/plain</Badge>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                <span className="font-medium">analyze_release</span>
              </div>
              <p className="text-sm text-gray-600">Analyze a press release for readability, SEO quality, and key entities</p>
              <div className="mt-2 flex gap-1">
                <Badge variant="outline" className="text-xs">text/plain</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authenticated Skills */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Authenticated Skills</CardTitle>
            <Badge variant="secondary" className="text-xs"><Lock className="h-3 w-3 mr-1" />Bearer Token</Badge>
          </div>
          <CardDescription>Skills requiring an API key. Manage keys at <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/settings/api-keys</code></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: 'create_brand', icon: Building2, desc: 'Create a new brand/company' },
              { id: 'update_brand', icon: PenLine, desc: 'Update the brand associated with the API key' },
              { id: 'list_brands', icon: List, desc: 'List all brands the authenticated user has access to' },
              { id: 'create_release', icon: FileText, desc: 'Create a new press release draft (consumes 1 credit)' },
              { id: 'update_release', icon: PenLine, desc: 'Update a draft press release' },
              { id: 'delete_release', icon: Trash2, desc: 'Soft-delete a release and reallocate credits' },
              { id: 'submit_release', icon: Send, desc: 'Submit a release for editorial review' },
              { id: 'list_releases', icon: List, desc: "List releases for the API key's brand" },
            ].map(skill => (
              <div key={skill.id} className="border border-amber-200 bg-amber-50/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <skill.icon className="h-4 w-4 text-amber-600" />
                  <span className="font-medium">{skill.id}</span>
                </div>
                <p className="text-sm text-gray-600">{skill.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tester */}
      <A2ATester endpoint={`${appUrl}/api/a2a`} />
    </div>
  )
}
