import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white sm:bg-gradient-to-br sm:from-slate-50 sm:to-slate-100">
      <div className="flex-1 flex flex-col sm:items-center sm:justify-start px-6 py-8 sm:pt-[30px]">
        {/* Logo */}
        <div className="flex justify-center mb-8 sm:mb-6">
          <div className="text-2xl font-bold text-gray-900 tracking-tight">
            newsworthy<span className="text-cyan-700">.ai</span>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
