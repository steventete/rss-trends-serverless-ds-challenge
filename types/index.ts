// Request 

export interface RequestPayload {
  rssUrls: string[];
  categories: string[];
  topN: number;
}

// RSS / Ingestion 

export interface NewsItem {
  title: string;
  description: string;
  date: string | null;
  source: string;
  url: string;
}

export interface FeedResult {
  success: true;
  url: string;
  articles: NewsItem[];
}

export interface FeedError {
  success: false;
  url: string;
  error: string;
}

export type FeedOutcome = FeedResult | FeedError;

export interface FetchAllFeedsResult {
  articles: NewsItem[];
  failedSources: string[];
}

// AI Analysis

export interface Trend {
  topic: string;
  sourceCount: number;
  sources: string[];
  headlines: string[];
}

export interface CategoryResult {
  category: string;
  trends: Trend[];
}

export interface RawTrend {
  topic: string;
  articleIndices: number[];
  sources?: string[];
  sourceCount?: number;
}

export interface RawCategoryResult {
  category: string;
  trends: RawTrend[];
}

export interface RawAIResponse {
  categories: RawCategoryResult[];
}

// API Response

export interface ResponseMeta {
  totalArticlesProcessed: number;
  totalSourcesQueried: number;
  failedSources: string[];
  analyzedAt: string;
  note?: string;
}

export interface AnalysisResponse {
  results: CategoryResult[];
  meta: ResponseMeta;
}

export interface ErrorResponse {
  error: string;
}
