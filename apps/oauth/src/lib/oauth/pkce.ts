import { createHash } from 'crypto'

/**
 * Verify a PKCE code verifier against a stored code challenge.
 * Only supports S256 method.
 */
export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): boolean {
  if (method !== 'S256') return false

  const hash = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  return hash === codeChallenge
}

/**
 * Validate that a code_challenge looks correct (base64url, 43-128 chars).
 */
export function isValidCodeChallenge(challenge: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(challenge)
}

/**
 * Validate that a code_verifier looks correct (43-128 chars, unreserved chars).
 */
export function isValidCodeVerifier(verifier: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(verifier)
}
