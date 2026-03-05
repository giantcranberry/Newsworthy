'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save, Info } from 'lucide-react'
import { TeamSection } from '@/components/company/team-section'

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

interface CompanyFormProps {
  initialData?: {
    uuid?: string
    companyName?: string
    website?: string
    addr1?: string
    addr2?: string
    city?: string
    state?: string
    postalCode?: string
    countryCode?: string
    phone?: string
    email?: string
  }
  pageTitle?: string
  pageDescription?: string
  headerExtra?: React.ReactNode
  isAgency?: boolean
  notice?: string
  readOnly?: boolean
}

export function CompanyForm({ initialData, pageTitle, pageDescription, headerExtra, isAgency, notice, readOnly }: CompanyFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const [formData, setFormData] = useState({
    companyName: initialData?.companyName || '',
    website: initialData?.website || '',
    addr1: initialData?.addr1 || '',
    addr2: initialData?.addr2 || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    postalCode: initialData?.postalCode || '',
    countryCode: initialData?.countryCode || 'US',
    phone: initialData?.phone ? formatPhoneNumber(initialData.phone) : '',
    email: initialData?.email || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return
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

  const title = pageTitle || (initialData?.uuid ? 'Edit Brand' : 'Add Brand')
  const description = pageDescription || (initialData?.uuid ? formData.companyName : 'Create a new brand profile for your press releases')

  return (
    <form onSubmit={handleSubmit} className="-mt-6 space-y-8">
      {/* Sticky Action Bar */}
      <div data-tour="brand-form-action-bar" className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{title}</h1>
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
          {!readOnly && (
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
                className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {initialData?.uuid ? 'Save Changes' : 'Create Brand'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-400">{notice}</p>
        </div>
      )}

      {headerExtra}

      {/* Basic Info */}
      <Card data-tour="brand-form-basic-info">
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
              disabled={readOnly}
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
              disabled={readOnly}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Info (edit mode only) */}
      {initialData?.uuid && (
        <Card data-tour="brand-form-contact-info">
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
                  disabled={readOnly}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })}
                  placeholder="(555) 555-1234"
                  maxLength={14}
                  disabled={readOnly}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Address */}
      <Card data-tour="brand-form-address">
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
              disabled={readOnly}
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
              disabled={readOnly}
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
                disabled={readOnly}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="state">State / Province</Label>
              <Input
                id="state"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                maxLength={32}
                disabled={readOnly}
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
                disabled={readOnly}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="countryCode">Country</Label>
              <select
                id="countryCode"
                value={formData.countryCode}
                onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                disabled={readOnly}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 shadow-sm dark:shadow-gray-900/50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 dark:bg-gray-800 disabled:text-gray-500 dark:text-gray-400"
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="IN">India</option>
                <option value="PH">Philippines</option>
                <option value="SG">Singapore</option>
                <option disabled>──────────</option>
                <option value="AF">Afghanistan</option>
                <option value="DZ">Algeria</option>
                <option value="AO">Angola</option>
                <option value="AR">Argentina</option>
                <option value="BD">Bangladesh</option>
                <option value="BR">Brazil</option>
                <option value="BF">Burkina Faso</option>
                <option value="CM">Cameroon</option>
                <option value="CN">China</option>
                <option value="CO">Colombia</option>
                <option value="CD">Congo (DRC)</option>
                <option value="CI">Côte d&apos;Ivoire</option>
                <option value="EG">Egypt</option>
                <option value="ET">Ethiopia</option>
                <option value="FR">France</option>
                <option value="DE">Germany</option>
                <option value="GH">Ghana</option>
                <option value="ID">Indonesia</option>
                <option value="IR">Iran</option>
                <option value="IQ">Iraq</option>
                <option value="IT">Italy</option>
                <option value="JP">Japan</option>
                <option value="KE">Kenya</option>
                <option value="KR">Korea (South)</option>
                <option value="MG">Madagascar</option>
                <option value="MY">Malaysia</option>
                <option value="ML">Mali</option>
                <option value="MX">Mexico</option>
                <option value="MA">Morocco</option>
                <option value="MZ">Mozambique</option>
                <option value="MM">Myanmar</option>
                <option value="NP">Nepal</option>
                <option value="NE">Niger</option>
                <option value="NG">Nigeria</option>
                <option value="PK">Pakistan</option>
                <option value="PE">Peru</option>
                <option value="PL">Poland</option>
                <option value="RO">Romania</option>
                <option value="RU">Russia</option>
                <option value="SA">Saudi Arabia</option>
                <option value="SN">Senegal</option>
                <option value="ZA">South Africa</option>
                <option value="ES">Spain</option>
                <option value="LK">Sri Lanka</option>
                <option value="SD">Sudan</option>
                <option value="SY">Syria</option>
                <option value="TW">Taiwan</option>
                <option value="TZ">Tanzania</option>
                <option value="TH">Thailand</option>
                <option value="TR">Turkey</option>
                <option value="UG">Uganda</option>
                <option value="UA">Ukraine</option>
                <option value="UZ">Uzbekistan</option>
                <option value="VE">Venezuela</option>
                <option value="VN">Vietnam</option>
                <option value="YE">Yemen</option>
                <option disabled>──────────</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Section (Agency only) */}
      {isAgency && initialData?.uuid && (
        <TeamSection companyUuid={initialData.uuid} />
      )}

    </form>
  )
}
