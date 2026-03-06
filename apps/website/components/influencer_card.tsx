import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function influencerCard() {
  return (
    <Card className="bg-blue-700/5 border-0">
      <CardHeader>
        <CardTitle className="font-serif font-medium">
          Join our Influencer Team
        </CardTitle>
        <CardDescription className="text-black">
          You can become an Influencer/Brand Ambassador for
          <strong> RChilli</strong>. Enter your email to receive special
          invitation code.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label>Your Email Address</label>
        <Input type="input" className="mt-2" />
      </CardContent>
      <CardFooter>
        <Button className="bg-green-700 hover:bg-green-800 rounded w-full">
          Join Now
        </Button>
      </CardFooter>
    </Card>
  )
}
