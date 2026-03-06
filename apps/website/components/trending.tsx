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

export default function TrendingDialog() {
  return (
    <Dialog>
      <DialogTrigger className="text-lg font-extrabold tracking-wide text-left uppercase hover:underline flex items-center">
        <span className="hover:underline text-cyan-800">Trending News</span>
        <HelpCircle size={25} className="text-blue-700 pl-2" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-semibold">
            Trending News
          </DialogTitle>
          <DialogDescription className="grid gap-3 text-stone-900">
            <p>
              Trending News is a list of the most popular press releases. Trend
              data is recalculated every 4 hours.
            </p>
            <p>
              Trending news is calculated by the number of views, clicks, and
              shares a press release receives. Our Trending algorithm rewards
              companies and press releases that take advantage of our platform
              advocacy tools, release frequency, editorial score and image
              quality. Companies can influence their trending score by using our
              free features like advocacy tools, self hosting. Read how you can
              improve your trending score by reading this blog post.
            </p>
            <p>Join the revolution in News Distribution by signing up today.</p>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}
