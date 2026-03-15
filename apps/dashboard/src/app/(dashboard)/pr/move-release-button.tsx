"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
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

interface Brand {
  id: number;
  name: string;
}

export function MoveReleaseButton({
  uuid,
  title,
  currentCompanyId,
  brands,
}: {
  uuid: string;
  title: string | null;
  currentCompanyId: number;
  brands: Brand[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [targetCompanyId, setTargetCompanyId] = useState<number | "">("");

  const otherBrands = brands.filter((b) => b.id !== currentCompanyId);

  if (otherBrands.length === 0) return null;

  async function handleMove() {
    if (!targetCompanyId) return;
    setIsMoving(true);
    try {
      const res = await fetch(`/api/pr/${uuid}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCompanyId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to move release");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      alert("Failed to move release");
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTargetCompanyId(""); }}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100">
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Move
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Release</DialogTitle>
          <DialogDescription>
            Move &ldquo;{title || "Untitled Release"}&rdquo; to a different brand.
            The media contact will be copied to the new brand.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <label htmlFor="target-brand" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Target Brand
          </label>
          <select
            id="target-brand"
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
            value={targetCompanyId}
            onChange={(e) => setTargetCompanyId(e.target.value ? parseInt(e.target.value) : "")}
          >
            <option value="">Select a brand...</option>
            {otherBrands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
            Cancel
          </Button>
          <Button
            className="cursor-pointer bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
            onClick={handleMove}
            disabled={isMoving || !targetCompanyId}
          >
            {isMoving ? "Moving..." : "Move Release"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
