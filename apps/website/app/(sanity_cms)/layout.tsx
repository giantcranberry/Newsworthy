import '../globals.css';
import MicrosoftClarity from '@/components/MicrosoftClarity';

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
      <body suppressHydrationWarning>
        <MicrosoftClarity />
        {children}
      </body>
    </html>
  )
}
