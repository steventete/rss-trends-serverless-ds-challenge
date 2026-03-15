// lib/aiAnalyzer.ts
// Classifies and semantically groups news articles using Claude

import Anthropic from '@anthropic-ai/sdk';
import type {
  NewsItem,
  CategoryResult,
  RawAIResponse,
  Trend,
} from '../types';

// Claude's context window is generous, but we cap articles to keep
// latency and token costs predictable for an academic environment.
const MAX_ARTICLES = 100;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Builds the structured prompt sent to Claude.
 */
function buildPrompt(articles: NewsItem[], categories: string[], topN: number): string {
  const articlesText = articles
    .map(
      (a, i) =>
        `[${i}] SOURCE: ${a.source}\nTITLE: ${a.title}\nDESCRIPTION: ${a.description || '(no description)'}`,
    )
    .join('\n\n');

  return `You are a news trend analyzer. Given the articles below, you must:

1. Classify each article into ONE of these categories: ${categories.map((c) => `"${c}"`).join(', ')}
2. Group articles that cover the SAME topic (even if worded differently across sources)
3. For each category, return the top ${topN} groups ranked by number of distinct sources

ARTICLES:
${articlesText}

Respond ONLY with a valid JSON object using this exact structure — no preamble, no markdown fences:
{
  "categories": [
    {
      "category": "category name",
      "trends": [
        {
          "topic": "concise topic description (max 10 words)",
          "articleIndices": [0, 3, 7],
          "sources": ["Source A", "Source B"],
          "sourceCount": 2
        }
      ]
    }
  ]
}

Rules:
- Only include categories that have at least one matching article
- Group articles about the SAME real-world event even if phrased differently
- "topic" must be descriptive and concise
- Sort trends by "sourceCount" descending
- Limit to ${topN} trends per category
- Do not assign the same article to two groups within the same category`;
}

/**
 * Strips optional markdown code fences Claude may wrap the JSON in.
 */
function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

/**
 * Enriches raw AI trend data with headlines pulled from the original articles.
 */
function enrichTrends(
  raw: RawAIResponse,
  articles: NewsItem[],
  topN: number,
): CategoryResult[] {
  return raw.categories.map((cat) => ({
    category: cat.category,
    trends: cat.trends.slice(0, topN).map((trend): Trend => {
      const related = (trend.articleIndices ?? [])
        .map((i) => articles[i])
        .filter((a): a is NewsItem => a !== undefined);

      const sources =
        trend.sources ?? [...new Set(related.map((a) => a.source))];

      return {
        topic:       trend.topic,
        sourceCount: trend.sourceCount ?? sources.length,
        sources,
        headlines:   related.map((a) => a.title).filter(Boolean).slice(0, 3),
      };
    }),
  }));
}

/**
 * Sends articles to Claude for semantic classification and grouping.
 * Returns enriched trend results per category.
 */
export async function analyzeWithAI(
  articles: NewsItem[],
  categories: string[],
  topN: number,
): Promise<CategoryResult[]> {
  if (articles.length === 0) {
    return categories.map((category) => ({ category, trends: [] }));
  }

  const articlesToAnalyze = articles.slice(0, MAX_ARTICLES);
  const prompt = buildPrompt(articlesToAnalyze, categories, topN);

  const message = await client.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages:   [{ role: 'user', content: prompt }],
  });

  const rawText = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const jsonText = stripMarkdownFences(rawText);
  const parsed = JSON.parse(jsonText) as RawAIResponse;

  return enrichTrends(parsed, articlesToAnalyze, topN);
}
