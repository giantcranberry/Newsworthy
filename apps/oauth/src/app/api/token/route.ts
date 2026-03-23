import { NextRequest } from 'next/server'
import { oauthErrorResponse } from '@/lib/oauth/errors'
import { getClient, authenticateClient, validateRedirectUri } from '@/lib/oauth/clients'
import { consumeAuthorizationCode } from '@/lib/oauth/codes'
import { issueTokenPair, rotateRefreshToken } from '@/lib/oauth/tokens'
import { verifyCodeChallenge, isValidCodeVerifier } from '@/lib/oauth/pkce'

// In-memory rate limiter: max 20 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) return false

  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(ip)) {
    return oauthErrorResponse({
      error: 'invalid_request',
      description: 'Too many requests. Please try again later.',
      status: 429,
    })
  }

  const contentType = request.headers.get('content-type')
  if (!contentType?.includes('application/x-www-form-urlencoded')) {
    return oauthErrorResponse({
      error: 'invalid_request',
      description: 'Content-Type must be application/x-www-form-urlencoded',
    })
  }

  const body = await request.formData()
  const grantType = body.get('grant_type') as string | null

  if (grantType === 'authorization_code') {
    return handleAuthorizationCodeGrant(request, body)
  } else if (grantType === 'refresh_token') {
    return handleRefreshTokenGrant(request, body)
  } else {
    return oauthErrorResponse({
      error: 'unsupported_grant_type',
      description: 'Only authorization_code and refresh_token grant types are supported',
    })
  }
}

async function handleAuthorizationCodeGrant(request: NextRequest, body: FormData) {
  const code = body.get('code') as string | null
  const redirectUri = body.get('redirect_uri') as string | null
  const codeVerifier = body.get('code_verifier') as string | null

  if (!code || !redirectUri || !codeVerifier) {
    return oauthErrorResponse({
      error: 'invalid_request',
      description: 'Missing required parameters: code, redirect_uri, code_verifier',
    })
  }

  if (!isValidCodeVerifier(codeVerifier)) {
    return oauthErrorResponse({
      error: 'invalid_request',
      description: 'Invalid code_verifier format',
    })
  }

  // Authenticate client (Basic auth or body params)
  const clientAuth = await extractClientCredentials(request, body)
  if (!clientAuth) {
    return oauthErrorResponse({
      error: 'invalid_client',
      description: 'Client authentication failed',
      status: 401,
    })
  }

  const { clientId, clientSecret } = clientAuth

  // For confidential clients, verify the secret
  const client = clientSecret
    ? await authenticateClient(clientId, clientSecret)
    : await getClient(clientId)

  if (!client) {
    return oauthErrorResponse({
      error: 'invalid_client',
      description: 'Unknown or inactive client',
      status: 401,
    })
  }

  // Confidential clients must provide a secret
  if (client.isConfidential && !clientSecret) {
    return oauthErrorResponse({
      error: 'invalid_client',
      description: 'Confidential clients must authenticate with client_secret',
      status: 401,
    })
  }

  // Consume the authorization code
  const authCode = await consumeAuthorizationCode(code, clientId)
  if (!authCode) {
    return oauthErrorResponse({
      error: 'invalid_grant',
      description: 'Invalid, expired, or already used authorization code',
    })
  }

  // Verify redirect_uri matches
  if (authCode.redirectUri !== redirectUri) {
    return oauthErrorResponse({
      error: 'invalid_grant',
      description: 'redirect_uri does not match the one used in the authorization request',
    })
  }

  // Verify PKCE
  if (!verifyCodeChallenge(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
    return oauthErrorResponse({
      error: 'invalid_grant',
      description: 'PKCE verification failed',
    })
  }

  // Issue tokens
  const tokenPair = await issueTokenPair({
    clientId: authCode.clientId,
    userId: authCode.userId,
    scope: authCode.scope,
  })

  return Response.json({
    access_token: tokenPair.accessToken,
    token_type: 'Bearer',
    expires_in: tokenPair.expiresIn,
    refresh_token: tokenPair.refreshToken,
    scope: tokenPair.scope,
  })
}

async function handleRefreshTokenGrant(request: NextRequest, body: FormData) {
  const refreshToken = body.get('refresh_token') as string | null
  if (!refreshToken) {
    return oauthErrorResponse({
      error: 'invalid_request',
      description: 'Missing required parameter: refresh_token',
    })
  }

  // Authenticate client
  const clientAuth = await extractClientCredentials(request, body)
  if (!clientAuth) {
    return oauthErrorResponse({
      error: 'invalid_client',
      description: 'Client authentication failed',
      status: 401,
    })
  }

  const { clientId, clientSecret } = clientAuth

  // For confidential clients, verify the secret
  if (clientSecret) {
    const client = await authenticateClient(clientId, clientSecret)
    if (!client) {
      return oauthErrorResponse({
        error: 'invalid_client',
        description: 'Client authentication failed',
        status: 401,
      })
    }
  } else {
    const client = await getClient(clientId)
    if (!client) {
      return oauthErrorResponse({
        error: 'invalid_client',
        description: 'Unknown or inactive client',
        status: 401,
      })
    }
    if (client.isConfidential) {
      return oauthErrorResponse({
        error: 'invalid_client',
        description: 'Confidential clients must authenticate with client_secret',
        status: 401,
      })
    }
  }

  // Rotate the refresh token
  const tokenPair = await rotateRefreshToken(refreshToken, clientId)
  if (!tokenPair) {
    return oauthErrorResponse({
      error: 'invalid_grant',
      description: 'Invalid, expired, or revoked refresh token',
    })
  }

  return Response.json({
    access_token: tokenPair.accessToken,
    token_type: 'Bearer',
    expires_in: tokenPair.expiresIn,
    refresh_token: tokenPair.refreshToken,
    scope: tokenPair.scope,
  })
}

/**
 * Extract client credentials from either Basic auth header or body params.
 */
async function extractClientCredentials(
  request: NextRequest,
  body: FormData
): Promise<{ clientId: string; clientSecret: string | null } | null> {
  // Try Basic auth first
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.slice(6))
      const colonIndex = decoded.indexOf(':')
      if (colonIndex === -1) return null
      return {
        clientId: decodeURIComponent(decoded.substring(0, colonIndex)),
        clientSecret: decodeURIComponent(decoded.substring(colonIndex + 1)),
      }
    } catch {
      return null
    }
  }

  // Fall back to body params
  const clientId = body.get('client_id') as string | null
  if (!clientId) return null

  const clientSecret = body.get('client_secret') as string | null
  return { clientId, clientSecret }
}
