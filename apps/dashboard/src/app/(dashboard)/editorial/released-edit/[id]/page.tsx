import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ReleasedEditPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()

  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    redirect('/dashboard')
  }

  // Reuse the editorial edit page which handles all statuses
  redirect(`/editorial/edit/${id}`)
}
