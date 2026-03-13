import Image from "next/image";
import Link from "next/link";
import { createHash } from "crypto";
import { db, eq, and, lte, desc, count, releases, company as companyTable, releaseEmails } from "@/lib/db";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { newsUrl, removeHtmlTags } from "@/lib/utils";
import Article from "@/components/article";
import { Instagram, Linkedin, Youtube, Globe, FolderOpen, HardDrive, Box } from "lucide-react";

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ page?: string }>;
};

export const revalidate = 0;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const company = await db.query.company.findFirst({
    columns: {
      nrTitle: true,
      nrDesc: true,
      companyName: true,
    },
    where: eq(companyTable.nrUri, handle),
  });

  if (!company) {
    return notFound();
  }

  return {
    title: company.nrTitle || `${company.companyName} Newsroom`,
    description: company.nrDesc || `Latest press releases from ${company.companyName}`,
  };
}

export default async function NewsroomPage({ params, searchParams }: Props) {
  const { handle } = await params;
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const itemsPerPage = 10;
  const company = await db.query.company.findFirst({
    columns: {
      id: true,
      companyName: true,
      nrTitle: true,
      nrDesc: true,
      logoUrl: true,
      website: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      title: true,
      addr1: true,
      addr2: true,
      city: true,
      state: true,
      province: true,
      postalCode: true,
      countryCode: true,
      linkedinUrl: true,
      xUrl: true,
      youtubeUrl: true,
      instagramUrl: true,
      blogUrl: true,
      googleDriveUrl: true,
      boxUrl: true,
      dropboxUrl: true,
      agencyName: true,
      agencyContactName: true,
      agencyContactPhone: true,
      agencyContactEmail: true,
      agencyWebsite: true,
    },
    where: and(
      eq(companyTable.nrUri, handle),
      eq(companyTable.isDeleted, false),
      eq(companyTable.isArchived, false),
    ),
  });

  if (!company) {
    return notFound();
  }

  const currentDatetime = new Date();

  // Get total count for pagination
  const countResult = await db.select({ count: count() }).from(releases).where(
    and(
      eq(releases.companyId, company.id),
      eq(releases.isDeleted, false),
      lte(releases.releasedAt, currentDatetime),
    ),
  );
  const totalCount = countResult[0]?.count ?? 0;

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const releaseList = await db.query.releases.findMany({
    columns: {
      id: true,
      title: true,
      uuid: true,
      slug: true,
      releasedAt: true,
      selfHost: true,
      abstract: true,
      body: true,
      pullquote: true,
      location: true,
      primaryContactId: true,
    },
    with: {
      primaryContact: {
        columns: {
          name: true,
          title: true,
          email: true,
          phone: true,
        },
      },
      banner: {
        columns: {
          cdnUrl: true,
        },
      },
      primaryImage: {
        columns: {
          url: true,
          caption: true,
        },
      },
    },
    where: and(
      eq(releases.companyId, company.id),
      eq(releases.isDeleted, false),
      lte(releases.releasedAt, currentDatetime),
    ),
    orderBy: desc(releases.releasedAt),
    limit: itemsPerPage,
    offset: (page - 1) * itemsPerPage,
  });

  const skip = (page - 1) * itemsPerPage;

  // Build obfuscated email links for each release's primary contact
  const contactEmailLinks = new Map<number, string>();
  for (const release of releaseList) {
    if (release.primaryContact?.email) {
      const emailLower = release.primaryContact.email.toLowerCase().trim();
      const hash = createHash('md5').update(emailLower).digest('hex');
      const existing = await db.query.releaseEmails.findFirst({
        where: eq(releaseEmails.md5Hash, hash),
      });
      if (!existing) {
        await db.insert(releaseEmails).values({
          md5Hash: hash,
          email: emailLower,
        }).onConflictDoNothing();
      }
      contactEmailLinks.set(release.id, `https://newsworthy.email/post/${hash}-${release.id}`);
    }
  }

  const hasAgencyInfo = company.agencyName || company.agencyContactName ||
    company.agencyContactEmail || company.agencyContactPhone || company.agencyWebsite;

  const socialLinks = [
    { url: company.linkedinUrl, icon: Linkedin, label: 'LinkedIn', bgColor: 'bg-sky-600' },
    { url: company.xUrl, icon: null, label: 'X', bgColor: 'bg-black', isX: true },
    { url: company.youtubeUrl, icon: Youtube, label: 'YouTube', bgColor: 'bg-red-600' },
    { url: company.instagramUrl, icon: Instagram, label: 'Instagram', bgColor: 'bg-gradient-to-br from-purple-500 to-pink-500' },
    { url: company.blogUrl, icon: Globe, label: 'Blog', bgColor: 'bg-green-600' },
    { url: company.googleDriveUrl, icon: HardDrive, label: 'Google Drive', bgColor: 'bg-blue-500' },
    { url: company.boxUrl, icon: Box, label: 'Box', bgColor: 'bg-blue-600' },
    { url: company.dropboxUrl, icon: FolderOpen, label: 'Dropbox', bgColor: 'bg-blue-400' },
  ].filter(social => social.url);

  const formatLogoUrl = (url: string | null) => {
    if (!url) return null;
    return url.replace('RESIZE', 'resize=width:200');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {company.logoUrl && (
              <div className="flex-shrink-0">
                <Image
                  src={formatLogoUrl(company.logoUrl)!}
                  alt={`${company.companyName} logo`}
                  width={200}
                  height={100}
                  className="object-contain"
                />
              </div>
            )}
            <div className="flex-grow">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {company.nrTitle || `${company.companyName} Newsroom`}
              </h1>
              {company.nrDesc && (
                <div
                  className="text-gray-600 mb-4 prose prose-gray max-w-none [&>p]:mb-4 [&>p:last-child]:mb-0"
                  dangerouslySetInnerHTML={{ __html: company.nrDesc }}
                />
              )}
              {company.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Visit Website →
                </a>
              )}

              {socialLinks.length > 0 && (
                <div className="flex items-center gap-3 mt-4">
                  {socialLinks.map((social) => (
                    <a
                      key={social.label}
                      href={social.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Visit us on ${social.label}`}
                      aria-label={`Visit us on ${social.label}`}
                      className="group"
                    >
                      {social.isX ? (
                        <div className={`w-10 h-10 ${social.bgColor} rounded flex items-center justify-center text-white hover:opacity-80 transition-opacity`}>
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                          </svg>
                        </div>
                      ) : (
                        <div className={`w-10 h-10 ${social.bgColor} rounded flex items-center justify-center text-white hover:opacity-80 transition-opacity`}>
                          {social.icon && <social.icon size={20} />}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          {hasAgencyInfo && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Agency of Record</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  {company.agencyName && (
                    <p className="text-gray-900 font-medium">{company.agencyName}</p>
                  )}
                  {company.agencyContactName && (
                    <p className="text-gray-600">{company.agencyContactName}</p>
                  )}
                  {company.agencyWebsite && (
                    <a
                      href={company.agencyWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Visit Website
                    </a>
                  )}
                </div>
                <div>
                  {company.agencyContactEmail && (
                    <p className="text-gray-600">
                      <a href={`mailto:${company.agencyContactEmail}`} className="text-blue-600 hover:text-blue-800">
                        {company.agencyContactEmail}
                      </a>
                    </p>
                  )}
                  {company.agencyContactPhone && (
                    <p className="text-gray-600">{company.agencyContactPhone}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Press Releases</h2>
          {releaseList.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-500">No press releases available at this time.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {releaseList.map((release) => (
                  <div key={release.id} className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row gap-4">
                      {release.banner?.cdnUrl && (
                        <div className="flex-shrink-0">
                          <Image
                            src={release.banner.cdnUrl}
                            alt={release.title || "Press release image"}
                            width={150}
                            height={100}
                            className="rounded object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-grow">
                        <div className="flex items-start justify-between">
                          <div>
                            <Link
                              href={newsUrl(release)}
                              className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                            >
                              {release.title}
                            </Link>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <time dateTime={release.releasedAt!.toISOString()}>
                                {release.releasedAt!.toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </time>
                              {release.location && (
                                <>
                                  <span>•</span>
                                  <span>{release.location}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="mt-3 text-gray-600 line-clamp-2">
                          {release.abstract}
                        </p>
                        {release.primaryContact && (
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-sm text-gray-500">
                              <span className="font-medium">Contact:</span> {release.primaryContact.name}
                              {release.primaryContact.title && <span> - {release.primaryContact.title}</span>}
                              {contactEmailLinks.has(release.id) && (
                                <span> • <a href={contactEmailLinks.get(release.id)} className="text-blue-600 hover:text-blue-800">
                                  Email Contact
                                </a></span>
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex justify-center">
                  <nav className="flex items-center gap-2">
                    {page > 1 && (
                      <Link
                        href={`/newsroom/${handle}?page=${page - 1}`}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Previous
                      </Link>
                    )}

                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                        if (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          (pageNum >= page - 1 && pageNum <= page + 1)
                        ) {
                          return (
                            <Link
                              key={pageNum}
                              href={`/newsroom/${handle}?page=${pageNum}`}
                              className={`px-3 py-2 text-sm font-medium rounded-md ${
                                pageNum === page
                                  ? 'bg-blue-600 text-white'
                                  : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {pageNum}
                            </Link>
                          );
                        } else if (
                          pageNum === page - 2 ||
                          pageNum === page + 2
                        ) {
                          return <span key={pageNum} className="px-2 py-2 text-gray-500">...</span>;
                        }
                        return null;
                      })}
                    </div>

                    {page < totalPages && (
                      <Link
                        href={`/newsroom/${handle}?page=${page + 1}`}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Next
                      </Link>
                    )}
                  </nav>
                </div>
              )}

              <div className="mt-4 text-center text-sm text-gray-600">
                Showing {skip + 1}-{Math.min(skip + itemsPerPage, totalCount)} of {totalCount} releases
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
