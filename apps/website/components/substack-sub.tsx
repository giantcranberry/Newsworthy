import Image from "next/image";
import Link from "next/link";

interface SubstackSubProps {
  imagePath: string;
  altText: string;
  link: string;
}

export default function SubstackSub({
  link,
  altText,
  imagePath,
}: SubstackSubProps) {
  return (
    <Link href={link} target="_blank">
      <Image
        className="shadow hover:shadow-xl hover:-translate-y-1 duration-500 ease-in-out"
        src={imagePath}
        width={300}
        height={1}
        alt={altText}
      />
    </Link>
  );
}
