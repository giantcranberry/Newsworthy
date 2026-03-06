import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function subscribeCard() {
  return (
    <Card className="bg-yellow-500/10 border-0">
      <CardHeader>
        <CardTitle className="font-serif font-medium">
          Subscribe to News
        </CardTitle>
        <CardDescription className="text-black">
          Be the first to know. Receive press releases alerts from{' '}
          <strong>RChilli</strong> to your email inbox or via text message.
        </CardDescription>
      </CardHeader>
      <CardContent></CardContent>
      <CardFooter></CardFooter>
    </Card>
  )
}
