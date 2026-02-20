"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RetractReleaseButton({
  uuid,
  title,
}: {
  uuid: string;
  title: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isRetracting, setIsRetracting] = useState(false);

  async function handleRetract() {
    setIsRetracting(true);
    try {
      const res = await fetch(`/api/pr/${uuid}/retract`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to retract release");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      alert("Failed to retract release");
    } finally {
      setIsRetracting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="cursor-pointer gap-1.5 text-amber-600 border-amber-300 hover:text-amber-700 hover:bg-amber-50">
          <Undo2 className="h-3.5 w-3.5" />
          Retract
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retract Release</DialogTitle>
          <DialogDescription>
            Are you sure you want to retract &ldquo;{title || "Untitled Release"}
            &rdquo; from editorial review? It will be moved back to your drafts
            so you can make changes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
            Cancel
          </Button>
          <Button onClick={handleRetract} disabled={isRetracting} className="cursor-pointer bg-cyan-800 text-white hover:bg-cyan-900">
            {isRetracting ? "Retracting..." : "Retract & Edit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
