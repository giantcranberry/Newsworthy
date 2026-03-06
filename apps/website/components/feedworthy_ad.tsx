import { getSiteAdBySlug } from '@/sanity/sanity-utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default async function feedworthyAd() {
  const feedworthy_ad = await getSiteAdBySlug('feedworthy')
  return (
    <Card className="bg-green-700/10 border-0">
      <CardHeader>
        <CardTitle className="font-serif font-medium">
          {feedworthy_ad.title}
        </CardTitle>
        <CardDescription className="text-black">
          {feedworthy_ad.textContent}
        </CardDescription>
      </CardHeader>
      <CardContent></CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button className="bg-orange-400 hover:bg-green-800 rounded w-full">
          Register at Feedworthy
        </Button>
      </CardFooter>
    </Card>
  )
}
