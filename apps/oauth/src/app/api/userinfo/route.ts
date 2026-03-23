import { NextRequest } from 'next/server'
import { validateAccessToken } from '@/lib/oauth/tokens'
import { buildClaims, parseScopes } from '@/lib/oauth/scopes'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json(
      { error: 'invalid_token', error_description: 'Missing or invalid Bearer token' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
    )
  }

  const token = authHeader.slice(7)
  const accessToken = await validateAccessToken(token)

  if (!accessToken) {
    return Response.json(
      { error: 'invalid_token', error_description: 'Token is expired or revoked' },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer error="invalid_token"' } }
    )
  }

  const scopes = parseScopes(accessToken.scope)
  const claims = await buildClaims(accessToken.userId, scopes)

  return Response.json(claims)
}
