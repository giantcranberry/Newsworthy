'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Save, Upload, UserPlus, Pencil, Trash2, Users } from 'lucide-react'

interface ContactData {
  uuid: string
  name: string
  title: string
  email: string
  phone: string
}

interface CompanyFormProps {
  initialData?: {
    uuid?: string
    companyName?: string
    website?: string
    logoUrl?: string
    addr1?: string
    addr2?: string
    city?: string
    state?: string
    postalCode?: string
    countryCode?: string
    phone?: string
    email?: string
  }
  contacts?: ContactData[]
}

export function CompanyForm({ initialData, contacts: initialContacts = [] }: CompanyFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Contacts state
  const [contactsList, setContactsList] = useState<ContactData[]>(initialContacts)
  const [showContactModal, setShowContactModal] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactData | null>(null)
  const [contactForm, setContactForm] = useState({ name: '', title: '', email: '', phone: '' })
  const [isSavingContact, setIsSavingContact] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const [showDeleteContactModal, setShowDeleteContactModal] = useState(false)
  const [deletingContact, setDeletingContact] = useState<ContactData | null>(null)
  const [isDeletingContact, setIsDeletingContact] = useState(false)
  const [deleteContactError, setDeleteContactError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    companyName: initialData?.companyName || '',
    website: initialData?.website || '',
    logoUrl: initialData?.logoUrl || '',
    addr1: initialData?.addr1 || '',
    addr2: initialData?.addr2 || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    postalCode: initialData?.postalCode || '',
    countryCode: initialData?.countryCode || 'US',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/company', {
        method: initialData?.uuid ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          uuid: initialData?.uuid,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        router.push(`/company/${data.uuid}`)
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to save brand')
      }
    } catch (error) {
      console.error('Error saving brand:', error)
      alert('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Logo must be under 5MB')
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setLogoError('Only JPEG, PNG, WebP, and SVG files are supported')
      return
    }

    if (!initialData?.uuid) {
      setLogoError('Please save the brand first before uploading a logo')
      return
    }

    setLogoError(null)
    setIsUploadingLogo(true)

    try {
      const fd = new FormData()
      fd.append('logo', file)
      fd.append('companyUuid', initialData.uuid)

      const response = await fetch('/api/company/logo', {
        method: 'POST',
        body: fd,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload logo')
      }

      const data = await response.json()
      setFormData((prev) => ({ ...prev, logoUrl: data.logoUrl }))
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const openAddContact = () => {
    setEditingContact(null)
    setContactForm({ name: '', title: '', email: '', phone: '' })
    setContactError(null)
    setShowContactModal(true)
  }

  const openEditContact = (c: ContactData) => {
    setEditingContact(c)
    setContactForm({ name: c.name, title: c.title, email: c.email, phone: c.phone })
    setContactError(null)
    setShowContactModal(true)
  }

  const handleSaveContact = async () => {
    if (!initialData?.uuid) return
    setIsSavingContact(true)
    setContactError(null)

    try {
      const isEdit = !!editingContact
      const response = await fetch(`/api/company/${initialData.uuid}/contacts`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEdit ? { contactUuid: editingContact.uuid } : {}),
          name: contactForm.name,
          title: contactForm.title,
          email: contactForm.email,
          phone: contactForm.phone,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save contact')
      }

      setShowContactModal(false)
      router.refresh()

      if (isEdit) {
        setContactsList((prev) =>
          prev.map((c) =>
            c.uuid === editingContact.uuid
              ? { ...c, name: contactForm.name, title: contactForm.title, email: contactForm.email, phone: contactForm.phone }
              : c
          )
        )
      } else {
        const newContact = await response.json()
        setContactsList((prev) => [...prev, {
          uuid: newContact.uuid,
          name: newContact.name,
          title: newContact.title || '',
          email: newContact.email || '',
          phone: newContact.phone || '',
        }])
      }
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Failed to save contact')
    } finally {
      setIsSavingContact(false)
    }
  }

  const handleDeleteContact = async () => {
    if (!initialData?.uuid || !deletingContact) return
    setIsDeletingContact(true)
    setDeleteContactError(null)

    try {
      const response = await fetch(`/api/company/${initialData.uuid}/contacts`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactUuid: deletingContact.uuid }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove contact')
      }

      setShowDeleteContactModal(false)
      setDeletingContact(null)
      setContactsList((prev) => prev.filter((c) => c.uuid !== deletingContact.uuid))
      router.refresh()
    } catch (err) {
      setDeleteContactError(err instanceof Error ? err.message : 'Failed to remove contact')
    } finally {
      setIsDeletingContact(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="Your company name"
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://example.com"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Logo</Label>
            <div className="mt-1 flex items-center gap-4">
              {formData.logoUrl ? (
                <img
                  src={formData.logoUrl}
                  alt="Logo preview"
                  className="h-16 w-16 object-contain rounded"
                />
              ) : (
                <div className="h-16 w-16 rounded border border-dashed flex items-center justify-center text-gray-400">
                  No logo
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => logoInputRef.current?.click()}
                disabled={isUploadingLogo}
              >
                {isUploadingLogo ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {formData.logoUrl ? 'Replace Logo' : 'Upload Logo'}
                  </>
                )}
              </Button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoSelect}
              />
            </div>
            {logoError && (
              <p className="text-sm text-red-600 mt-1">{logoError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Brand Contacts */}
      {initialData?.uuid && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-400" />
                Media Contacts
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={openAddContact}>
                <UserPlus className="h-4 w-4" />
                Add Contact
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {contactsList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-4 font-medium text-gray-500">Name</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500">Title</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500">Email</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500">Phone</th>
                      <th className="pb-2 font-medium text-gray-500 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactsList.map((c) => (
                      <tr key={c.uuid} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium text-gray-900">{c.name}</td>
                        <td className="py-2 pr-4 text-gray-600">{c.title || '—'}</td>
                        <td className="py-2 pr-4 text-gray-600">{c.email || '—'}</td>
                        <td className="py-2 pr-4 text-gray-600">{c.phone || '—'}</td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditContact(c)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit contact"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDeletingContact(c); setDeleteContactError(null); setShowDeleteContactModal(true) }}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Remove contact"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                No contacts yet. Add contacts that appear on your press releases.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
            <DialogDescription>
              {editingContact ? 'Update this contact\'s details.' : 'Add a new contact for this brand.'}
            </DialogDescription>
          </DialogHeader>

          {contactError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{contactError}</div>
          )}

          <div className="grid gap-4 py-2">
            <div>
              <Label htmlFor="contact-name">Name *</Label>
              <Input
                id="contact-name"
                value={contactForm.name}
                onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact-title">Title</Label>
              <Input
                id="contact-title"
                value={contactForm.title}
                onChange={(e) => setContactForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. VP of Communications"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                value={contactForm.phone}
                onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowContactModal(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveContact} disabled={isSavingContact || !contactForm.name.trim()}>
              {isSavingContact ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingContact ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {editingContact ? 'Save Changes' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Contact Modal */}
      <Dialog open={showDeleteContactModal} onOpenChange={setShowDeleteContactModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this contact?
            </DialogDescription>
          </DialogHeader>

          {deleteContactError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{deleteContactError}</div>
          )}

          {deletingContact && (
            <div className="py-2">
              <p className="text-sm font-medium text-gray-900">{deletingContact.name}</p>
              {deletingContact.email && <p className="text-sm text-gray-500">{deletingContact.email}</p>}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDeleteContactModal(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteContact} disabled={isDeletingContact}>
              {isDeletingContact ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remove Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              placeholder="123 Main Street"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="addr2">Address Line 2</Label>
            <Input
              id="addr2"
              value={formData.addr2}
              onChange={(e) => setFormData({ ...formData, addr2: e.target.value })}
              placeholder="Suite 100"
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
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading || !formData.companyName} className="gap-2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {initialData?.uuid ? 'Save Changes' : 'Create Brand'}
        </Button>
      </div>
    </form>
  )
}
