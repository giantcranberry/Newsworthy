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
import { Loader2, UserPlus, Pencil, Trash2, Users, Camera, User } from 'lucide-react'

interface ContactData {
  uuid: string
  name: string
  title: string
  email: string
  phone: string
  avatar: string
}

interface ContactsFormProps {
  readOnly?: boolean
  companyUuid: string
  contacts: ContactData[]
}

export function ContactsForm({ readOnly, companyUuid, contacts: initialContacts }: ContactsFormProps) {
  const router = useRouter()

  const [contactsList, setContactsList] = useState<ContactData[]>(initialContacts)
  const [showContactModal, setShowContactModal] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactData | null>(null)
  const [contactForm, setContactForm] = useState({ name: '', title: '', email: '', phone: '', avatar: '' })
  const [isSavingContact, setIsSavingContact] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [contactError, setContactError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [showDeleteContactModal, setShowDeleteContactModal] = useState(false)
  const [deletingContact, setDeletingContact] = useState<ContactData | null>(null)
  const [isDeletingContact, setIsDeletingContact] = useState(false)
  const [deleteContactError, setDeleteContactError] = useState<string | null>(null)

  function formatPhoneNumber(value: string): string {
    const hasPlus = value.startsWith('+')
    const digits = value.replace(/\D/g, '')
    if (!digits) return hasPlus ? '+' : ''
    if (hasPlus && !digits.startsWith('1')) {
      return '+' + digits
    }
    const usDigits = digits.startsWith('1') ? digits.substring(1) : digits
    if (usDigits.length <= 3) return `(${usDigits}`
    if (usDigits.length <= 6) return `(${usDigits.slice(0, 3)}) ${usDigits.slice(3)}`
    return `(${usDigits.slice(0, 3)}) ${usDigits.slice(3, 6)}-${usDigits.slice(6, 10)}`
  }

  function isValidPhone(value: string): boolean {
    if (!value.trim()) return true
    const digits = value.replace(/\D/g, '')
    if (value.startsWith('+')) return digits.length >= 7 && digits.length <= 15
    return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
  }

  const openAddContact = () => {
    setEditingContact(null)
    setContactForm({ name: '', title: '', email: '', phone: '', avatar: '' })
    setContactError(null)
    setShowContactModal(true)
  }

  const openEditContact = (c: ContactData) => {
    setEditingContact(c)
    setContactForm({ name: c.name, title: c.title, email: c.email, phone: c.phone, avatar: c.avatar })
    setContactError(null)
    setShowContactModal(true)
  }

  const handleAvatarUpload = async (file: File, contactUuid: string) => {
    if (file.size > 5 * 1024 * 1024) {
      setContactError('Photo must be under 5MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setContactError('Only PNG, JPG, and WebP files are supported')
      return
    }

    setIsUploadingAvatar(true)
    setContactError(null)

    try {
      const fd = new FormData()
      fd.append('avatar', file)
      fd.append('contactUuid', contactUuid)

      const response = await fetch(`/api/company/${companyUuid}/contacts/avatar`, {
        method: 'POST',
        body: fd,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload photo')
      }

      const data = await response.json()
      setContactForm((f) => ({ ...f, avatar: data.avatarUrl }))
      setContactsList((prev) =>
        prev.map((c) => c.uuid === contactUuid ? { ...c, avatar: data.avatarUrl } : c)
      )
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  const handleSaveContact = async () => {
    if (contactForm.phone && !isValidPhone(contactForm.phone)) {
      setContactError('Please enter a valid phone number. US: (555) 123-4567, International: +44 20 7946 0958')
      return
    }
    setIsSavingContact(true)
    setContactError(null)

    try {
      const isEdit = !!editingContact
      const response = await fetch(`/api/company/${companyUuid}/contacts`, {
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
              ? { ...c, name: contactForm.name, title: contactForm.title, email: contactForm.email, phone: contactForm.phone, avatar: contactForm.avatar }
              : c
          )
        )
      } else {
        const newContact = await response.json()
        let avatarUrl = ''

        // If user selected a photo for the new contact, upload it now
        if (contactForm.avatar && contactForm.avatar.startsWith('data:')) {
          try {
            const blob = await fetch(contactForm.avatar).then((r) => r.blob())
            const file = new File([blob], 'avatar.png', { type: blob.type })
            const fd = new FormData()
            fd.append('avatar', file)
            fd.append('contactUuid', newContact.uuid)

            const avatarRes = await fetch(`/api/company/${companyUuid}/contacts/avatar`, {
              method: 'POST',
              body: fd,
            })

            if (avatarRes.ok) {
              const avatarData = await avatarRes.json()
              avatarUrl = avatarData.avatarUrl
            }
          } catch {
            // Avatar upload failed silently — contact was still created
          }
        }

        setContactsList((prev) => [...prev, {
          uuid: newContact.uuid,
          name: newContact.name,
          title: newContact.title || '',
          email: newContact.email || '',
          phone: newContact.phone || '',
          avatar: avatarUrl,
        }])
      }
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'Failed to save contact')
    } finally {
      setIsSavingContact(false)
    }
  }

  const handleDeleteContact = async () => {
    if (!deletingContact) return
    setIsDeletingContact(true)
    setDeleteContactError(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/contacts`, {
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-400" />
              PR Contacts
            </CardTitle>
            {!readOnly && (
              <Button type="button" variant="outline" size="sm" onClick={openAddContact}>
                <UserPlus className="h-4 w-4" />
                Add Contact
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {contactsList.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Name</th>
                    <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Title</th>
                    <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Email</th>
                    <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Phone</th>
                    {!readOnly && <th className="pb-2 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {contactsList.map((c) => (
                    <tr key={c.uuid} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">
                        <div className="flex items-center gap-2">
                          {c.avatar ? (
                            <img src={c.avatar} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                              <User className="h-3.5 w-3.5 text-gray-400" />
                            </div>
                          )}
                          {c.name}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{c.title || '\u2014'}</td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{c.email || '\u2014'}</td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{c.phone || '\u2014'}</td>
                      {!readOnly && (
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditContact(c)}
                              className="p-1 text-gray-400 hover:text-blue-600 dark:text-blue-400 transition-colors"
                              title="Edit contact"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDeletingContact(c); setDeleteContactError(null); setShowDeleteContactModal(true) }}
                              className="p-1 text-gray-400 hover:text-red-600 dark:text-red-400 transition-colors"
                              title="Remove contact"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              No PR contacts yet. Add contacts that can be included on your press releases for media inquiries.
            </p>
          )}
        </CardContent>
      </Card>

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
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg">{contactError}</div>
          )}

          <div className="grid gap-4 py-2">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  e.target.value = ''
                  if (editingContact) {
                    handleAvatarUpload(file, editingContact.uuid)
                  } else {
                    // For new contacts, store as local preview — upload after save
                    const reader = new FileReader()
                    reader.onload = () => setContactForm((f) => ({ ...f, avatar: reader.result as string }))
                    reader.readAsDataURL(file)
                  }
                }}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="relative group cursor-pointer"
              >
                {isUploadingAvatar ? (
                  <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : contactForm.avatar ? (
                  <div className="relative">
                    <img src={contactForm.avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
                    <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Camera className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 group-hover:border-cyan-600 flex items-center justify-center transition-colors">
                    <Camera className="h-5 w-5 text-gray-400 group-hover:text-cyan-600 dark:text-cyan-400 transition-colors" />
                  </div>
                )}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400">Upload a contact photo <span className="text-gray-400">(recommended)</span></p>
            </div>

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
                type="tel"
                value={contactForm.phone}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw.startsWith('+')) {
                    setContactForm((f) => ({ ...f, phone: '+' + raw.slice(1).replace(/[^\d\s-]/g, '') }))
                  } else {
                    setContactForm((f) => ({ ...f, phone: formatPhoneNumber(raw) }))
                  }
                }}
                placeholder="(555) 123-4567 or +44 20 7946 0958"
                className="mt-1"
                maxLength={30}
              />
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-500">
                US: (555) 123-4567 &middot; International: +country code then number
              </p>
              {contactForm.phone && !isValidPhone(contactForm.phone) && (
                <p className="mt-0.5 text-xs text-red-500">
                  Enter a valid US number (10 digits) or international number (+country code)
                </p>
              )}
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
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg">{deleteContactError}</div>
          )}

          {deletingContact && (
            <div className="py-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{deletingContact.name}</p>
              {deletingContact.email && <p className="text-sm text-gray-500 dark:text-gray-400">{deletingContact.email}</p>}
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
    </>
  )
}
