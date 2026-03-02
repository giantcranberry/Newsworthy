import { auth } from '@/lib/auth'
import { db } from '@/db'
import { emailTemplates } from '@/db/schema'
import { asc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { EmailTemplatesList } from './email-templates-list'

export default async function AdminEmailTemplatesPage() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    redirect('/dashboard')
  }

  const templates = await db
    .select()
    .from(emailTemplates)
    .orderBy(asc(emailTemplates.name))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Email Templates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Edit the HTML templates used for system transactional emails.
        </p>
      </div>

      <EmailTemplatesList templates={templates} />
    </div>
  )
}
