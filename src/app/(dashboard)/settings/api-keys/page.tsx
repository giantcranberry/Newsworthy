import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { a2aApiKeys, company } from '@/db/schema'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { ApiKeysClient } from './api-keys-client'

export default async function ApiKeysPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const userId = parseInt(session.user.id)

  // Fetch user's API keys
  const keys = await db
    .select({
      uuid: a2aApiKeys.uuid,
      name: a2aApiKeys.name,
      keyPrefix: a2aApiKeys.keyPrefix,
      companyName: company.companyName,
      companyUuid: company.uuid,
      isActive: a2aApiKeys.isActive,
      lastUsedAt: a2aApiKeys.lastUsedAt,
      expiresAt: a2aApiKeys.expiresAt,
      createdAt: a2aApiKeys.createdAt,
    })
    .from(a2aApiKeys)
    .innerJoin(company, eq(a2aApiKeys.companyId, company.id))
    .where(eq(a2aApiKeys.userId, userId))
    .orderBy(a2aApiKeys.createdAt)

  // Fetch user's accessible companies for the create dialog
  const companyIds = await getUserCompanyIds(userId, 'collaborator')

  const accessibleCompanies = companyIds.length > 0
    ? await db
        .select({
          uuid: company.uuid,
          companyName: company.companyName,
        })
        .from(company)
        .where(
          and(
            eq(company.isDeleted, false),
            inArray(company.id, companyIds),
          )
        )
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Agent API Keys</h1>
        <p className="text-gray-500 mt-1">
          A2A (Agent-to-Agent) lets AI tools and automations work with your Newsworthy account directly — creating press releases, managing brands, and submitting content for review, all without logging into the dashboard. Create an API key below to give an external AI agent secure access to act on behalf of one of your brands.
        </p>
      </div>

      <ApiKeysClient
        initialKeys={keys.map(k => ({
          ...k,
          lastUsedAt: k.lastUsedAt?.toISOString() || null,
          expiresAt: k.expiresAt?.toISOString() || null,
          createdAt: k.createdAt?.toISOString() || null,
        }))}
        companies={accessibleCompanies}
      />
    </div>
  )
}
