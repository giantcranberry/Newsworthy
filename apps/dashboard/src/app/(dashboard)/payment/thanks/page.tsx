import { redirect } from 'next/navigation'
import { getEffectiveSession } from '@/lib/auth'
import { ThanksContent } from './thanks-content'

export default async function ThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ cart?: string }>
}) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) redirect('/login')

  const params = await searchParams
  const cartUuid = params.cart || null
  const userEmail = session.user.email || ''

  return <ThanksContent cartUuid={cartUuid} userEmail={userEmail} />
}
