import { ReleasePreviewSidebar } from "./release-preview-sidebar";

export default function ReleaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        {children}
      </div>
      <ReleasePreviewSidebar />
    </div>
  );
}
