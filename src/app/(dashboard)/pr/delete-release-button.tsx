"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
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

export function DeleteReleaseButton({
  uuid,
  title,
}: {
  uuid: string;
  title: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/pr/${uuid}/delete`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete release");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      alert("Failed to delete release");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 cursor-pointer transition-colors hover:text-red-700 hover:bg-red-50">
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Release</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &ldquo;{title || "Untitled Release"}
            &rdquo;? Any credits used for this release will be returned to your
            account.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
            Cancel
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer border-red-400 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
