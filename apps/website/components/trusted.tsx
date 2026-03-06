import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { HelpCircle } from 'lucide-react'

export default function TrustedDialog() {
  return (
    <Dialog>
      <DialogTrigger className="hover:underline text-sm text-left flex items-center">
        <HelpCircle size={25} className="text-green-700 pr-2" />
        Trusted Redirect Enabled
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-semibold">
            Trusted Redirect (Self-Hosted Press Releases)
          </DialogTitle>
          <DialogDescription className="grid gap-3 text-stone-900">
            <p>
              Self-hosting of press releases is a free service provided by
              Newsworthy.ai to its customers.
            </p>
            <p>
              Newsworthy.ai is the only press release wire service that allows
              you to self-host your press releases. This means that you benefit
              from the traffic and have more control over the customer journey.
              This self-hosting is made possible because Newsworthy pushes the
              validation process to the blockchain. The blockchain serves as the
              &quot;source of truth&quot; for these press releases.
            </p>
            <p>
              (PLEASE NOTE — You will be taken away from Newsworthy.ai when you
              click on this headline.)
            </p>
            <p>Join the revolution in News Distribution by signing up today.</p>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
