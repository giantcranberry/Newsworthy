import '../globals.css';

export const metadata = {
  title: 'Newsworthy Content Studio',
  description: 'Author and manage content for Newsworthy',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
