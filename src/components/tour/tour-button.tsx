"use client"

import { usePathname } from "next/navigation"
import { useTour } from "@/hooks/use-tour"

interface RouteConfig {
  tourId: string
  label: string
  resolver?: () => string
}

const routeTourMap: Record<string, RouteConfig> = {
  "/dashboard": { tourId: "dashboard", label: "Quick Guide: Dashboard" },
  "/admin": { tourId: "admin", label: "Quick Guide: Admin" },
  "/pr": { tourId: "pr", label: "Quick Guide: Press Releases" },
  "/pr/create": { tourId: "pr-create", label: "Quick Guide: Release Editor" },
  "/pr/drafts": { tourId: "drafts", label: "Quick Guide: Drafts" },
  "/pr/reports": { tourId: "reports", label: "Quick Guide: Reports" },
  "/company": { tourId: "brands", label: "Quick Guide: Brands" },
  "/company/add": { tourId: "brand-add", label: "Quick Guide: Add Brand" },
  "/editorial/queue": { tourId: "editorial-queue", label: "Quick Guide: Review Queue" },
  "/editorial/queue-enhanced": { tourId: "enhanced-queue", label: "Quick Guide: Enhanced Queue" },
  "/editorial/pending": { tourId: "pending", label: "Quick Guide: Pending Releases" },
  "/editorial/released-edit": { tourId: "released-edit", label: "Quick Guide: Edit Released" },
  "/admin/users": { tourId: "admin-users", label: "Quick Guide: User Management" },
  "/admin/brands": { tourId: "admin-brands", label: "Quick Guide: Brand Management" },
  "/admin/partners": { tourId: "admin-partners", label: "Quick Guide: Partners" },
  "/admin/products": { tourId: "admin-products", label: "Quick Guide: Products" },
  "/admin/categories": { tourId: "admin-categories", label: "Quick Guide: Categories" },
  "/admin/email-templates": { tourId: "admin-email-templates", label: "Quick Guide: Email Templates" },
  "/partner": { tourId: "partner", label: "Quick Guide: Partner" },
  "/partner/releases": { tourId: "partner-releases", label: "Quick Guide: Partner Releases" },
  "/partner/users": { tourId: "partner-users", label: "Quick Guide: Partner Users" },
  "/profile": { tourId: "profile", label: "Quick Guide: Profile" },
  "/admin/tasks": { tourId: "admin-tasks", label: "Quick Guide: Task Board" },
  "/admin/messages": {
    tourId: "admin-messages",
    label: "Quick Guide: Messages",
    resolver: () => {
      const el = document.querySelector("[data-tour-active-tab]")
      return el?.getAttribute("data-tour-active-tab") === "sent"
        ? "admin-messages-sent"
        : "admin-messages"
    },
  },
}

export function TourFab() {
  const pathname = usePathname()
  const { startTour } = useTour()

  const route = routeTourMap[pathname]
  if (!route) return null

  const handleClick = () => {
    const tourId = route.resolver ? route.resolver() : route.tourId
    startTour(tourId)
  }

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-cyan-800 text-white text-sm font-medium shadow-lg hover:bg-cyan-900 cursor-pointer transition-all hover:shadow-xl"
    >
      <i className="fa-light fa-compass text-base" aria-hidden="true" />
      {route.label}
      <i className="fa-solid fa-arrow-right text-xs animate-bounce-x" aria-hidden="true" />
    </button>
  )
}
