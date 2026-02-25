import { db } from '@/db'
import { companyInvites, company } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { AcceptInvite } from './accept-invite'

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const invite = await db.query.companyInvites.findFirst({
    where: and(
      eq(companyInvites.token, token),
      isNull(companyInvites.acceptedAt),
    ),
  })

  if (!invite) {
    notFound()
  }

  const co = await db.query.company.findFirst({
    where: eq(company.id, invite.companyId),
    columns: { companyName: true, uuid: true },
  })

  const isExpired = new Date() > invite.expiresAt

  const roleLabels: Record<string, string> = {
    brand_admin: 'Brand Admin',
    collaborator: 'Collaborator',
    client: 'Client',
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Team Invitation</h1>

          {isExpired ? (
            <div className="mt-4">
              <p className="text-red-600 font-medium">This invitation has expired.</p>
              <p className="text-sm text-gray-500 mt-2">
                Please ask the team owner to send a new invitation.
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-6">
                You&apos;ve been invited to join <strong className="text-gray-900">{co?.companyName}</strong> as a <strong className="text-gray-900">{roleLabels[invite.role] || invite.role}</strong>.
              </p>
              <AcceptInvite token={token} companyUuid={co?.uuid || ''} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
