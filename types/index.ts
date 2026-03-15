// Request 

export interface RequestPayload {
  /** List of RSS feed URLs to fetch */
  rssUrls: string[];
  /** Categories to classify news into */
  categories: string[];
  /** Number of top trends to return per category */
  topN: number;
}

// RSS / Ingestion 

export interface NewsItem {
  title: string;
  description: string;
  /** ISO 8601 date string, or null if unavailable */
  date: string | null;
  /** Human-readable source name (feed title or hostname) */
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
  /** Short description of the detected topic (≤10 words) */
  topic: string;
  /** Number of distinct sources covering this topic */
  sourceCount: number;
  /** List of source names covering this topic */
  sources: string[];
  /** Representative headlines from related articles */
  headlines: string[];
}

export interface CategoryResult {
  category: string;
  trends: Trend[];
}

/** Raw structure returned by Claude before enrichment */
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
