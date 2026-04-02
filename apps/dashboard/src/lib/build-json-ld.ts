export interface JsonLdCompanyData {
  companyName: string
  website: string
  logoUrl: string
  phone: string
  email: string
  addr1: string
  addr2: string
  city: string
  state: string
  postalCode: string
  countryCode: string
  linkedinUrl: string
  xUrl: string
  youtubeUrl: string
  instagramUrl: string
  blogUrl: string
}

export function buildJsonLd(data: JsonLdCompanyData) {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.companyName,
  }

  if (data.website) jsonLd.url = data.website
  if (data.logoUrl) jsonLd.logo = data.logoUrl
  if (data.phone) jsonLd.telephone = data.phone
  if (data.email) jsonLd.email = data.email

  const hasAddress = data.addr1 || data.city || data.state || data.postalCode
  if (hasAddress) {
    const address: Record<string, string> = {
      '@type': 'PostalAddress',
    }
    if (data.addr1) address.streetAddress = data.addr2 ? `${data.addr1}, ${data.addr2}` : data.addr1
    if (data.city) address.addressLocality = data.city
    if (data.state) address.addressRegion = data.state
    if (data.postalCode) address.postalCode = data.postalCode
    if (data.countryCode) address.addressCountry = data.countryCode
    jsonLd.address = address
  }

  const sameAs = [
    data.linkedinUrl,
    data.xUrl,
    data.youtubeUrl,
    data.instagramUrl,
    data.blogUrl,
  ].filter(Boolean)

  if (sameAs.length > 0) jsonLd.sameAs = sameAs

  return jsonLd
}
