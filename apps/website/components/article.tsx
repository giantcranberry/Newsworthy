import { sanitizeReleaseBody } from '@/lib/sanitize-body';

type ArticleProps = {
  htmlContent: string;
  pullquote?: string | null;
};

export default function Article({ htmlContent, pullquote }: ArticleProps) {
  let html = sanitizeReleaseBody(htmlContent);

  // Strip the pullquote blockquote from the body since it's displayed separately
  if (pullquote) {
    html = html.replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/i, '');
  }

  return (
    <div
      className="article max-w-none prose prose-gray prose-p:text-base prose-h2:text-xl prose-h3:text-lg prose-li:list-item prose-li:pb-0 prose-li:leading-normal prose-li:my-2 prose-li:marker:text-slate-950 prose-ol:list-decimal prose-a:text-sky-600 hover:prose-a:text-sky-500 prose-strong:text-gray-900 prose-blockquote:text-gray-600"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
