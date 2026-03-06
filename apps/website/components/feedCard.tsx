import React from "react";

import {
  Card,
  CardDescription,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { getImageAspectRatio, getImageClasses } from "@/lib/image-utils";

interface FeedProps {
  link: string;
  title: string;
  abstract: string;
  newsImage: string;
}

export default function FeedCard({
  link,
  title,
  abstract,
  newsImage,
}: FeedProps) {
  return (
    <Card className="h-full border-0 shadow-none">
      <CardContent className="flex flex-col flex-1 gap-3 max-w-none prose prose-h3:my-0 prose-a:text-stone-900 prose-a:no-underline prose-a:font-semibold prose-h3:text-lg hover:prose-a:text-sky-700 prose-p:text-stone-900 prose-p:text-base prose-p:font-medium prose-p:mt-3 prose-img:my-0 p-0">
        <div className="overflow-hidden w-full flex-none rounded-t-lg">
          <Link href={link}>
            <Image
              src={newsImage}
              width={300}
              height={180}
              className={getImageClasses(
                getImageAspectRatio(300, 180),
                "w-full h-[180px] rounded-lg object-cover object-top"
              )}
              alt={title}
              sizes="100vw"
            />
          </Link>
        </div>
        <div className="flex flex-col justify-between flex-auto pt-2 pb-3">
          <CardTitle>
            <Link href={link}>{title}</Link>
          </CardTitle>
          <div>
            <CardDescription className="line-clamp-3">
              {abstract}
            </CardDescription>
            <Link href={link} className="flex items-center gap-1">
              Read the full story
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
