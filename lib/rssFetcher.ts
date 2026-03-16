// Fetches and parses RSS feeds in parallel, filtering to the last 24 hours

import Parser from 'rss-parser';
import type {
  NewsItem,
  FeedOutcome,
  FetchAllFeedsResult,
} from '../types';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const FEED_TIMEOUT_MS = 10_000;

const parser = new Parser({
  timeout: FEED_TIMEOUT_MS,
  headers: { 'User-Agent': 'RSS-Trends-Analyzer/1.0' },
});

/**
 * Resolves a human-readable source name from the parsed feed or the URL.
 */
function resolveSourceName(feed: Parser.Output<Record<string, unknown>>, url: string): string {
  if (feed.title?.trim()) return feed.title.trim();
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Extracts and normalises articles from a parsed feed,
 * discarding anything older than 24 hours.
 */
function extractArticles(
  feed: Parser.Output<Record<string, unknown>>,
  sourceName: string,
): NewsItem[] {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;

  return (feed.items ?? [])
    .map((item): NewsItem => {
      const rawDate = item.pubDate ?? item.isoDate ?? null;
      const parsedDate = rawDate ? new Date(rawDate) : null;

      return {
        title:       (item.title ?? '').trim(),
        description: (
          (item.contentSnippet ?? item.summary ?? item.content ?? '') as string
        ).trim().slice(0, 500),
        date:        parsedDate?.toISOString() ?? null,
        source:      sourceName,
        url:         item.link ?? item.guid ?? '',
      };
    })
    .filter((article): boolean => {
      if (!article.title) return false;
      // Include articles with no date rather than silently dropping them
      if (!article.date) return true;
      return new Date(article.date).getTime() >= cutoff;
    });
}

/**
 * Fetches a single RSS feed. Never throws — returns a discriminated union.
 */
async function fetchSingleFeed(url: string): Promise<FeedOutcome> {
  try {
    const feed = await parser.parseURL(url);
    const sourceName = resolveSourceName(feed, url);
    const articles = extractArticles(feed, sourceName);
    return { success: true, url, articles };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, url, error: message };
  }
}

/**
 * Fetches all RSS feeds in parallel and aggregates the results.
 * Failed feeds are recorded but do not interrupt the overall process.
 */
export async function fetchAllFeeds(urls: string[]): Promise<FetchAllFeedsResult> {
  const outcomes = await Promise.allSettled(urls.map(fetchSingleFeed));

  const articles: NewsItem[] = [];
  const failedSources: string[] = [];

  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') {
      failedSources.push('unknown — promise rejected unexpectedly');
      continue;
    }

    const result = outcome.value;
    if (result.success) {
      articles.push(...result.articles);
    } else {
      failedSources.push(`${result.url}: ${result.error}`);
    }
  }

  return { articles, failedSources };
}
