# TinyFish live market intelligence

Togetherly's Opportunity Finder uses TinyFish Search to retrieve current external sources for skills, hiring demand, and market opportunities. Internal employee-to-project match scores remain calculated by Togetherly.

## Vercel environment variables

Configure these in Vercel → Project → Settings → Environment Variables, then redeploy:

- `TINYFISH_API_KEY`: API key from the TinyFish dashboard. Keep it server-side; do not use a `VITE_` prefix.
- `SUPABASE_URL` (or the existing `VITE_SUPABASE_URL`): Supabase project URL.
- `SUPABASE_ANON_KEY` (or the existing publishable/anon key variable): Supabase publishable/anon key used to validate the signed-in session.

The API route verifies the Supabase access token before calling TinyFish. It validates query length, limits displayed results, uses a request timeout, and never returns the API key to the browser.

## Local development

The regular Vite dev server does not run Vercel serverless functions. Use the Vercel CLI local development server to test `/api/tinyfish/search` locally, with the environment variables above available to that process. Do not put the TinyFish key in client-side environment variables.

## Current scope

This first integration uses TinyFish Search only. It does not run browser automation or claim that web search results are verified vacancies. Managers should open source links and validate any opportunity before acting.
