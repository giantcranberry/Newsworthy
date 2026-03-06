export interface TranslatedNews {
  id: number;
  prId: number;
  prUuid: string;
  title: string | null;
  abstract: string | null;
  body: string | null;
  pullquote: string | null;
  languageCode: string | null;
  releaseAt: Date | null;
  slug: string | null;
  links: string | null;
  userId?: number;
  elasticDoc?: string;
  uuid?: string;
  dateline?: string;
}
