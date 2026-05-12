"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FaIcon } from "@/components/ui/fa-icon"
import { faTicket } from "@awesome.me/kit-adf47b9acf/icons/duotone/light"

export function RedeemCourtesyCode({ variant = "card" }: { variant?: "card" | "link" }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ credits: number } | null>(null)

  async function handleRedeem() {
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/credits/redeem-courtesy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to redeem code")
        return
      }

      setSuccess({ credits: data.credits })
      setTimeout(() => {
        setOpen(false)
        window.location.reload()
      }, 2000)
    } catch {
      setError("Failed to redeem code")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setCode(""); setError(""); setSuccess(null) } }}>
      <DialogTrigger asChild>
        {variant === "link" ? (
          <button className="text-xs text-violet-600 hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300 font-medium cursor-pointer">
            Redeem Courtesy Code
          </button>
        ) : (
          <button
            className="flex flex-col items-center justify-center gap-2 sm:gap-3 rounded-xl border border-violet-500 bg-violet-500/10 p-3 sm:p-4 text-center transition-colors hover:bg-violet-500/20 cursor-pointer"
          >
            <FaIcon icon={faTicket} className="h-6 w-6 sm:h-8 sm:w-8 text-violet-500" />
            <span className="text-sm font-semibold text-violet-500">Redeem Courtesy Code</span>
          </button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redeem Courtesy Code</DialogTitle>
          <DialogDescription>
            Enter your courtesy code to receive credits.
          </DialogDescription>
        </DialogHeader>
        {success ? (
          <div className="py-4 text-center">
            <p className="text-green-600 font-medium">
              {success.credits} credit{success.credits !== 1 ? "s" : ""} added to your account!
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div>
              <Input
                placeholder="nw-xxxxxxxxxxxxxx"
                value={code}
                onChange={(e) => { setCode(e.target.value); setError("") }}
                disabled={loading}
              />
              {error && (
                <p className="text-sm text-red-500 mt-2">{error}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRedeem}
                disabled={loading || !code.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white"
              >
                {loading ? "Redeeming..." : "Redeem"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
