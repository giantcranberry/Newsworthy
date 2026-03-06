import Image from "next/image";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function FreePrReview() {
  return (
    <Card className="bg-gradient-to-br from-emerald-700/20 to-amber-500/30 border-0 flex flex-col relative overflow-hidden h-full xl:max-h-96">
      <CardHeader className="flex flex-col gap-3">
        <Image
          src={
            "https://cdn1.newsworthy.ai/expert-pr-reviews/expert-pr-review-logo.svg"
          }
          className=""
          width={280}
          height={1}
          alt=""
        />
        <CardTitle className="font-serif font-normal text-4xl">
          Free Expert Press Release Review
        </CardTitle>

        <CardDescription className="font-sans font-normal text-xl text-black">
          Unlock the Marketing Magic in Your PR with David McInnis
        </CardDescription>
      </CardHeader>

      <Image
        src={"https://cdn1.newsworthy.ai/expert-pr-reviews/pr-expert-david.png"}
        className="hidden md:flex absolute bottom-0 -right-2 xl:top-48"
        width={180}
        height={1}
        alt=""
      />
      <CardFooter className="flex gap-3 items-start mt-0">
        <Link
          href="https://tidycal.com/newsmarketer/expert-press-release-review"
          className="bg-green-700 py-2 px-3 border-2 border-green-700 text-white text-center hover:bg-green-800 hover:border-green-800 rounded text-lg font-semibold w-40"
        >
          Book Now
        </Link>
      </CardFooter>
    </Card>
  );
}
