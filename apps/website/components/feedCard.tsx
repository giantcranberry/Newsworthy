import Link from "next/link";
import Image from "next/image";

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
    <article className="group">
      <Link href={link} className="block">
        {/* Image */}
        <div className="rounded-xl overflow-hidden bg-gray-100 aspect-[16/10]">
          <Image
            src={newsImage}
            width={600}
            height={375}
            className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
            alt={title}
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          />
        </div>

        {/* Text */}
        <div className="mt-4 space-y-2">
          <h3 className="font-serif text-lg font-semibold text-gray-900 leading-snug group-hover:text-cyan-700 transition-colors line-clamp-2">
            {title}
          </h3>
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
            {abstract}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-cyan-600 transition-colors">
            Read full story
            <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </div>
      </Link>
    </article>
  );
}
