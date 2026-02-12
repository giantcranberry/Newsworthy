'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'

export function NoCreditsBanner() {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-800">
          <CreditCard className="h-5 w-5" />
          Press Release Credits Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-700">
          You need press release credits to create and distribute a press release.
          Purchase credits to get started.
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Single Press Release</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Purchase a single credit for one press release distribution.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Credit Bundle</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Save money with a bundle of credits for multiple releases.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button asChild>
            <Link href="/pricing">
              <CreditCard className="h-4 w-4 mr-2" />
              Purchase Credits
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              Back to Dashboard
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
