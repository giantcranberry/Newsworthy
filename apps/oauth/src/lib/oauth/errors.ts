import { NextResponse } from 'next/server'

export type OAuthErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'invalid_scope'
  | 'access_denied'
  | 'server_error'
  | 'unsupported_response_type'

interface OAuthErrorParams {
  error: OAuthErrorCode
  description: string
  status?: number
}

export function oauthErrorResponse({ error, description, status = 400 }: OAuthErrorParams) {
  return NextResponse.json(
    { error, error_description: description },
    { status }
  )
}

/**
 * Build a redirect URL with error parameters.
 * Used when redirect_uri is validated and we can safely redirect.
 */
export function oauthErrorRedirect(
  redirectUri: string,
  error: OAuthErrorCode,
  description: string,
  state?: string
): string {
  const url = new URL(redirectUri)
  url.searchParams.set('error', error)
  url.searchParams.set('error_description', description)
  if (state) url.searchParams.set('state', state)
  return url.toString()
}
