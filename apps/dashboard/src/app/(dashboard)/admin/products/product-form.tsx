'use client'

import { useState, useRef } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import { setupSchemaPlugin } from '@/lib/tinymce-schema-plugin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select } from '@/components/ui/select'
import { Loader2, Trash2 } from 'lucide-react'
import { ImageUpload } from '@/components/upload/image-upload'

interface Product {
  id: number
  shortName: string | null
  displayName: string | null
  description: string | null
  icon: string | null
  price: number
  productType: string | null
  isActive: boolean | null
  isUpgrade: boolean | null
  isSoloUpgrade: boolean | null
  label: string | null
  logoUrl: string | null
  partnerId: number | null
  sortOrder: number
}

interface Partner {
  id: number
  company: string | null
  handle: string | null
}

interface ProductFormProps {
  product: Product | null
  partners: Partner[]
  onSuccess: () => void
  onCancel: () => void
}

const DISTRIBUTION_TAGS = [
  { value: 'yahoo', label: 'Yahoo Finance' },
  { value: 'enhanced', label: 'Enhanced' },
  { value: 'pr', label: 'Press Release' },
  { value: 'addon', label: 'Add-on' },
  { value: 'service', label: 'Service' },
]

export function ProductForm({ product, partners, onSuccess, onCancel }: ProductFormProps) {
  const editorRef = useRef<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isRemovingLogo, setIsRemovingLogo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState(product?.logoUrl || '')
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    displayName: product?.displayName || '',
    shortName: product?.shortName || '',
    label: product?.label || '',
    icon: product?.icon || 'Zap',
    price: product ? (product.price / 100).toString() : '',
    productType: product?.productType || '',
    isActive: product?.isActive ?? true,
    isUpgrade: product?.isUpgrade ?? true,
    isSoloUpgrade: product?.isSoloUpgrade ?? false,
    description: product?.description || '',
    partnerId: product?.partnerId?.toString() || 'global',
    sortOrder: product?.sortOrder?.toString() || '0',
  })

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const uploadLogoToProduct = async (file: File, productId: number) => {
    const fd = new FormData()
    fd.append('logo', file)
    const res = await fetch(`/api/admin/products/${productId}/logo`, {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || 'Failed to upload logo')
    }
    const data = await res.json()
    return data.logoUrl as string
  }

  const handleLogoUpload = async (file: File) => {
    if (!product) {
      // Create mode: stash the file and show a local preview
      setPendingLogoFile(file)
      setLogoUrl(URL.createObjectURL(file))
      return
    }
    // Edit mode: upload immediately
    setIsUploadingLogo(true)
    setError(null)
    try {
      const url = await uploadLogoToProduct(file, product.id)
      setLogoUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleLogoRemove = async () => {
    if (!product) {
      // Create mode: just clear the pending file
      setPendingLogoFile(null)
      setLogoUrl('')
      return
    }
    setIsRemovingLogo(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/products/${product.id}/logo`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove logo')
      }
      setLogoUrl('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove logo')
    } finally {
      setIsRemovingLogo(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const description = editorRef.current?.getContent() || formData.description
      const priceInCents = Math.round(parseFloat(formData.price) * 100)

      const payload = {
        displayName: formData.displayName,
        shortName: formData.shortName,
        label: formData.label,
        icon: formData.icon,
        price: priceInCents,
        productType: formData.productType,
        isActive: formData.isActive,
        isUpgrade: formData.isUpgrade,
        isSoloUpgrade: formData.isSoloUpgrade,
        description,
        partnerId: formData.partnerId === 'global' ? null : parseInt(formData.partnerId),
        sortOrder: parseInt(formData.sortOrder) || 0,
      }

      const url = product
        ? `/api/admin/products/${product.id}`
        : '/api/admin/products'

      const response = await fetch(url, {
        method: product ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save product')
      }

      // If creating and a logo was selected, upload it now
      if (!product && pendingLogoFile && data.id) {
        try {
          await uploadLogoToProduct(pendingLogoFile, data.id)
        } catch {
          // Product was created but logo failed — not critical
          console.error('Logo upload failed after product creation')
        }
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="partnerId">Availability</Label>
        <Select
          id="partnerId"
          value={formData.partnerId}
          onChange={(e) => handleChange('partnerId', e.target.value)}
        >
          <option value="global">All Accounts (Global)</option>
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id.toString()}>
              {partner.company || partner.handle}
            </option>
          ))}
        </Select>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Global products are available to all accounts. Partner products are only available to that partner's accounts.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">Product Name *</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => handleChange('displayName', e.target.value)}
            placeholder="e.g., Yahoo Finance Distribution"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="shortName">Short Name</Label>
          <Input
            id="shortName"
            value={formData.shortName}
            onChange={(e) => handleChange('shortName', e.target.value)}
            placeholder="e.g., yahoo"
            maxLength={22}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Price (USD) *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">$</span>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={formData.price}
              onChange={(e) => handleChange('price', e.target.value)}
              className="pl-7"
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="productType">Distribution Tag *</Label>
          <Select
            id="productType"
            value={formData.productType}
            onChange={(e) => handleChange('productType', e.target.value)}
            required
          >
            <option value="">Select tag...</option>
            {DISTRIBUTION_TAGS.map((tag) => (
              <option key={tag.value} value={tag.value}>
                {tag.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="icon">Icon</Label>
          <Input
            id="icon"
            value={formData.icon}
            onChange={(e) => handleChange('icon', e.target.value)}
            placeholder="e.g., Zap or fab fa-yahoo"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Lucide icons: Zap, Sparkles, Star, Crown, Rocket, Target<br />
            Font Awesome: fab fa-yahoo, fas fa-newspaper, etc.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            value={formData.label}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="e.g., Best Value"
            maxLength={20}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Product Logo</Label>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 h-16 w-20 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Product logo"
                className="max-h-full max-w-full object-contain"
              />
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <ImageUpload
              onFileSelect={(file) => handleLogoUpload(file)}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              maxSize={5 * 1024 * 1024}
              buttonText={isUploadingLogo ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}
              buttonVariant="outline"
              disabled={isUploadingLogo || isRemovingLogo}
            />
            {logoUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleLogoRemove}
                disabled={isRemovingLogo || isUploadingLogo}
                className="text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 cursor-pointer"
              >
                {isRemovingLogo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                )}
                Remove Logo
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sortOrder">Display Order</Label>
        <Input
          id="sortOrder"
          type="number"
          value={formData.sortOrder}
          onChange={(e) => handleChange('sortOrder', e.target.value)}
          className="w-24"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Lower numbers appear first. Use the arrows on the product list for quick reordering.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Description (Rich Text)</Label>
        <div className="border rounded-lg overflow-hidden">
          <Editor
            apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || 'no-api-key'}
            onInit={(evt, editor) => (editorRef.current = editor)}
            initialValue={formData.description}
            init={{
              height: 300,
              menubar: false,
              plugins: [
                'advlist', 'autolink', 'lists', 'link',
                'searchreplace', 'visualblocks',
                'insertdatetime', 'help', 'wordcount'
              ],
              toolbar: 'undo redo | blocks | ' +
                'bold italic superscript | bullist numlist | ' +
                'link schemaAttrs | removeformat',
              setup: (editor: any) => { setupSchemaPlugin(editor); },
              extended_valid_elements: '@[itemscope|itemtype|itemid|itemprop|content],a[href|target|rel|itemscope|itemtype|itemprop|class],div[*],span[*],time[datetime|*]',
              link_rel_list: [
                { title: 'None', value: '' },
                { title: 'No Follow', value: 'nofollow' },
                { title: 'Sponsored', value: 'sponsored' },
                { title: 'UGC', value: 'ugc' },
                { title: 'No Follow + Sponsored', value: 'nofollow sponsored' },
              ],
              content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; }',
              branding: false,
            }}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
          <div>
            <Label htmlFor="isActive" className="font-medium">Active</Label>
            <p className="text-sm text-gray-500 dark:text-gray-400">Make this product available for purchase</p>
          </div>
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => handleChange('isActive', checked)}
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
          <div>
            <Label htmlFor="isUpgrade" className="font-medium">PR Upgrade Product</Label>
            <p className="text-sm text-gray-500 dark:text-gray-400">Show this product on the PR upgrades page</p>
          </div>
          <Switch
            id="isUpgrade"
            checked={formData.isUpgrade}
            onCheckedChange={(checked) => handleChange('isUpgrade', checked)}
          />
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
          <div>
            <Label htmlFor="isSoloUpgrade" className="font-medium">Exclusive Upgrade</Label>
            <p className="text-sm text-gray-500 dark:text-gray-400">Cannot be combined with other upgrades</p>
          </div>
          <Switch
            id="isSoloUpgrade"
            checked={formData.isSoloUpgrade}
            onCheckedChange={(checked) => handleChange('isSoloUpgrade', checked)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            product ? 'Update Product' : 'Create Product'
          )}
        </Button>
      </div>
    </form>
  )
}
