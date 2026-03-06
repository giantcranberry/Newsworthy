'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PreviewPanel } from './preview-panel'

interface PreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  release?: {
    uuid: string
    title?: string | null
    abstract?: string | null
    body?: string | null
    location?: string | null
    videoUrl?: string | null
  }
  company?: {
    logoUrl?: string | null
    companyName?: string | null
  }
  banner?: { url: string; caption?: string | null } | null
  images?: { id: number; url: string; caption?: string | null }[]
}

export function PreviewDialog({
  open,
  onOpenChange,
  release,
  company,
  banner,
  images,
}: PreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-medium">Press Release Preview</DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(90vh-80px)] overflow-y-auto">
          <PreviewPanel
            release={release}
            company={company}
            banner={banner}
            images={images}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
