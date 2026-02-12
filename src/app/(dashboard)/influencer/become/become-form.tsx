'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface BecomeInfluencerFormProps {
  userEmail: string
}

export function BecomeInfluencerForm({ userEmail }: BecomeInfluencerFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    cell: '',
    altemail: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/influencer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/influencer/${data.uuid}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create profile')
      }
    } catch (error) {
      console.error('Error creating influencer profile:', error)
      alert('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Your Profile</CardTitle>
          <CardDescription>Fill in your details to join the marketplace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Display Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="How you want to appear in the marketplace"
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Tell potential clients about your background and expertise"
              className="mt-1 w-full h-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          <div>
            <Label htmlFor="cell">Phone Number</Label>
            <Input
              id="cell"
              type="tel"
              value={formData.cell}
              onChange={(e) => setFormData({ ...formData, cell: e.target.value })}
              placeholder="Your contact number"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="altemail">Alternative Email</Label>
            <Input
              id="altemail"
              type="email"
              value={formData.altemail}
              onChange={(e) => setFormData({ ...formData, altemail: e.target.value })}
              placeholder="Optional alternative email for business inquiries"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Your primary email is: {userEmail}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create Profile
        </Button>
      </div>
    </form>
  )
}
