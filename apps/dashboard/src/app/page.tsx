import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

export default async function Home() {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const userId = session.user.id ? Number(session.user.id) : NaN
  if (Number.isFinite(userId)) {
    const [row] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (row?.isAdmin) redirect('/admin')
  } else if ((session.user as any)?.isAdmin) {
    redirect('/admin')
  }

  redirect('/dashboard')
}
