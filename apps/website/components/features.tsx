import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Feature } from '@/types/Feature'

type FeaturesProps = {
  features: Feature[]
}

export default function Features({ features }: FeaturesProps) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
      {features.map((feature) => (
        <Card
          key={feature.slug.current}
          className="border hover:bg-green-700/5"
        >
          <CardHeader>
            <CardTitle title={feature.title} className="text-2xl lg:text-lg">
              {feature.title}
            </CardTitle>
            <CardDescription className="text-xl lg:text-lg">
              {feature.textContent}
            </CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
