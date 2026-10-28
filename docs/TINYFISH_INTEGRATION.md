# TinyFish Intelligence in Togetherly

TinyFish is the live web-intelligence layer for Togetherly. The dedicated TinyFish Intelligence workspace combines three connected capabilities:

1. Search discovers fresh public sources and returns ranked titles, snippets, and URLs.
2. Fetch turns up to 10 selected public URLs into clean Markdown content for review.
3. Agent runs a goal-directed browser workflow on a starting URL and returns structured results. Agent is metered, and the UI asks users to acknowledge this before starting.

Search results can be sent directly to Fetch or Agent. All calls go through Vercel serverless functions so TINYFISH_API_KEY never enters the browser bundle.

## Required Vercel environment

- TINYFISH_API_KEY: TinyFish API key, server-only. Never add a VITE_ prefix.
- VITE_SUPABASE_URL or SUPABASE_URL.
- One of VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY, or SUPABASE_ANON_KEY.

Redeploy after changing environment variables.

## Endpoints

- POST /api/tinyfish/search: validates the Supabase session, calls TinyFish Search, and returns at most 10 normalized results.
- POST /api/tinyfish/fetch: validates the session and accepts 1–10 public HTTP(S) URLs; returns extracted text and per-URL errors.
- POST /api/tinyfish/agent: validates the session and starts a metered asynchronous Agent run. The goal is wrapped in read-only research guardrails; max run duration is set to 90 seconds.
- GET /api/tinyfish/agent-run?runId=...: validates the session and retrieves Agent run status/result.

All endpoints reject requests without a valid Supabase access token. Local/private/credential-bearing URLs are rejected by Fetch and Agent inputs.

## Architecture

Search → choose source → Fetch retrieves evidence from known pages. Search → choose source → Agent delegates multi-step read-only website research. Managers can use results to inform workforce planning. TinyFish content is untrusted external data and must not automatically modify employee records, project allocations, or internal match scores.

## Development notes

Vite's normal dev server does not run Vercel serverless functions. Use Vercel CLI development mode to test /api/tinyfish/* routes locally, with environment variables available to the server process.

Official TinyFish API docs:
- https://docs.tinyfish.ai/search-api
- https://docs.tinyfish.ai/fetch-api
- https://docs.tinyfish.ai/agent-api

## Task templates

The TinyFish Intelligence page includes five curated task templates:

- **Skills Demand Scan** — pre-fills Search with a query about current technology and cybersecurity skill demand in India.
- **Opportunity Discovery** — pre-fills Search with a query for internships, entry-level roles, and hackathons.
- **Source Pack Reader** — pre-fills Fetch with public TinyFish overview and Search API documentation URLs; users can replace them.
- **Company Intelligence Brief** — pre-fills Agent with a read-only, structured company/product research goal and the public TinyFish website.
- **Job Requirements Extractor** — pre-fills Agent with a structured extraction goal; the user must supply a public job listing or careers-page URL.

Selecting a template only fills the existing workflow form. It does not call the TinyFish API or consume Agent credits. Users should review and edit all values before submitting. Agent runs retain the existing public-web, read-only guardrails and metered-run acknowledgement. The presets are shipped with the client and are not user-created or persisted custom templates.
