// components/Article.server.tsx
import { parse, HTMLElement } from "node-html-parser";
import * as cheerio from "cheerio";
import { ExternalLink, Quote } from "lucide-react";

type ArticleProps = {
  htmlContent: string;
  newsImage?: string | null;
  pullQuote: string | null;
  imageCaption: string | null;
  imageCredit?: string | null;
};

export default function Article({
  htmlContent,
  newsImage,
  pullQuote,
  imageCaption,
  imageCredit,
}: ArticleProps) {
  const insertImage = (html: string, imageUrl?: string | null): string => {
    const $ = cheerio.load(html);
    const paragraphs = $("p");

    if (paragraphs.length > 0) {
      // Insert image after first paragraph
      if (imageUrl) {
        const captionWordCount = imageCaption ? imageCaption.trim().split(/\s+/).length : 0;
        const captionAlign = captionWordCount < 15 ? 'center' : 'left';
        const image = `<figure style="display: flex; flex-direction: column; justify-content: center; margin-bottom: 1rem;">
            <img src="${imageUrl}" style="border-radius: 10px; margin: 0 auto 0.5rem; max-height: 50vh; max-width: 50%; height: auto; object-fit: contain; display: block;" alt="${imageCaption || 'Press release image'}">
            ${imageCaption ? `<figcaption style="text-align: ${captionAlign}; font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem; padding-top: 0;">${imageCaption}${imageCredit ? ` <span style="font-style: italic; color: #9ca3af;">(Image Credit: ${imageCredit})</span>` : ''}</figcaption>` : ''}
            </figure>`;
        $(paragraphs[0]).after(image);
      }

      // Insert pullquote after first paragraph (above the image)
      if (pullQuote) {
        const quote = `<div style="margin: 10px 0;">
                <blockquote style="border: none; font-size: 1.25rem; line-height: 1.75rem; font-style: italic; color: #0d9488; width: 100%;">
                    ${pullQuote}
                </blockquote>
            </div>`;
        $(paragraphs[0]).after(quote);
      }
    }

    return $.html();
  };

  const modifiedHtml = insertImage(htmlContent, newsImage);

  return (
    <>
      <div
        className="article max-w-none prose prose-p:font-body prose-p:text-base prose-p:text-black prose-li:list-item prose-li:pb-0 prose-li:marker:text-slate-950 prose-ol:list-decimal prose-h2:text-xl"
        dangerouslySetInnerHTML={{ __html: modifiedHtml }}
      />
    </>
  );
}
