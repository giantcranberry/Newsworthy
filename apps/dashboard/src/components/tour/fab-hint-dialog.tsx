"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface FabHintDialogProps {
  open: boolean
  onDismiss: () => void
}

export function FabHintDialog({ open, onDismiss }: FabHintDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onDismiss() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">Quick Guide Available on Every Page</DialogTitle>
          <DialogDescription className="text-center text-gray-600 dark:text-gray-400">
            Look for this button in the bottom-right corner of any page. Click it anytime you need help understanding what&apos;s on screen.
          </DialogDescription>
        </DialogHeader>

        {/* Illustration of the FAB button */}
        <div className="flex justify-center py-4">
          <div className="relative rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-12 py-10">
            <div className="flex items-center gap-2 rounded-full bg-cyan-800 dark:bg-cyan-600 px-4 py-2.5 text-white text-sm font-medium shadow-lg">
              <i className="fa-light fa-compass text-base" aria-hidden="true" />
              Quick Guide: Dashboard
              <i className="fa-solid fa-arrow-right text-xs animate-bounce-x" aria-hidden="true" />
            </div>
            {/* Pointer arrow */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
              <i className="fa-solid fa-arrow-up text-cyan-700 text-lg animate-bounce" aria-hidden="true" />
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          The label changes based on which page you&apos;re viewing.
        </p>

        <div className="flex justify-center pt-2">
          <Button
            onClick={onDismiss}
            className="bg-cyan-800 dark:bg-cyan-600 hover:bg-cyan-900 dark:hover:bg-cyan-700 text-white cursor-pointer"
          >
            Got It
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
