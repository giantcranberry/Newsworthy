import { NextRequest } from 'next/server'
import { revokeToken } from '@/lib/oauth/tokens'

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type')
  if (!contentType?.includes('application/x-www-form-urlencoded')) {
    // Per RFC 7009, always return 200 even on errors
    return new Response(null, { status: 200 })
  }

  const body = await request.formData()
  const token = body.get('token') as string | null

  if (!token) {
    return new Response(null, { status: 200 })
  }

  try {
    await revokeToken(token)
  } catch {
    // Per RFC 7009, always return 200
  }

  return new Response(null, { status: 200 })
}
