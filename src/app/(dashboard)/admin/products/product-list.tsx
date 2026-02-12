'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, Zap, Sparkles, Star, Crown, Rocket, Target, Globe } from 'lucide-react'
import { ProductForm } from './product-form'
import { cn } from '@/lib/utils'

interface Product {
  id: number
  shortName: string | null
  displayName: string | null
  description: string | null
  icon: string | null
  price: number
  productType: string | null
  isActive: boolean | null
  label: string | null
  partnerId: number | null
}

interface Partner {
  id: number
  company: string | null
  handle: string | null
}

interface ProductListProps {
  products: Product[]
  partners: Partner[]
  currentFilter: string
}

// Lucide icon mapping
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Sparkles,
  Star,
  Crown,
  Rocket,
  Target,
}

// Check if icon is a Font Awesome class
function isFontAwesomeIcon(iconName: string | null): boolean {
  if (!iconName) return false
  const trimmed = iconName.trim()
  return trimmed.startsWith('fa:') || trimmed.startsWith('fa-') || trimmed.startsWith('fab ') || trimmed.startsWith('fas ') || trimmed.startsWith('far ')
}

// Get Font Awesome class (strip "fa:" prefix if present)
function getFontAwesomeClass(iconName: string): string {
  const trimmed = iconName.trim()
  if (trimmed.startsWith('fa:')) {
    return trimmed.slice(3)
  }
  return trimmed
}

function getLucideIconComponent(iconName: string | null) {
  if (!iconName) return Zap
  return ICON_MAP[iconName] || Zap
}

// Icon component that handles both Lucide and Font Awesome
function ProductIcon({ iconName, className }: { iconName: string | null; className?: string }) {
  if (isFontAwesomeIcon(iconName)) {
    const faClass = getFontAwesomeClass(iconName!)
    return <i className={`${faClass} ${className || ''}`} aria-hidden="true" />
  }

  const LucideIcon = getLucideIconComponent(iconName)
  return <LucideIcon className={className} />
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function ProductList({ products, partners, currentFilter }: ProductListProps) {
  const router = useRouter()
  const [showDialog, setShowDialog] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams()
    if (value !== 'all') {
      params.set('partner', value)
    }
    router.push(`/admin/products${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const handleCreate = () => {
    setEditingProduct(null)
    setShowDialog(true)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setShowDialog(true)
  }

  const handleDelete = async (productId: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    setIsDeleting(productId)
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        router.refresh()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to delete product')
      }
    } catch (error) {
      alert('An error occurred')
    } finally {
      setIsDeleting(null)
    }
  }

  const handleSuccess = () => {
    setShowDialog(false)
    setEditingProduct(null)
    router.refresh()
  }

  const getPartnerName = (partnerId: number | null) => {
    if (partnerId === null) return null
    const partner = partners.find(p => p.id === partnerId)
    return partner?.company || partner?.handle || `Partner #${partnerId}`
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle>Products</CardTitle>
            <Select
              value={currentFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="w-48"
            >
              <option value="all">All Products</option>
              <option value="global">Global (All Accounts)</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id.toString()}>
                  {partner.company || partner.handle}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No products found. Create your first upgrade product.
            </div>
          ) : (
            <div className="space-y-4">
              {products.map((product) => {
                const partnerName = getPartnerName(product.partnerId)
                return (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-white"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-blue-100 flex items-center justify-center w-10 h-10">
                        <ProductIcon iconName={product.icon} className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{product.displayName || product.shortName}</h3>
                          {product.productType && (
                            <Badge variant="secondary">{product.productType}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {product.partnerId === null ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <Globe className="h-3 w-3" />
                              All Accounts
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">
                              {partnerName}
                            </span>
                          )}
                          {product.label && (
                            <Badge variant="outline" className="text-xs">{product.label}</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">{formatPrice(product.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                          disabled={isDeleting === product.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Edit Product' : 'Create Product'}
            </DialogTitle>
          </DialogHeader>
          <ProductForm
            product={editingProduct}
            partners={partners}
            onSuccess={handleSuccess}
            onCancel={() => setShowDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
