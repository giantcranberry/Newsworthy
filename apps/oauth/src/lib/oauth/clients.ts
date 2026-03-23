import { db } from '@/db'
import { oauthClients } from '@nwai/db/src/schema'
import { eq, and } from 'drizzle-orm'
import { compare } from 'bcryptjs'

export interface ValidatedClient {
  id: number
  clientId: string
  name: string
  redirectUris: string[]
  allowedScopes: string[]
  isConfidential: boolean
  skipConsent: boolean
}

/**
 * Look up and validate an OAuth client by client_id.
 * Returns null if the client doesn't exist or is inactive.
 */
export async function getClient(clientId: string): Promise<ValidatedClient | null> {
  const client = await db.query.oauthClients.findFirst({
    where: and(
      eq(oauthClients.clientId, clientId),
      eq(oauthClients.isActive, true),
    ),
  })

  if (!client) return null

  return {
    id: client.id,
    clientId: client.clientId,
    name: client.name,
    redirectUris: client.redirectUris,
    allowedScopes: client.allowedScopes,
    isConfidential: client.isConfidential,
    skipConsent: client.skipConsent,
  }
}

/**
 * Validate that a redirect_uri is registered for the client (exact match).
 */
export function validateRedirectUri(client: ValidatedClient, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri)
}

/**
 * Authenticate a confidential client using client_secret.
 * Supports both Basic auth header and body params.
 */
export async function authenticateClient(
  clientId: string,
  clientSecret: string
): Promise<ValidatedClient | null> {
  const client = await db.query.oauthClients.findFirst({
    where: and(
      eq(oauthClients.clientId, clientId),
      eq(oauthClients.isActive, true),
    ),
  })

  if (!client || !client.clientSecretHash) return null

  const valid = await compare(clientSecret, client.clientSecretHash)
  if (!valid) return null

  return {
    id: client.id,
    clientId: client.clientId,
    name: client.name,
    redirectUris: client.redirectUris,
    allowedScopes: client.allowedScopes,
    isConfidential: client.isConfidential,
    skipConsent: client.skipConsent,
  }
}
