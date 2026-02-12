'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Info,
  Upload,
  UserPlus,
  Loader2,
  Send,
  Users,
  ArrowRight,
  Newspaper,
} from 'lucide-react'

interface PitchListFormProps {
  companyUuid: string
  companyName: string
  totalContacts: number
}

const emptyContactForm = {
  firstName: '',
  lastName: '',
  email: '',
  tld: '',
  publication: '',
  phone: '',
  notes: '',
}

export function PitchListForm({
  companyUuid,
  companyName,
  totalContacts,
}: PitchListFormProps) {
  const router = useRouter()
  const [emails, setEmails] = useState('')
  const [isBulkAdding, setIsBulkAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Add single contact
  const [showAddModal, setShowAddModal] = useState(false)
  const [contactForm, setContactForm] = useState(emptyContactForm)
  const [isSavingContact, setIsSavingContact] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)

  const handleBulkImport = async () => {
    if (!emails.trim()) {
      setError('Please enter at least one email address')
      return
    }

    setIsBulkAdding(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/pitchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to import contacts')
      }

      const data = await response.json()
      setSuccess(
        `Added ${data.added} contact${data.added !== 1 ? 's' : ''}${data.skipped ? ` (${data.skipped} skipped — duplicates or invalid)` : ''}.`
      )
      setEmails('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import contacts')
    } finally {
      setIsBulkAdding(false)
    }
  }

  const handleAddContact = async () => {
    setIsSavingContact(true)
    setContactError(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/pitchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', ...contactForm }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add contact')
      }

      setShowAddModal(false)
      setContactForm(emptyContactForm)
      setSuccess('Contact added successfully.')
      router.refresh()
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Failed to add contact')
    } finally {
      setIsSavingContact(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{success}</div>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader className="bg-gray-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-500" />
            About Media Pitch Lists
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <p className="text-gray-700">
            Build and manage your media contact list for targeted press release distribution and media outreach.
          </p>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">How it works:</h4>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              <li>Add media contacts individually or import in bulk</li>
              <li>Include publication domain and name for better organization</li>
              <li>Use your pitch list when distributing press releases</li>
              <li>Track email opens, bounces, and unsubscribes</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Add Contacts Section */}
      <Card>
        <CardHeader className="bg-blue-50 border-b rounded-t-lg">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import Media Contacts
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-3">
                Add multiple contacts at once by entering one email per line. You can optionally include first and last names.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Format Options:</h4>
                  <ul className="text-xs text-gray-500 space-y-0.5">
                    <li><code className="bg-gray-100 px-1 rounded">email@example.com</code></li>
                    <li><code className="bg-gray-100 px-1 rounded">email@example.com,FirstName</code></li>
                    <li><code className="bg-gray-100 px-1 rounded">email@example.com,FirstName,LastName</code></li>
                  </ul>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-800 font-semibold">Limits:</p>
                  <ul className="text-xs text-amber-700 list-disc list-inside">
                    <li>Maximum 50 contacts at a time</li>
                    <li>One email address per line</li>
                    <li>Duplicates are automatically skipped</li>
                  </ul>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setContactError(null)
                setContactForm(emptyContactForm)
                setShowAddModal(true)
              }}
              className="shrink-0"
            >
              <UserPlus className="h-4 w-4" />
              Add Single Contact
            </Button>
          </div>

          <div>
            <Label htmlFor="emails" className="font-semibold">Enter Email Addresses</Label>
            <Textarea
              id="emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              rows={6}
              className="mt-1 font-mono text-sm"
              placeholder={"email@example.com,FirstName,LastName\nanother@example.com,John,Doe"}
            />
            <p className="text-xs text-gray-400 mt-1">
              One email per line. First and last names are optional.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleBulkImport} disabled={isBulkAdding || !emails.trim()}>
              {isBulkAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Import Contacts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manage Contacts */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Newspaper className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">
                  {totalContacts} Contact{totalContacts !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-gray-500">
                  View, search, and manage your media pitch contacts
                </p>
              </div>
            </div>
            <Link href={`/company/${companyUuid}/pitchlist/manage`}>
              <Button variant="outline">
                Manage Contacts
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Add Single Contact Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Media Contact</DialogTitle>
            <DialogDescription>
              Add a single media contact to your pitch list.
            </DialogDescription>
          </DialogHeader>

          {contactError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{contactError}</div>
          )}

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add-firstName">First Name *</Label>
                <Input
                  id="add-firstName"
                  value={contactForm.firstName}
                  onChange={(e) => setContactForm(f => ({ ...f, firstName: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="add-lastName">Last Name *</Label>
                <Input
                  id="add-lastName"
                  value={contactForm.lastName}
                  onChange={(e) => setContactForm(f => ({ ...f, lastName: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="add-email">Email *</Label>
              <Input
                id="add-email"
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm(f => ({ ...f, email: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add-tld">Publication Domain *</Label>
                <Input
                  id="add-tld"
                  value={contactForm.tld}
                  onChange={(e) => setContactForm(f => ({ ...f, tld: e.target.value }))}
                  placeholder="e.g. techcrunch.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="add-publication">Publication Name</Label>
                <Input
                  id="add-publication"
                  value={contactForm.publication}
                  onChange={(e) => setContactForm(f => ({ ...f, publication: e.target.value }))}
                  placeholder="e.g. TechCrunch"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="add-phone">Phone</Label>
              <Input
                id="add-phone"
                value={contactForm.phone}
                onChange={(e) => setContactForm(f => ({ ...f, phone: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="add-notes">Internal Notes</Label>
              <Textarea
                id="add-notes"
                value={contactForm.notes}
                onChange={(e) => setContactForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddContact} disabled={isSavingContact}>
              {isSavingContact ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
