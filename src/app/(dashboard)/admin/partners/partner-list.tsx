"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Settings,
  ExternalLink,
  LayoutGrid,
  List,
  Plus,
} from "lucide-react";

interface Partner {
  id: number;
  company: string | null;
  brandName: string | null;
  handle: string | null;
  logo: string | null;
  isActive: boolean | null;
  partnerType: string | null;
  contactEmail: string | null;
  basePrice: number | null;
}

interface PartnerListProps {
  partners: Partner[];
}

type FilterOption = "active" | "inactive" | "all";

export function PartnerList({ partners }: PartnerListProps) {
  const router = useRouter();
  const [layout, setLayout] = useState<"grid" | "list">("list");
  const [filter, setFilter] = useState<FilterOption>("active");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newPartner, setNewPartner] = useState({
    company: "",
    handle: "",
    partnerType: "",
    contactEmail: "",
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError("");

    try {
      const res = await fetch("/api/admin/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPartner),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create partner");
      }

      const data = await res.json();
      setShowAddDialog(false);
      setNewPartner({ company: "", handle: "", partnerType: "", contactEmail: "" });
      router.push(`/admin/partners/${data.partner.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  const filteredPartners = useMemo(() => {
    const filtered =
      filter === "all"
        ? partners
        : filter === "active"
          ? partners.filter((p) => p.isActive)
          : partners.filter((p) => !p.isActive);

    // Active partners first, then alphabetical by company name
    return [...filtered].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const nameA = (a.company || a.brandName || "").toLowerCase();
      const nameB = (b.company || b.brandName || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [partners, filter]);

  if (partners.length === 0) {
    return (
      <Card data-tour="partners-empty">
        <CardContent className="py-16 text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No partners yet
          </h3>
          <p className="mt-2 text-gray-600">
            Add your first partner to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter, Layout Toggle & Add */}
      <div className="flex items-center justify-between gap-3">
        <div data-tour="partners-filters" className="inline-flex rounded-md border border-gray-300 bg-white">
          {(
            [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "all", label: "All" },
            ] as const
          ).map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
                i > 0 ? "border-l border-gray-300" : ""
              } ${i === 0 ? "rounded-l-md" : ""} ${i === 2 ? "rounded-r-md" : ""} ${
                filter === opt.value
                  ? "bg-cyan-800/10 text-cyan-800"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md border border-gray-300 bg-white">
            <button
              onClick={() => setLayout("grid")}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-l-md cursor-pointer transition-colors ${
                layout === "grid"
                  ? "bg-cyan-800/10 text-cyan-800"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayout("list")}
              className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-r-md border-l border-gray-300 cursor-pointer transition-colors ${
                layout === "list"
                  ? "bg-cyan-800/10 text-cyan-800"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <Button
            data-tour="partners-add"
            onClick={() => setShowAddDialog(true)}
            className="gap-2 bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Partner
          </Button>
        </div>
      </div>

      {filteredPartners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              No {filter === "all" ? "" : filter} partners found.
            </p>
          </CardContent>
        </Card>
      ) : layout === "grid" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPartners.map((partner, index) => (
            <Card key={partner.id} className="overflow-hidden flex flex-col" {...(index === 0 ? { "data-tour": "partners-first-card" } : {})}>
              <CardContent className="p-0 flex flex-col flex-1">
                {/* Logo Header */}
                <div className="flex items-center justify-center h-32 bg-gray-50">
                  {partner.logo ? (
                    <img
                      src={partner.logo}
                      alt={partner.company || ""}
                      className="max-h-20 max-w-[80%] object-contain"
                    />
                  ) : (
                    <Building2 className="h-16 w-16 text-gray-300" />
                  )}
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {partner.company || partner.brandName || "Unnamed Partner"}
                  </h3>
                  {partner.handle && (
                    <p className="mt-1 text-sm text-gray-600">
                      @{partner.handle}
                    </p>
                  )}

                  {/* Badges */}
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        partner.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {partner.isActive ? "Active" : "Inactive"}
                    </span>
                    {partner.partnerType && (
                      <span className="inline-flex items-center rounded-full bg-cyan-800/10 px-2 py-0.5 text-xs font-medium text-cyan-800">
                        {partner.partnerType}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="mt-3 text-sm text-gray-600 space-y-1">
                    {partner.contactEmail && (
                      <p>{partner.contactEmail}</p>
                    )}
                    {partner.basePrice !== null &&
                      partner.basePrice !== undefined && (
                        <p>
                          Base Price: $
                          {(partner.basePrice / 100).toFixed(2)}
                        </p>
                      )}
                  </div>

                  <div className="mt-auto pt-4" {...(index === 0 ? { "data-tour": "partners-actions" } : {})}>
                    <Link
                      href={`/admin/partners/${partner.id}`}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Manage
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPartners.map((partner, index) => (
            <Card key={partner.id} className="overflow-hidden" {...(index === 0 ? { "data-tour": "partners-first-card" } : {})}>
              <div className="flex flex-col sm:flex-row">
                {/* Logo */}
                {partner.logo ? (
                  <div className="hidden sm:flex w-36 flex-shrink-0 py-6 pl-5 self-start items-start justify-center">
                    <img
                      src={partner.logo}
                      alt={partner.company || ""}
                      className="max-h-16 max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="hidden sm:flex w-36 flex-shrink-0 py-6 pl-5 self-start items-start justify-center">
                    <Building2 className="h-12 w-12 text-gray-400" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            partner.isActive
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {partner.isActive ? "Active" : "Inactive"}
                        </span>
                        {partner.partnerType && (
                          <span className="inline-flex items-center rounded-full bg-cyan-800/10 px-2 py-0.5 text-xs font-medium text-cyan-800">
                            {partner.partnerType}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {partner.company ||
                          partner.brandName ||
                          "Unnamed Partner"}
                      </h3>
                      {partner.handle && (
                        <p className="text-sm text-gray-600 mt-1">
                          @{partner.handle}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                        {partner.contactEmail && (
                          <span>{partner.contactEmail}</span>
                        )}
                        {partner.basePrice !== null &&
                          partner.basePrice !== undefined && (
                            <span>
                              Base Price: $
                              {(partner.basePrice / 100).toFixed(2)}
                            </span>
                          )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0" {...(index === 0 ? { "data-tour": "partners-actions" } : {})}>
                      <Link
                        href={`/admin/partners/${partner.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Manage
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Partner</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {createError && (
              <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
                {createError}
              </div>
            )}
            <div>
              <Label htmlFor="new-company">Company Name *</Label>
              <Input
                id="new-company"
                required
                value={newPartner.company}
                onChange={(e) =>
                  setNewPartner({ ...newPartner, company: e.target.value })
                }
                className="mt-1"
                placeholder="Acme Corp"
              />
            </div>
            <div>
              <Label htmlFor="new-handle">Handle</Label>
              <Input
                id="new-handle"
                value={newPartner.handle}
                onChange={(e) =>
                  setNewPartner({ ...newPartner, handle: e.target.value })
                }
                className="mt-1"
                placeholder="acme"
                maxLength={25}
              />
            </div>
            <div>
              <Label htmlFor="new-partnerType">Partner Type</Label>
              <Select
                id="new-partnerType"
                value={newPartner.partnerType}
                onChange={(e) =>
                  setNewPartner({ ...newPartner, partnerType: e.target.value })
                }
                className="mt-1"
              >
                <option value="">Select type</option>
                <option value="affiliate">Affiliate</option>
                <option value="agency">Agency</option>
                <option value="publisher">Publisher</option>
                <option value="reseller">Reseller</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="new-contactEmail">Contact Email</Label>
              <Input
                id="new-contactEmail"
                type="email"
                value={newPartner.contactEmail}
                onChange={(e) =>
                  setNewPartner({ ...newPartner, contactEmail: e.target.value })
                }
                className="mt-1"
                placeholder="contact@acme.com"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
                className="bg-cyan-800 text-white hover:bg-cyan-900"
              >
                {isCreating ? "Creating..." : "Create Partner"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
