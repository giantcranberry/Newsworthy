'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Save } from 'lucide-react'

interface GuidelinesEditorProps {
  initialBody: string
}

export function GuidelinesEditor({ initialBody }: GuidelinesEditorProps) {
  const [body, setBody] = useState(initialBody)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    try {
      const res = await fetch('/api/admin/community/guidelines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })

      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      // Silent fail
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your community guidelines in Markdown..."
        rows={20}
        className="font-mono text-sm"
      />

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Guidelines'}
        </Button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved successfully</span>}
      </div>
    </div>
  )
}
