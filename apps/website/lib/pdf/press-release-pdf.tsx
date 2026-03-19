import React from "react";
import { Document, Page, View, Text, Image, Link } from "@react-pdf/renderer";
import Html from "react-pdf-html";
import "./pdf-fonts";
import styles from "./pdf-styles";

export type PdfReleaseData = {
  title: string;
  abstract: string;
  dateline: string;
  body: string;
  pullquote: string | null;
  newsImage: string | null;
  imageCaption: string | null;
  imageCredit: string | null;
  companyName: string;
  companyLogoUrl: string | null;
  companyPhone: string | null;
  companyWebsite: string | null;
  companyCity: string | null;
  companyState: string | null;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  qrcodeUrl: string | null;
  tldr: string[] | null;
  categories: string[];
  pageUrl: string;
  generatedAt: string;
};

const htmlStylesheet = {
  body: {
    fontSize: 10,
    lineHeight: 1.3,
    color: "#1e293b",
    margin: 0,
    padding: 0,
  },
  p: {
    fontSize: 10,
    lineHeight: 1.3,
    margin: 0,
    marginBottom: 4,
    padding: 0,
    color: "#1e293b",
  },
  a: {
    color: "#0284c7",
    textDecoration: "none",
  },
  strong: {
    fontWeight: 700,
  },
  em: {
    color: "#334155",
  },
  h2: {
    fontSize: 13,
    fontWeight: 700,
    margin: 0,
    marginTop: 8,
    marginBottom: 3,
    padding: 0,
    color: "#0f172a",
  },
  h3: {
    fontSize: 11,
    fontWeight: 700,
    margin: 0,
    marginTop: 6,
    marginBottom: 2,
    padding: 0,
    color: "#0f172a",
  },
  ul: {
    margin: 0,
    padding: 0,
  },
  ol: {
    margin: 0,
    padding: 0,
  },
  li: {
    fontSize: 10,
    lineHeight: 1.3,
    margin: 0,
    padding: 0,
  },
  blockquote: {
    borderLeftWidth: 2,
    borderLeftColor: "#0ea5e9",
    marginLeft: 16,
    marginTop: 4,
    marginBottom: 4,
    paddingLeft: 10,
    color: "#334155",
  },
  br: {
    margin: 0,
    padding: 0,
  },
  img: {
    maxWidth: "100%",
    margin: 0,
    marginTop: 4,
    marginBottom: 4,
  },
  ".bullet-item": {
    fontSize: 10,
    lineHeight: 1.3,
    marginLeft: 14,
    marginBottom: 2,
    color: "#1e293b",
  },
};

function isSupportedImage(url: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  // react-pdf only supports PNG and JPG
  if (lower.endsWith(".webp") || lower.endsWith(".svg")) return false;
  return true;
}

function splitAfterFirstParagraph(html: string): [string, string] {
  const match = html.match(/^([\s\S]*?<\/p>)([\s\S]*)$/i);
  if (match) return [match[1], match[2]];
  return [html, ""];
}

function PressReleasePdf({ data }: { data: PdfReleaseData }) {
  const logoSrc = isSupportedImage(data.companyLogoUrl)
    ? data.companyLogoUrl
    : null;
  const imageSrc = isSupportedImage(data.newsImage) ? data.newsImage : null;
  const qrSrc = isSupportedImage(data.qrcodeUrl) ? data.qrcodeUrl : null;

  const [firstParagraph, restOfBody] = splitAfterFirstParagraph(data.body);

  return (
    <Document
      title={data.title}
      author={data.companyName}
      subject="Press Release"
      producer="Newsworthy.ai"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Image
            style={styles.nwLogo}
            src="https://cdn.newsramp.app/nw-logo.png"
          />
          {logoSrc && (
            <Image style={styles.companyLogo} src={logoSrc} />
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>{data.title}</Text>

        {/* Abstract */}
        <Text style={styles.abstract}>{data.abstract}</Text>

        {/* TLDR */}
        {data.tldr && data.tldr.length > 0 && (
          <View style={styles.tldrSection}>
            <Text style={styles.tldrHeading}>Key Takeaways</Text>
            {data.tldr.map((item, i) => (
              <Text key={i} style={styles.tldrItem}>
                {"\u2022"}{"  "}{item}
              </Text>
            ))}
          </View>
        )}

        {/* Dateline */}
        <Text style={styles.dateline}>{data.dateline}</Text>

        {/* Pullquote */}
        {data.pullquote && (
          <View style={styles.pullquote}>
            <Text style={styles.pullquoteText}>"{data.pullquote}"</Text>
          </View>
        )}

        {/* First paragraph */}
        <View style={styles.bodyContainer}>
          <Html stylesheet={htmlStylesheet}>{firstParagraph}</Html>
        </View>

        {/* News Image after 1st paragraph */}
        {imageSrc && (
          <View>
            <Image style={styles.newsImage} src={imageSrc} />
            {data.imageCaption && (
              <Text style={styles.imageCaption}>
                {data.imageCaption}
                {data.imageCredit ? ` — ${data.imageCredit}` : ""}
              </Text>
            )}
          </View>
        )}

        {/* Rest of Body HTML */}
        {restOfBody && (
          <View style={styles.bodyContainer}>
            <Html stylesheet={htmlStylesheet}>{restOfBody}</Html>
          </View>
        )}

        {/* Company Info */}
        <View style={styles.companyInfoSection}>
          <View style={styles.companyInfoLeft}>
            <Text style={styles.companyName}>{data.companyName}</Text>
            {data.companyWebsite && (
              <Link src={data.companyWebsite} style={styles.companyDetail}>
                {data.companyWebsite}
              </Link>
            )}

            {/* Contact */}
            {data.contactName && (
              <View style={styles.contactSection}>
                <Text style={styles.sectionHeading}>Media Contact</Text>
                <View style={styles.divider} />
                <Text style={styles.contactName}>{data.contactName}</Text>
                {data.contactTitle && (
                  <Text style={styles.contactDetail}>{data.contactTitle}</Text>
                )}
                {data.contactEmail && (
                  <Text style={styles.contactDetail}>{data.contactEmail}</Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Categories */}
        {data.categories.length > 0 && (
          <View style={styles.categoriesSection}>
            <Text style={styles.sectionHeading}>Filed Under</Text>
            <View style={styles.divider} />
            <View style={styles.categoriesRow}>
              {data.categories.map((cat) => (
                <Text key={cat} style={styles.categoryPill}>
                  {cat}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* QR Code */}
        {qrSrc && (
          <View style={styles.qrCodeSection}>
            <Image style={styles.qrCode} src={qrSrc} />
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Distributed via{" "}
            <Link src="https://newsworthy.ai">Newsworthy.ai</Link>
          </Text>
          <Text style={styles.footerText}>
            PDF generated {data.generatedAt}
          </Text>
          <Link src={`https://newsworthy.ai${data.pageUrl}`}>
            <Text style={styles.footerUrl}>
              View Online Version
            </Text>
          </Link>
        </View>
      </Page>
    </Document>
  );
}

export default PressReleasePdf;
