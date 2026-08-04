"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Copy,
  ExternalLink,
  File,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface Asset {
  uuid: string;
  filename: string;
  url: string;
  mimeType: string;
  filesize: number;
  description: string | null;
  createdAt: string;
}

interface AssetsListProps {
  assets: Asset[];
}

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetsList({ assets }: AssetsListProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const resetAddDialog = () => {
    setSelectedFile(null);
    setDescription("");
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (description.trim()) formData.append("description", description.trim());

      const res = await fetch("/api/admin/assets", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload asset");
      }

      setShowAddDialog(false);
      resetAddDialog();
      toast.success("Asset uploaded");
      router.refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(
        `/api/admin/assets?uuid=${encodeURIComponent(deleteTarget.uuid)}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete asset");
      }

      toast.success("Asset deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setShowAddDialog(true)}
          className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Asset
        </Button>
      </div>

      {assets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              No assets yet
            </h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Upload your first asset to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Asset
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Size
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                    Uploaded
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr
                    key={asset.uuid}
                    className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {asset.mimeType.startsWith("image/") ? (
                          <img
                            src={asset.url}
                            alt={asset.filename}
                            className="h-10 w-10 rounded object-cover bg-gray-100 dark:bg-gray-800 flex-shrink-0"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                            <File className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-xs">
                            {asset.filename}
                          </p>
                          {asset.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                              {asset.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {asset.mimeType}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatBytes(asset.filesize)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleCopyUrl(asset.url)}
                          title="Copy URL"
                          className="p-2 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer transition-colors"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <a
                          href={asset.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in new tab"
                          className="p-2 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 cursor-pointer transition-colors"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => setDeleteTarget(asset)}
                          title="Delete"
                          className="p-2 rounded text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          setShowAddDialog(open);
          if (!open) resetAddDialog();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Asset</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            {uploadError && (
              <div className="bg-red-50 text-red-600 dark:text-red-400 p-3 rounded text-sm">
                {uploadError}
              </div>
            )}
            <div>
              <Label htmlFor="asset-file">File *</Label>
              <Input
                id="asset-file"
                ref={fileInputRef}
                type="file"
                required
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
              {selectedFile && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {selectedFile.name} ({formatBytes(selectedFile.size)})
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="asset-description">Description</Label>
              <Input
                id="asset-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
                placeholder="What is this asset for?"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUploading || !selectedFile}
                className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {deleteTarget?.filename} from object
              storage. Anything referencing its URL will break.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
