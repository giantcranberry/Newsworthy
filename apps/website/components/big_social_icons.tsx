import { Instagram, Linkedin, Music2, Twitter, Youtube } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const svgIcon = "/twitter-x.svg";
const telegram = "https://cdn1.newsworthy.ai/telegram-white.svg";

export default function BigSocialIcons() {
  return (
    <div className="flex items-center justify-center gap-5">
      <div>
        <Link
          href="https://www.linkedin.com/company/newsworthyai"
          title="follow us on Linkedin"
          aria-label="follow us on Linkedin"
          className="flex flex-col items-center no-underline"
        >
          <Linkedin
            size={56}
            className="bg-sky-600 text-white rounded p-3"
            name="Linkedin"
          />
          <p className="!mb-0 leading-none">Linkedin</p>
        </Link>
      </div>

      <div>
        <Link
          href="https://twitter.com/NewsworthyAI"
          title="follow us on Twitter"
          aria-label="follow us on Twitter"
          className="flex flex-col items-center my-0 py-0 no-underline"
        >
          <Image
            src={svgIcon}
            className="w-[56px] h-[56px] bg-black rounded text-white my-0 p-3"
            width={56}
            height={56}
            alt={`Follow us on Twitter`}
          />
          <p className="!mb-0 leading-none">Twitter</p>
        </Link>
      </div>

      <div>
        <Link
          href="https://t.me/NewsworthyAI"
          title="follow us on Telegram"
          aria-label="follow us on Telegram"
          className="flex flex-col items-center my-0 py-0 no-underline"
        >
          <Image
            src={telegram}
            className="w-[56px] h-[56px] bg-sky-500 rounded text-white my-0 p-3"
            width={56}
            height={56}
            alt={`Follow us on Telegram`}
          />
          <p className="!mb-0 leading-none">Telegram</p>
        </Link>
      </div>

      <div>
        <Link
          href="https://www.youtube.com/channel/UCqAWp6V46oRa5lzFYvYf2Dg/"
          title="follow us on YouTube"
          aria-label="follow us on YouTube"
          className="flex flex-col items-center no-underline"
        >
          <Youtube size={56} className="bg-red-600 text-white rounded p-3" />
          <p className="!mb-0 leading-none">YouTube</p>
        </Link>
      </div>
    </div>
  );
}
