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
  Users,
  Eye,
} from "lucide-react";
import { TeamSection } from "@/components/company/team-section";

interface Company {
  id: number;
  uuid: string;
  companyName: string;
  logoUrl: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  brand_admin: "Brand Admin",
  collaborator: "Collaborator",
  client: "Client",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400",
  brand_admin: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400",
  collaborator: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400",
  client: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
};

interface CompanyListProps {
  companies: Company[];
  creditsByCompany: Record<number, number>;
  rolesByCompany: Record<number, string>;
  agencyByCompany: Record<number, boolean>;
  engagementByCompany: Record<number, { views: number; shares: number; total: number }>;
}

export function CompanyList({ companies, creditsByCompany, rolesByCompany, agencyByCompany, engagementByCompany }: CompanyListProps) {
  const [layout, setLayout] = useState<"grid" | "list">("list");
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const toggleTeam = (uuid: string) => {
    setExpandedTeam((prev) => (prev === uuid ? null : uuid));
  };

  if (companies.length === 0) {
    return (
      <Card data-tour="brands-empty">
        <CardContent className="py-16 text-center">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
            No brands yet
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Add your first brand to start creating press releases.
          </p>
          <Link href="/company/add">
            <Button className="mt-6 gap-2 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer">
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
      <div className="flex justify-end" data-tour="brands-layout-toggle">
        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
          <button
            onClick={() => setLayout("grid")}
            className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-l-md cursor-pointer transition-colors ${
              layout === "grid"
                ? "bg-cyan-800/10 dark:bg-cyan-400/10 text-cyan-800 dark:text-cyan-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setLayout("list")}
            className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-r-md border-l border-gray-300 dark:border-gray-700 cursor-pointer transition-colors ${
              layout === "list"
                ? "bg-cyan-800/10 dark:bg-cyan-400/10 text-cyan-800 dark:text-cyan-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {layout === "grid" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((co, index) => {
            const role = rolesByCompany[co.id];
            const canManageTeam = agencyByCompany[co.id] && (role === "owner" || role === "brand_admin");
            const isTeamExpanded = expandedTeam === co.uuid;

            return (
              <div key={co.id} className="space-y-0">
                <Card className={`overflow-hidden flex flex-col ${isTeamExpanded ? "rounded-b-none" : ""}`} {...(index === 0 ? { "data-tour": "brands-first-card" } : {})}>
                  <CardContent className="p-0 flex flex-col flex-1">
                    {/* Logo Header */}
                    <div className="flex items-center justify-center h-32 bg-gray-50 dark:bg-gray-950">
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
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 hover:text-cyan-800 dark:text-cyan-400">
                          {co.companyName}
                        </h3>
                      </Link>
                      {role && (
                        <span className={`mt-1 inline-flex items-center self-start rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role] || ROLE_COLORS.client}`}>
                          {ROLE_LABELS[role] || role}
                        </span>
                      )}
                      {co.website && (
                        <a
                          href={
                            co.website.startsWith("http")
                              ? co.website
                              : `https://${co.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 text-sm text-gray-600 dark:text-gray-400 hover:text-cyan-800 dark:text-cyan-400 flex items-center gap-1"
                        >
                          {co.website.replace(/^https?:\/\//, "")}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {co.city && co.state && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {co.city}, {co.state}
                        </p>
                      )}

                      {/* Credits & Engagement */}
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5" {...(index === 0 ? { "data-tour": "brands-credits" } : {})}>
                          <CreditCard className="h-4 w-4 text-gray-400" />
                          <span
                            className={`font-medium ${(creditsByCompany[co.id] || 0) > 0 ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}
                          >
                            {creditsByCompany[co.id] || 0} credits
                          </span>
                        </div>
                        {engagementByCompany[co.id] && engagementByCompany[co.id].total > 0 && (
                          <div className="flex items-center gap-1.5" title={`${engagementByCompany[co.id].views.toLocaleString()} views, ${engagementByCompany[co.id].shares.toLocaleString()} shares`}>
                            <Eye className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              {engagementByCompany[co.id].total.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-auto pt-4 flex gap-2" {...(index === 0 ? { "data-tour": "brands-actions" } : {})}>
                        <Link href={`/company/${co.uuid}`} className="flex-1">
                          <button className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100">
                            <Edit className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </Link>
                        {canManageTeam && (
                          <button
                            onClick={() => toggleTeam(co.uuid)}
                            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${
                              isTeamExpanded
                                ? "border-cyan-700 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-400"
                                : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100"
                            }`}
                          >
                            <Users className="h-3.5 w-3.5" />
                            Brand Team
                          </button>
                        )}
                        <Link
                          href={`/pr/create?company=${co.uuid}`}
                          className="flex-1"
                        >
                          <button className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-cyan-900 bg-cyan-800 dark:bg-cyan-600 px-3 py-2 text-sm font-medium text-white cursor-pointer transition-colors hover:bg-cyan-900 dark:hover:bg-cyan-700">
                            New Release
                          </button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {isTeamExpanded && (
                  <div className="border border-t-0 border-gray-200 dark:border-gray-800 rounded-b-xl bg-white dark:bg-gray-900 p-4">
                    <TeamSection companyUuid={co.uuid} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {companies.map((co, index) => {
            const role = rolesByCompany[co.id];
            const canManageTeam = agencyByCompany[co.id] && (role === "owner" || role === "brand_admin");
            const isTeamExpanded = expandedTeam === co.uuid;

            return (
              <div key={co.id}>
                <Card className={`overflow-hidden ${isTeamExpanded ? "rounded-b-none" : ""}`} {...(index === 0 ? { "data-tour": "brands-first-card" } : {})}>
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
                          <div className="flex items-center gap-2">
                            <Link href={`/company/${co.uuid}`} className="cursor-pointer">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 hover:text-cyan-800 dark:text-cyan-400 truncate">
                                {co.companyName}
                              </h3>
                            </Link>
                            {role && (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role] || ROLE_COLORS.client}`}>
                                {ROLE_LABELS[role] || role}
                              </span>
                            )}
                          </div>
                          {co.website && (
                            <a
                              href={
                                co.website.startsWith("http")
                                  ? co.website
                                  : `https://${co.website}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 text-sm text-gray-600 dark:text-gray-400 hover:text-cyan-800 dark:text-cyan-400 inline-flex items-center gap-1"
                            >
                              {co.website.replace(/^https?:\/\//, "")}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {co.city && co.state && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {co.city}, {co.state}
                            </p>
                          )}
                          <div className="mt-3 flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1.5" {...(index === 0 ? { "data-tour": "brands-credits" } : {})}>
                              <CreditCard className="h-4 w-4 text-gray-400" />
                              <span
                                className={`font-medium ${(creditsByCompany[co.id] || 0) > 0 ? "text-green-600 dark:text-green-400" : "text-gray-500 dark:text-gray-400"}`}
                              >
                                {creditsByCompany[co.id] || 0} credits
                              </span>
                            </div>
                            {engagementByCompany[co.id] && engagementByCompany[co.id].total > 0 && (
                              <div className="flex items-center gap-1.5" title={`${engagementByCompany[co.id].views.toLocaleString()} views, ${engagementByCompany[co.id].shares.toLocaleString()} shares`}>
                                <Eye className="h-4 w-4 text-gray-400" />
                                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                  {engagementByCompany[co.id].total.toLocaleString()} engagement
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0" {...(index === 0 ? { "data-tour": "brands-actions" } : {})}>
                          <Link href={`/company/${co.uuid}`}>
                            <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100">
                              <Edit className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          </Link>
                          {canManageTeam && (
                            <button
                              onClick={() => toggleTeam(co.uuid)}
                              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
                                isTeamExpanded
                                  ? "border-cyan-700 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-400"
                                  : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100"
                              }`}
                            >
                              <Users className="h-3.5 w-3.5" />
                              Brand Team
                            </button>
                          )}
                          <Link href={`/pr/create?company=${co.uuid}`}>
                            <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium bg-cyan-800 dark:bg-cyan-600 text-white cursor-pointer transition-colors hover:bg-cyan-900 dark:hover:bg-cyan-700">
                              New Release
                            </button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                {isTeamExpanded && (
                  <div className="border border-t-0 border-gray-200 dark:border-gray-800 rounded-b-xl bg-white dark:bg-gray-900 p-4 -mt-0">
                    <TeamSection companyUuid={co.uuid} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
