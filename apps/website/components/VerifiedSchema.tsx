import Script from "next/script";

const SITE_ID = "7bdf1aec-7de6-4bb8-a310-adf015bfb97c";

export default function VerifiedSchema() {
  return (
    <Script
      async
      src={`https://sdb.verifiedschema.com/v.js?site=${SITE_ID}`}
      data-site={SITE_ID}
      strategy="beforeInteractive"
    />
  );
}
