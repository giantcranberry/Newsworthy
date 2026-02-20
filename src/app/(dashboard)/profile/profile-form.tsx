'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save, CreditCard } from 'lucide-react'

interface ProfileFormProps {
  email: string
  initialData: {
    firstName: string
    lastName: string
    company: string
    phone: string
    mobile: string
    addr1: string
    addr2: string
    city: string
    state: string
    postalCode: string
    countryCode: string
  }
  subscription: {
    remainingPr: number
    remainingPluspr: number
    newsdbCredits: number
  }
}

export function ProfileForm({ email, initialData, subscription }: ProfileFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState(initialData)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        router.refresh()
        alert('Profile updated successfully')
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="-mt-6 space-y-8">
      {/* Sticky Action Bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 -mx-6 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">Account Settings</h1>
            <p className="text-sm text-gray-600 mt-0.5">Manage your profile and preferences</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="gap-2 bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Subscription Info */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {subscription.remainingPr}
              </p>
              <p className="text-sm text-gray-600">PR Credits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {subscription.remainingPluspr}
              </p>
              <p className="text-sm text-gray-600">Enhanced Credits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {subscription.newsdbCredits}
              </p>
              <p className="text-sm text-gray-600">NewsDB Credits</p>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/payment/paygo">
              <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900">
                <CreditCard className="h-3.5 w-3.5" />
                Buy More Credits
              </button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={email} disabled className="mt-1 bg-gray-50" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle>Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="addr1">Address Line 1</Label>
            <Input
              id="addr1"
              value={formData.addr1}
              onChange={(e) => setFormData({ ...formData, addr1: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="addr2">Address Line 2</Label>
            <Input
              id="addr2"
              value={formData.addr2}
              onChange={(e) => setFormData({ ...formData, addr2: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                maxLength={2}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="countryCode">Country</Label>
              <select
                id="countryCode"
                value={formData.countryCode}
                onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-cyan-700 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
