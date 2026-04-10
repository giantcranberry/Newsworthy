"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

export function ContactAdminButton({
  uuid,
  title,
}: {
  uuid: string;
  title: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    if (!message.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/pr/${uuid}/contact-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to send message");
        return;
      }
      setMessage("");
      setOpen(false);
      router.refresh();
    } catch {
      alert("Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="cursor-pointer gap-1.5 text-blue-600 border-blue-300 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50">
          <MessageSquare className="h-3.5 w-3.5" />
          Contact Admin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact Admin</DialogTitle>
          <DialogDescription>
            Send a message to the editorial team about &ldquo;{title || "Untitled Release"}&rdquo;.
            This release has been approved and cannot be retracted.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Type your message here..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={isSending || !message.trim()}
            className="cursor-pointer bg-blue-600 text-white hover:bg-blue-700"
          >
            {isSending ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
