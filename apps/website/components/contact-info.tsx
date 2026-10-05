import Link from "next/link";

export default function ContactInfo() {
  return (
    <div>
      <p>
        PO Box 94
        <br />
        Granbury, Texas 76048
        <br />
        <br />
        <Link
          href="mailto:support@newsworthy.ai"
          className="hover:text-sky-700"
        >
          Email Support
        </Link>
      </p>
    </div>
  );
}
