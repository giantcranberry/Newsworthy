"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface WelcomeDialogProps {
  open: boolean
  onSkip: () => void
  onStartTour: () => void
}

export function WelcomeDialog({ open, onSkip, onStartTour }: WelcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onSkip() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan-50 mb-2">
            <i className="fa-light fa-compass text-2xl text-cyan-700" aria-hidden="true" />
          </div>
          <DialogTitle className="text-center text-xl">Welcome to Newsworthy!</DialogTitle>
          <DialogDescription className="text-center text-gray-600">
            Your press release distribution platform. Would you like a quick guided tour to get familiar with the dashboard and key features?
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onSkip}
            className="cursor-pointer"
          >
            Skip for Now
          </Button>
          <Button
            onClick={onStartTour}
            className="bg-cyan-800 hover:bg-cyan-900 text-white cursor-pointer gap-2"
          >
            <i className="fa-light fa-compass text-sm" aria-hidden="true" />
            Take the Tour
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
