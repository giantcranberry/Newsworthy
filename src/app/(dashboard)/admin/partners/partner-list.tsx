"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  Settings,
  ExternalLink,
  LayoutGrid,
  List,
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

export function PartnerList({ partners }: PartnerListProps) {
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  if (partners.length === 0) {
    return (
      <Card>
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
      {/* Layout Toggle */}
      <div className="flex justify-end">
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
      </div>

      {layout === "grid" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((partner) => (
            <Card key={partner.id} className="overflow-hidden flex flex-col">
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

                  <div className="mt-auto pt-4">
                    <button className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900">
                      <Settings className="h-3.5 w-3.5" />
                      Manage
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {partners.map((partner) => (
            <Card key={partner.id} className="overflow-hidden">
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900">
                        <Settings className="h-3.5 w-3.5" />
                        Manage
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
