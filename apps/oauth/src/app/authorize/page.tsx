import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getClient, validateRedirectUri } from '@/lib/oauth/clients'
import { validateScopes, parseScopes } from '@/lib/oauth/scopes'
import { isValidCodeChallenge } from '@/lib/oauth/pkce'
import { generateAuthorizationCode } from '@/lib/oauth/codes'

interface AuthorizePageProps {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function AuthorizePage({ searchParams }: AuthorizePageProps) {
  const params = await searchParams
  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: responseType,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  } = params

  // Validate required parameters (show error on our page — never redirect to unvalidated URIs)
  if (!clientId) {
    return <ErrorPage message="Missing required parameter: client_id" />
  }

  if (!redirectUri) {
    return <ErrorPage message="Missing required parameter: redirect_uri" />
  }

  if (responseType !== 'code') {
    return <ErrorPage message="Invalid response_type. Only 'code' is supported." />
  }

  if (!state) {
    return <ErrorPage message="Missing required parameter: state" />
  }

  if (!codeChallenge || !codeChallengeMethod) {
    return <ErrorPage message="PKCE is required. Missing code_challenge or code_challenge_method." />
  }

  if (codeChallengeMethod !== 'S256') {
    return <ErrorPage message="Only S256 code_challenge_method is supported." />
  }

  if (!isValidCodeChallenge(codeChallenge)) {
    return <ErrorPage message="Invalid code_challenge format." />
  }

  // Validate client
  const client = await getClient(clientId)
  if (!client) {
    return <ErrorPage message="Unknown or inactive client." />
  }

  // Validate redirect_uri (exact match) — MUST validate before any redirect
  if (!validateRedirectUri(client, redirectUri)) {
    return <ErrorPage message="Invalid redirect_uri. It must exactly match a registered URI." />
  }

  // Validate scopes
  const requestedScopes = scope ? parseScopes(scope) : ['openid']
  if (!validateScopes(requestedScopes, client.allowedScopes)) {
    redirectWithError(redirectUri, 'invalid_scope', 'One or more requested scopes are not allowed', state)
  }

  // Check session
  const session = await getSession()
  if (!session) {
    // Build the full authorize URL to redirect back to after login
    const currentUrl = new URL('/authorize', 'http://placeholder')
    Object.entries(params).forEach(([key, value]) => {
      if (value) currentUrl.searchParams.set(key, value)
    })
    const loginUrl = `/login?next=${encodeURIComponent(currentUrl.pathname + currentUrl.search)}`
    redirect(loginUrl)
  }

  // User is logged in — for first-party clients with skip_consent, issue code immediately
  if (client.skipConsent) {
    const code = await generateAuthorizationCode({
      clientId: client.clientId,
      userId: session.userId,
      redirectUri,
      scope: requestedScopes.join(' '),
      codeChallenge,
      codeChallengeMethod,
    })

    const callbackUrl = new URL(redirectUri)
    callbackUrl.searchParams.set('code', code)
    callbackUrl.searchParams.set('state', state)
    redirect(callbackUrl.toString())
  }

  // For clients that require consent (not implemented for first-party only)
  // This would show a consent screen
  return <ErrorPage message="Consent flow not implemented for this client." />
}

function redirectWithError(redirectUri: string, error: string, description: string, state: string): never {
  const url = new URL(redirectUri)
  url.searchParams.set('error', error)
  url.searchParams.set('error_description', description)
  url.searchParams.set('state', state)
  redirect(url.toString())
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col bg-white sm:bg-gradient-to-br sm:from-slate-50 sm:to-slate-100">
      <div className="flex-1 flex flex-col sm:items-center sm:justify-start px-6 py-8 sm:pt-[60px]">
        <div className="flex justify-center mb-8 sm:mb-6">
          <div className="text-2xl font-bold text-gray-900 tracking-tight">
            newsworthy<span className="text-cyan-700">.ai</span>
          </div>
        </div>
        <div className="w-full sm:max-w-md sm:bg-white sm:rounded-2xl sm:shadow-xl sm:border sm:border-slate-200 sm:p-8">
          <div className="text-center">
            <div className="mb-4 text-red-600">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Authorization Error</h2>
            <p className="text-sm text-gray-600">{message}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
