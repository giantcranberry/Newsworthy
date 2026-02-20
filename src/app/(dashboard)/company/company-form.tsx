'use client'

import { useState, useRef, useCallback } from 'react'
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
import { Loader2, Save, Upload, UserPlus, Pencil, Trash2, Users, X } from 'lucide-react'

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
  pageTitle?: string
  pageDescription?: string
  headerExtra?: React.ReactNode
}

export function CompanyForm({ initialData, contacts: initialContacts = [], pageTitle, pageDescription, headerExtra }: CompanyFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

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

  const handleLogoFile = useCallback(async (file: File) => {
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
  }, [initialData?.uuid])

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    handleLogoFile(file)
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleLogoFile(file)
    }
  }, [handleLogoFile])

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, logoUrl: '' }))
    setLogoError(null)
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

  const title = pageTitle || (initialData?.uuid ? 'Edit Brand' : 'Add Brand')
  const description = pageDescription || (initialData?.uuid ? formData.companyName : 'Create a new brand profile for your press releases')

  return (
    <form onSubmit={handleSubmit} className="-mt-6 space-y-8">
      {/* Sticky Action Bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 -mx-6 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">{title}</h1>
            {description && (
              <p className="text-sm text-gray-600 mt-0.5">{description}</p>
            )}
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
              disabled={isLoading || !formData.companyName}
              className="gap-2 bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {initialData?.uuid ? 'Save Changes' : 'Create Brand'}
            </Button>
          </div>
        </div>
      </div>

      {headerExtra}

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
            <label
              className="relative mt-1 block cursor-pointer group"
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoSelect}
                disabled={isUploadingLogo}
              />
              <div
                className={`relative h-32 rounded-xl border-2 border-dashed transition-all ${
                  isDragging
                    ? 'border-cyan-700 bg-gray-50 scale-[1.02]'
                    : 'border-gray-300 bg-gray-50 hover:border-cyan-600 hover:bg-cyan-800/5'
                }`}
              >
                {isUploadingLogo ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-700 mb-2" />
                    <p className="text-xs text-gray-500">Uploading...</p>
                  </div>
                ) : formData.logoUrl ? (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center p-3">
                      <img
                        src={formData.logoUrl}
                        alt="Logo preview"
                        className="max-h-20 w-auto object-contain"
                      />
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-xl transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
                        <p className="text-xs font-medium text-gray-700">Click to replace</p>
                      </div>
                    </div>
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleRemoveLogo()
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 hover:bg-red-50 border border-gray-200 hover:border-red-300 text-gray-500 hover:text-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-cyan-800/10 flex items-center justify-center mb-2 transition-colors">
                      <Upload className="h-5 w-5 text-gray-400 group-hover:text-cyan-700 transition-colors" />
                    </div>
                    <p className="text-xs font-medium text-gray-600">Upload logo</p>
                    <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WebP, SVG</p>
                  </div>
                )}
              </div>
            </label>
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

    </form>
  )
}
