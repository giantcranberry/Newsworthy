"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Plus,
  Edit,
  ExternalLink,
  CreditCard,
  LayoutGrid,
  List,
} from "lucide-react";

interface Company {
  id: number;
  uuid: string;
  companyName: string;
  logoUrl: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
}

interface CompanyListProps {
  companies: Company[];
  creditsByCompany: Record<number, number>;
}

export function CompanyList({ companies, creditsByCompany }: CompanyListProps) {
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  if (companies.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No brands yet
          </h3>
          <p className="mt-2 text-gray-600">
            Add your first brand to start creating press releases.
          </p>
          <Link href="/company/add">
            <Button className="mt-6 gap-2 bg-cyan-800 text-white hover:bg-cyan-900 cursor-pointer">
              <Plus className="h-4 w-4" />
              Add Brand
            </Button>
          </Link>
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
          {companies.map((co) => (
            <Card key={co.id} className="overflow-hidden flex flex-col">
              <CardContent className="p-0 flex flex-col flex-1">
                {/* Logo Header */}
                <div className="flex items-center justify-center h-32 bg-gray-50">
                  {co.logoUrl ? (
                    <img
                      src={co.logoUrl}
                      alt={co.companyName}
                      className="max-h-20 max-w-[80%] object-contain"
                    />
                  ) : (
                    <Building2 className="h-16 w-16 text-gray-300" />
                  )}
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-1">
                  <Link href={`/company/${co.uuid}`}>
                    <h3 className="font-semibold text-gray-900 hover:text-cyan-800">
                      {co.companyName}
                    </h3>
                  </Link>
                  {co.website && (
                    <a
                      href={
                        co.website.startsWith("http")
                          ? co.website
                          : `https://${co.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 text-sm text-gray-600 hover:text-cyan-800 flex items-center gap-1"
                    >
                      {co.website.replace(/^https?:\/\//, "")}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {co.city && co.state && (
                    <p className="mt-1 text-sm text-gray-600">
                      {co.city}, {co.state}
                    </p>
                  )}

                  {/* Credits Badge */}
                  <div className="mt-3 flex items-center gap-1.5 text-sm">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                    <span
                      className={`font-medium ${(creditsByCompany[co.id] || 0) > 0 ? "text-green-600" : "text-gray-500"}`}
                    >
                      {creditsByCompany[co.id] || 0} credits
                    </span>
                  </div>

                  <div className="mt-auto pt-4 flex gap-2">
                    <Link href={`/company/${co.uuid}`} className="flex-1">
                      <button className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900">
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    </Link>
                    <Link
                      href={`/pr/create?company=${co.uuid}`}
                      className="flex-1"
                    >
                      <button className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-cyan-900 bg-cyan-800 px-3 py-2 text-sm font-medium text-white cursor-pointer transition-colors hover:bg-cyan-900">
                        New Release
                      </button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {companies.map((co) => (
            <Card key={co.id} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                {/* Logo */}
                {co.logoUrl ? (
                  <div className="hidden sm:flex w-36 flex-shrink-0 py-6 pl-5 self-start items-start justify-center">
                    <img
                      src={co.logoUrl}
                      alt={co.companyName}
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
                      <Link href={`/company/${co.uuid}`} className="cursor-pointer">
                        <h3 className="text-lg font-semibold text-gray-900 hover:text-cyan-800 truncate">
                          {co.companyName}
                        </h3>
                      </Link>
                      {co.website && (
                        <a
                          href={
                            co.website.startsWith("http")
                              ? co.website
                              : `https://${co.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 text-sm text-gray-600 hover:text-cyan-800 inline-flex items-center gap-1"
                        >
                          {co.website.replace(/^https?:\/\//, "")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {co.city && co.state && (
                        <p className="text-sm text-gray-600 mt-1">
                          {co.city}, {co.state}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-1.5 text-sm">
                        <CreditCard className="h-4 w-4 text-gray-400" />
                        <span
                          className={`font-medium ${(creditsByCompany[co.id] || 0) > 0 ? "text-green-600" : "text-gray-500"}`}
                        >
                          {creditsByCompany[co.id] || 0} credits
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link href={`/company/${co.uuid}`}>
                        <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900">
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      </Link>
                      <Link href={`/pr/create?company=${co.uuid}`}>
                        <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium bg-cyan-800 text-white cursor-pointer transition-colors hover:bg-cyan-900">
                          New Release
                        </button>
                      </Link>
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
