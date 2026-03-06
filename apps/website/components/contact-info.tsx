import Link from "next/link";

export default function ContactInfo() {
  return (
    <div>
      <p>
        607 E. Blanco Rd
        <br />
        Box 2036
        <br />
        Boerne, Texas 78006
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
