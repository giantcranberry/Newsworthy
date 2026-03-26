import { sanitizeReleaseBody } from '@/lib/sanitize-body';
import React from 'react';

type ArticleProps = {
  htmlContent: string;
  insertAfterParagraph?: number;
  insertContent?: React.ReactNode;
};

const proseClasses = "article max-w-none prose prose-gray prose-p:text-base prose-h2:text-xl prose-h3:text-lg prose-li:list-item prose-li:pb-0 prose-li:leading-normal prose-li:my-2 prose-li:marker:text-slate-950 prose-ol:list-decimal prose-a:text-sky-600 hover:prose-a:text-sky-500 prose-strong:text-gray-900 prose-blockquote:text-gray-600";

export default function Article({ htmlContent, insertAfterParagraph, insertContent }: ArticleProps) {
  const html = sanitizeReleaseBody(htmlContent);

  if (insertAfterParagraph && insertContent) {
    // Split HTML at the Nth closing </p> tag
    const parts: string[] = [];
    let remaining = html;
    let count = 0;
    const regex = /<\/p>/gi;
    let match;

    while ((match = regex.exec(remaining)) !== null) {
      count++;
      if (count === insertAfterParagraph) {
        const splitIndex = match.index + match[0].length;
        parts.push(remaining.slice(0, splitIndex));
        parts.push(remaining.slice(splitIndex));
        break;
      }
    }

    if (parts.length === 2) {
      return (
        <>
          <div
            className={proseClasses}
            dangerouslySetInnerHTML={{ __html: parts[0] }}
          />
          {insertContent}
          <div
            className={proseClasses}
            dangerouslySetInnerHTML={{ __html: parts[1] }}
          />
        </>
      );
    }
  }

  return (
    <div
      className={proseClasses}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
