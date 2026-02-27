export default function PublicReportLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white">
      <div className="px-4 py-8">{children}</div>
    </div>
  )
}
