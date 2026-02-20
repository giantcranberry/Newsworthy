"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Zap,
  Sparkles,
  Star,
  Crown,
  Rocket,
  Target,
  Globe,
} from "lucide-react";
import { ProductForm } from "./product-form";

interface Product {
  id: number;
  shortName: string | null;
  displayName: string | null;
  description: string | null;
  icon: string | null;
  price: number;
  productType: string | null;
  isActive: boolean | null;
  isUpgrade: boolean | null;
  isSoloUpgrade: boolean | null;
  label: string | null;
  partnerId: number | null;
}

interface Partner {
  id: number;
  company: string | null;
  handle: string | null;
}

interface ProductListProps {
  products: Product[];
  partners: Partner[];
  currentFilter: string;
}

// Lucide icon mapping
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Sparkles,
  Star,
  Crown,
  Rocket,
  Target,
};

// Check if icon is a Font Awesome class
function isFontAwesomeIcon(iconName: string | null): boolean {
  if (!iconName) return false;
  const trimmed = iconName.trim();
  return (
    trimmed.startsWith("fa:") ||
    trimmed.startsWith("fa-") ||
    trimmed.startsWith("fab ") ||
    trimmed.startsWith("fas ") ||
    trimmed.startsWith("far ")
  );
}

// Get Font Awesome class (strip "fa:" prefix if present)
function getFontAwesomeClass(iconName: string): string {
  const trimmed = iconName.trim();
  if (trimmed.startsWith("fa:")) {
    return trimmed.slice(3);
  }
  return trimmed;
}

function getLucideIconComponent(iconName: string | null) {
  if (!iconName) return Zap;
  return ICON_MAP[iconName] || Zap;
}

// Icon component that handles both Lucide and Font Awesome
function ProductIcon({
  iconName,
  className,
}: {
  iconName: string | null;
  className?: string;
}) {
  if (isFontAwesomeIcon(iconName)) {
    const faClass = getFontAwesomeClass(iconName!);
    return <i className={`${faClass} ${className || ""}`} aria-hidden="true" />;
  }

  const LucideIcon = getLucideIconComponent(iconName);
  return <LucideIcon className={className} />;
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function ProductList({
  products,
  partners,
  currentFilter,
}: ProductListProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);

  const handleFilterChange = (value: string) => {
    const params = new URLSearchParams();
    if (value !== "all") {
      params.set("partner", value);
    }
    router.push(
      `/admin/products${params.toString() ? `?${params.toString()}` : ""}`,
    );
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setShowDialog(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowDialog(true);
  };

  const handleDelete = async (productId: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    setIsDeleting(productId);
    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to delete product");
      }
    } catch (error) {
      alert("An error occurred");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSuccess = () => {
    setShowDialog(false);
    setEditingProduct(null);
    router.refresh();
  };

  const getPartnerName = (partnerId: number | null) => {
    if (partnerId === null) return null;
    const partner = partners.find((p) => p.id === partnerId);
    return partner?.company || partner?.handle || `Partner #${partnerId}`;
  };

  return (
    <>
      {/* Filter & Add */}
      <div className="flex items-center justify-between">
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
        <Button onClick={handleCreate} className="gap-2 bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Product List */}
      {products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Zap className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No products found</h3>
            <p className="mt-2 text-gray-600">Create your first upgrade product.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {products.map((product) => {
            const partnerName = getPartnerName(product.partnerId);
            return (
              <Card key={product.id} className="overflow-hidden">
                <div className="flex-1 min-w-0 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-cyan-800/10 flex items-center justify-center w-10 h-10 flex-shrink-0">
                        <ProductIcon
                          iconName={product.icon}
                          className="h-5 w-5 text-cyan-800"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {product.displayName || product.shortName}
                          </h3>
                          {product.productType && (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              {product.productType}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {product.partnerId === null ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-800">
                              <Globe className="h-3 w-3" />
                              All Accounts
                            </span>
                          ) : (
                            <span className="text-xs text-gray-600">
                              {partnerName}
                            </span>
                          )}
                          {product.label && (
                            <span className="inline-flex items-center rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600">
                              {product.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      <p className="font-semibold text-gray-900">
                        {formatPrice(product.price)}
                      </p>
                      <div className="h-6 w-px bg-gray-200" />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          disabled={isDeleting === product.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 cursor-pointer transition-colors hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Create Product"}
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
  );
}
