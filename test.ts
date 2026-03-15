// tests/test.ts
// Local integration test — run with: npm test

import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AnalysisResponse, ErrorResponse } from '../types';
import handler from '../api/analyze';

// ── Test payload ─────────────────────────────────────────────────────────────

const TEST_PAYLOAD = {
  rssUrls: [
    'https://feeds.bbci.co.uk/news/world/rss.xml',           // BBC World
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', // NYT World
    'https://esta-url-no-existe.xyz/feed.xml',               // Invalid — tests error handling
  ],
  categories: ['Politics', 'Technology', 'Economy', 'Conflicts', 'Climate'],
  topN: 3,
};

// ── Minimal mock of VercelRequest / VercelResponse ───────────────────────────

function createMockReq(body: unknown): VercelRequest {
  return { method: 'POST', body } as VercelRequest;
}

function createMockRes(): VercelResponse & {
  _status: number;
  _body: AnalysisResponse | ErrorResponse | null;
} {
  const res = {
    _status: 200,
    _body: null as AnalysisResponse | ErrorResponse | null,
    _headers: {} as Record<string, string>,
    status(code: number) { this._status = code; return this; },
    json(data: AnalysisResponse | ErrorResponse) { this._body = data; return this; },
    setHeader(key: string, value: string) { this._headers[key] = value; },
    end() { return this; },
  };
  return res as unknown as VercelResponse & {
    _status: number;
    _body: AnalysisResponse | ErrorResponse | null;
  };
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function runTest(): Promise<void> {
  console.info('🚀 Starting integration test for POST /api/analyze\n');
  console.info('Payload:', JSON.stringify(TEST_PAYLOAD, null, 2), '\n');

  const req = createMockReq(TEST_PAYLOAD);
  const res = createMockRes();

  const start = Date.now();
  await handler(req, res as unknown as VercelResponse);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.info(`⏱  Total time : ${elapsed}s`);
  console.info(`📡 HTTP status : ${res._status}\n`);

  if (res._status !== 200 || !res._body) {
    console.error('❌ Request failed:', res._body);
    process.exit(1);
  }

  const body = res._body as AnalysisResponse;
  const { results, meta } = body;

  console.info('📊 META');
  console.info(`  Articles processed : ${meta.totalArticlesProcessed}`);
  console.info(`  Sources queried    : ${meta.totalSourcesQueried}`);
  console.info(`  Failed sources     : ${meta.failedSources.length}`);
  meta.failedSources.forEach((f) => console.warn(`    ⚠️  ${f}`));
  if (meta.note) console.info(`  Note               : ${meta.note}`);
  console.info(`  Analyzed at        : ${meta.analyzedAt}\n`);

  console.info('📰 TRENDS BY CATEGORY');
  results.forEach((cat) => {
    if (cat.trends.length === 0) return;
    console.info(`\n  📂 ${cat.category.toUpperCase()}`);
    cat.trends.forEach((trend, i) => {
      console.info(`    ${i + 1}. ${trend.topic}`);
      console.info(`       Sources (${trend.sourceCount}): ${trend.sources.join(', ')}`);
      trend.headlines.forEach((h) => console.info(`       • ${h}`));
    });
  });

  console.info('\n✅ Test completed successfully');
}

runTest().catch((err: unknown) => {
  console.error('💥 Unhandled error:', err);
  process.exit(1);
});
