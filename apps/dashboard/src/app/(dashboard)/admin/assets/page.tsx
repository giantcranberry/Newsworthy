import { auth } from '@/lib/auth'
import { db } from '@/db'
import { nwaiAssets } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AssetsList } from './assets-list'

async function getAssets() {
  const allAssets = await db
    .select()
    .from(nwaiAssets)
    .orderBy(desc(nwaiAssets.createdAt))

  return allAssets
}

export default async function AdminAssetsPage() {
  const session = await auth()

  // Check admin access
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const allAssets = await getAssets()

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Admin
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Assets</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Files stored in object storage under nwai-assets
        </p>
      </div>

      <AssetsList
        assets={allAssets.map((a) => ({
          uuid: a.uuid,
          filename: a.filename,
          url: a.url,
          mimeType: a.mimeType,
          filesize: a.filesize,
          description: a.description,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
