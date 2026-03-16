# RSS Trends Analyzer

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vercel](https://img.shields.io/badge/Deployed_on-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)](https://rss-trends-serverless-ds-challenge.vercel.app/)
[![Claude](https://img.shields.io/badge/Powered_by-Claude_Sonnet-D97757?style=flat-square&logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![Node](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

A serverless function that ingests multiple RSS feeds in parallel, filters articles to the last 24 hours, and uses Claude's semantic understanding to group stories covering the same real-world event — even when they come from different sources and are written in completely different words. The result is a ranked list of trending topics per category, returned as structured JSON.

**Production endpoint:** `https://rss-trends-serverless-ds-challenge.vercel.app/api/analyze`

---

## How it works

The function runs in four sequential stages on every request.

**1. Ingestion** — all RSS URLs in the payload are fetched concurrently using `Promise.allSettled`. Sources that time out or return errors are recorded and skipped; the rest continue normally.

**2. Filtering** — articles older than 24 hours are discarded. Articles with no publication date are kept rather than silently dropped, since some feeds omit that field.

**3. Semantic analysis** — the filtered articles are sent to Claude Sonnet in a single structured prompt. Claude handles two tasks at once: classifying each article into one of the caller-defined categories, and grouping articles that describe the same event regardless of phrasing or source.

**4. Aggregation** — groups are ranked by number of distinct sources covering them, and the top-N per category (as specified in the request) are returned alongside representative headlines and source attribution.

---

## Project structure

```
.
├── api/
│   └── analyze.ts        # Serverless function entry point (Vercel runtime)
├── lib/
│   ├── rssFetcher.ts     # Parallel RSS ingestion with per-feed error isolation
│   ├── aiAnalyzer.ts     # Semantic classification and grouping via Claude
│   └── validator.ts      # Request payload validation with Zod
├── types/
│   └── index.ts          # Shared domain types
├── tests/
│   └── test.ts           # Local integration test against the real handler
├── tsconfig.json
├── vercel.json
├── .env.example
└── package.json
```

---

## Getting started

### Prerequisites

- Node.js 20 or later
- An Anthropic API key [console.anthropic.com](https://console.anthropic.com)

### Installation

```bash
git clone https://github.com/steventete/rss-trends-serverless-ds-challenge.git
cd rss-trends-serverless-ds-challenge
npm install
```

### Environment

```bash
cp .env.example .env
```

Open `.env` and set your key:

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
```

### Running the integration test

The test calls the handler directly (no HTTP layer) and prints a full breakdown of the results, including which sources failed and what trends were detected per category.

```bash
npm test
```

### Type checking

```bash
npm run typecheck
```

### Deploying

```bash
npx vercel@latest --prod
```

When prompted, add `ANTHROPIC_API_KEY` as a production environment variable.

---

## API reference

### `POST /api/analyze`

#### Request

```http
POST /api/analyze
Content-Type: application/json
```

```json
{
  "rssUrls": [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"
  ],
  "categories": ["Politics", "Technology", "Economy", "Conflicts", "Climate"],
  "topN": 3
}
```

| Field        | Type       | Required | Constraints                 |
|--------------|------------|----------|-----------------------------|
| `rssUrls`    | `string[]` | yes      | 1 to 20 valid URLs          |
| `categories` | `string[]` | yes      | 1 to 10 non-empty strings   |
| `topN`       | `number`   | yes      | Integer between 1 and 10    |

#### Response `200 OK`

```json
{
  "results": [
    {
      "category": "Conflicts",
      "trends": [
        {
          "topic": "Iran-US war and regional escalation",
          "sourceCount": 2,
          "sources": ["BBC News", "NYT > World News"],
          "headlines": [
            "US names six crew killed in refuelling plane crash in Iraq",
            "Iran War Live Updates: No Guarantees Oil Prices Drop Soon",
            "A Timeline of the Fraught Relationship Between Iran and the US"
          ]
        }
      ]
    }
  ],
  "meta": {
    "totalArticlesProcessed": 44,
    "totalSourcesQueried": 3,
    "failedSources": [
      "https://broken-feed.example.com: getaddrinfo ENOTFOUND"
    ],
    "analyzedAt": "2026-03-15T23:27:24.562Z"
  }
}
```

#### Error responses

| Status | When                                                           |
|--------|----------------------------------------------------------------|
| `400`  | Payload is missing, malformed, or violates constraints         |
| `405`  | Request method is not POST                                     |
| `500`  | RSS ingestion or AI analysis failed                            |

---

## Design decisions

**`Promise.allSettled` over `Promise.all`** — a single slow or unavailable RSS source should never block the entire request. Each feed is isolated: if it fails, the error is recorded in `meta.failedSources` and processing continues with the remaining sources.

**Single AI call per request** — rather than making one Claude call per article or per category, the entire article set is analyzed in a single structured prompt. This keeps latency low and avoids rate limit pressure, at the cost of a larger prompt. The trade-off is worth it for the expected request sizes.

**Articles capped at 100** — Claude's context window is large, but sending hundreds of articles inflates both latency and cost without a proportional improvement in grouping quality. The 100 most recent articles are selected for analysis; the rest are discarded before the AI call.

**No database, no queue** — this is a pure request-response function. There is no state between invocations, which makes it trivially scalable and straightforward to reason about.

---

## Limits

| Parameter            | Limit                             |
|----------------------|-----------------------------------|
| RSS URLs per request | 20                                |
| Categories           | 10                                |
| `topN`               | 10 per category                   |
| Article window       | Last 24 hours                     |
| Articles sent to AI  | 100 most recent                   |
| Per-feed timeout     | 10 seconds                        |
| Function timeout     | 60 seconds (Vercel limit)         |

---

## Tech stack

| Layer      | Technology                                                   |
|------------|--------------------------------------------------------------|
| Runtime    | Node.js 20, TypeScript 5.4                                   |
| Deployment | Vercel Functions (serverless)                                |
| AI model   | Claude Sonnet (`claude-sonnet-4-20250514`) via Anthropic SDK |
| RSS parser | `rss-parser`                                                 |
| Validation | `zod`                                                        |
| Linting    | ESLint with `@typescript-eslint`                             |

---

## Academic context

Built as part of the Distributed Systems course (2026-1). The service demonstrates core distributed systems concepts including stateless function design, parallel I/O with fault isolation, third-party service integration, and structured JSON APIs.