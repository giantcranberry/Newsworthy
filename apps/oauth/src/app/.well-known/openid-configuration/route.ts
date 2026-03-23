import { NextRequest } from 'next/server'

function getIssuer(request: NextRequest): string {
  // In production, use the configured issuer. In dev, derive from request.
  if (process.env.OAUTH_ISSUER) return process.env.OAUTH_ISSUER

  const host = request.headers.get('host') || 'localhost:3002'
  const proto = request.headers.get('x-forwarded-proto') || 'http'
  return `${proto}://${host}`
}

export async function GET(request: NextRequest) {
  const issuer = getIssuer(request)

  const config = {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/api/token`,
    userinfo_endpoint: `${issuer}/api/userinfo`,
    revocation_endpoint: `${issuer}/api/revoke`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['none'],
    scopes_supported: ['openid', 'profile', 'email', 'company', 'roles'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    claims_supported: [
      'sub',
      'name',
      'given_name',
      'family_name',
      'picture',
      'email',
      'email_verified',
      'companies',
      'is_admin',
      'is_editor',
      'is_staff',
    ],
  }

  return Response.json(config, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
