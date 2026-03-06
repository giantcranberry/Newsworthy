import Link from 'next/link'
import { UserPlus } from 'lucide-react'

export function RegisterCTA({ action = 'post' }: { action?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
      <UserPlus className="mx-auto h-8 w-8 text-gray-400 mb-2" />
      <p className="text-sm text-gray-600 mb-3">
        Want to {action}? Join the Newsworthy community &mdash; it&apos;s free.
      </p>
      <Link
        href="https://newsworthy.ai/auth/register"
        className="inline-flex items-center gap-2 rounded-md bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800 transition-colors"
      >
        <UserPlus className="h-4 w-4" />
        Create a free account
      </Link>
    </div>
  )
}
