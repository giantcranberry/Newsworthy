import type { InferSelectModel } from '@nwai/db'
import {
  releases,
  category,
  company,
  users,
  aiJobs,
  images,
  contact,
  translations,
  banners,
  releaseCategories,
} from '@nwai/db'

type Category = InferSelectModel<typeof category>
type Company = InferSelectModel<typeof company>
type Users = InferSelectModel<typeof users>
type AiJobs = InferSelectModel<typeof aiJobs>
type Images = InferSelectModel<typeof images>
type Contact = InferSelectModel<typeof contact>
type Translations = InferSelectModel<typeof translations>
type Banners = InferSelectModel<typeof banners>

export type ReleaseMonths = {
  year: number;
  month: number;
  language_code: string;
};

export type SiteMapData = {
  slug: string;
  id: number;
  release_datetime: Date | null;
  released_at: Date | null;
  timezone: string;
  title: string;
};

export interface ReleaseCategories {
  category?: {
    id: number;
    name: string;
    slug: string;
  };
  releaseId: number;
  categoryId: number;
}

export type AiMedia = {
  id: number;
  prId: number | null;
  aprS3: string | null;
  ltiMp4S3: string | null;
} | null;

export interface TranslationType {
  prId: number;
  slug: string;
  languageCode: string;
  releaseAt: Date | null;
}

export interface QrCode {
  qrcode: string | null;
}

export interface Takeaways {
  takeaway1: string | null;
  takeaway2: string | null;
  takeaway3: string | null;
}

export interface PressRelease {
  id: number;
  userId: number;
  companyId: number;
  primaryContactId: number | null;
  primaryImageId: number | null;
  slug: string | null;
  uuid: string;
  videoUrl: string | null;
  landingPage: string | null;
  title: string | null;
  publicDrive: string | null;
  abstract: string | null;
  body: string | null;
  pullquote: string | null;
  fir: boolean | null;
  location: string | null;
  score: number | null;
  editorialHold: boolean;
  createdAt: Date | null;
  releaseAt: Date | null;
  releasedAt: Date | null;
  approvedAt: Date | null;
  status: string;
  isArchived: boolean | null;
  isDeleted: boolean | null;
  bannerId: number | null;
  isFeatured: boolean | null;
  isPinned: boolean | null;
  readTime: number | null;
  standardEase: number | null;
  timezone: string | null;
  prhashId: string | null;
  postalcode: string | null;
  clipped: boolean | null;
  elasticDoc: string | null;
  selfHost: boolean | null;
  esReindex: boolean | null;
  releaseCategories: ReleaseCategories[];
  company: Company;
  primaryContact: Contact | null;
  primaryImage: Images | null;
  users: Users;
  banner: Banners | null;
  aiJobs: AiJobs[];
  translations: Translations[];
}

export type PartialReleaseType = {
  id: number;
  title: string;
  releasedAt: Date;
  slug: string;
  selfHost: boolean;
};

export type TrendingType = {
  id: number;
  previous: number;
  current: number;
  movement: number;
  releasedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  release: PartialReleaseType;
};
