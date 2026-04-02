import { sanitizeReleaseBody } from '@/lib/sanitize-body';
import sanitizeHtml from 'sanitize-html';
import React from 'react';

type ArticleProps = {
  htmlContent: string;
  insertAfterParagraph?: number;
  insertContent?: React.ReactNode;
};

const proseClasses = "article max-w-none prose prose-gray prose-p:text-base prose-h2:text-xl prose-h3:text-lg prose-li:list-item prose-li:pb-0 prose-li:leading-normal prose-li:my-2 prose-li:marker:text-slate-950 prose-ol:list-decimal prose-a:text-sky-600 hover:prose-a:text-sky-500 prose-strong:text-gray-900 prose-blockquote:text-gray-600";

const ALLOWED_TAGS = ['p', 'br', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div', 'sub', 'sup', 'u', 's', 'del', 'ins', 'mark', 'abbr', 'cite', 'code', 'pre', 'hr', 'dl', 'dt', 'dd', 'small', 'caption'];

export default function Article({ htmlContent, insertAfterParagraph, insertContent }: ArticleProps) {
  const transformed = sanitizeReleaseBody(htmlContent);
  const html = sanitizeHtml(transformed, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'title', 'class'],
      img: ['src', 'alt', 'title', 'width', 'height', 'class', 'style'],
      td: ['colspan', 'rowspan', 'scope'],
      th: ['colspan', 'rowspan', 'scope'],
      '*': ['class', 'id'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'tel'],
    disallowedTagsMode: 'discard',
  });

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
