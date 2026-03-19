import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validatePayload }  from '../lib/validator';
import { fetchAllFeeds }    from '../lib/rssFetcher';
import { analyzeWithAI }    from '../lib/aiAnalyzer';
import type { AnalysisResponse, ErrorResponse } from '../types';

function setCORSHeaders(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJSON<T>(res: VercelResponse, status: number, data: T): void {
  res.setHeader('Content-Type', 'application/json');
  setCORSHeaders(res);
  res.status(status).json(data);
}

function sendError(res: VercelResponse, status: number, message: string): void {
  sendJSON<ErrorResponse>(res, status, { error: message });
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {

  if (req.method === 'OPTIONS') {
    setCORSHeaders(res);
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendError(res, 405, 'Method not allowed. Use POST.');
    return;
  }

  let payload: ReturnType<typeof validatePayload>;
  try {
    payload = validatePayload(req.body);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid payload';
    sendError(res, 400, message);
    return;
  }

  const { rssUrls, categories, topN } = payload;

  // 2. FETCH RSS FEEDS IN PARALLEL 
  let articles: Awaited<ReturnType<typeof fetchAllFeeds>>['articles'];
  let failedSources: string[];

  try {
    ({ articles, failedSources } = await fetchAllFeeds(rssUrls));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'RSS ingestion error';
    sendError(res, 500, `RSS ingestion failed: ${message}`);
    return;
  }

  // Early return when no recent news is found
  if (articles.length === 0) {
    const response: AnalysisResponse = {
      results: categories.map((category) => ({ category, trends: [] })),
      meta: {
        totalArticlesProcessed: 0,
        totalSourcesQueried:    rssUrls.length,
        failedSources,
        analyzedAt:             new Date().toISOString(),
        note:                   'No articles found in the last 24 hours.',
      },
    };
    sendJSON(res, 200, response);
    return;
  }

  let categoryResults: Awaited<ReturnType<typeof analyzeWithAI>>;
  try {
    categoryResults = await analyzeWithAI(articles, categories, topN);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI analysis error';
    sendError(res, 500, `AI analysis failed: ${message}`);
    return;
  }

  const response: AnalysisResponse = {
    results: categoryResults,
    meta: {
      totalArticlesProcessed: articles.length,
      totalSourcesQueried:    rssUrls.length,
      failedSources,
      analyzedAt:             new Date().toISOString(),
    },
  };

  sendJSON(res, 200, response);
}
