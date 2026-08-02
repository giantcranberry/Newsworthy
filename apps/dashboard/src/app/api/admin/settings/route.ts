import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getBoolSetting, setSetting, BOOL_SETTING_DEFAULTS } from '@/lib/app-settings'

export async function GET() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings: Record<string, boolean> = {}
  for (const [key, def] of Object.entries(BOOL_SETTING_DEFAULTS)) {
    settings[key] = await getBoolSetting(key, def)
  }
  return NextResponse.json(settings)
}

export async function PUT(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const userId = parseInt((session?.user as any)?.id || '0')
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { key, value } = await request.json()

  // Only known settings may be written, and only as booleans
  if (!(key in BOOL_SETTING_DEFAULTS) || typeof value !== 'boolean') {
    return NextResponse.json({ error: 'Invalid setting' }, { status: 400 })
  }

  await setSetting(key, value ? 'true' : 'false', userId || undefined)
  return NextResponse.json({ success: true, [key]: value })
}
