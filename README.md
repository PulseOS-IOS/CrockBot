# CrockBot — upgraded AI kitchen companion

This package preserves the original mobile-first CrockBot interface and adds a server-side OpenAI integration. It is a static HTML app plus one Vercel serverless function; there is no frontend build step.

## What's upgraded

- **Real CrockBot chat:** interactive multi-turn AI conversations, with optional web research for current ingredient/store questions.
- **Recipe research:** creates structured recipes and attaches links returned by web search.
- **Food scanner:** sends uploaded or camera-captured food photos to a vision-capable OpenAI model and returns a likely identification, ingredients, rough nutrition estimates, flavor ideas and visible appearance notes.
- **Paper recipe digitizer:** reads printed or handwritten recipe photos, extracts ingredients and steps, then saves the result into Recipes for review and editing/scaling.
- **Grocery research:** asks web search for current retailer listings and only displays a numeric price as source-backed when its URL matches an actual web-search source. If a price cannot be verified, the app says so and offers direct retailer searches.
- **Region setting:** optional city/state or ZIP code to improve grocery research. Do not enter a street address.
- **PWA shell:** manifest, app icon and service worker for an installable mobile web app and cached app shell.
- **Privacy/security:** the OpenAI API key stays in the server environment. It is never placed in browser JavaScript or localStorage.

## Important limitations

- Photo-based calories/macros and portions are estimates. A photo cannot reveal exact ingredient weights or preparation details.
- A food photo cannot establish internal cooking temperature or food safety. Use a food thermometer when appropriate.
- Grocery search results are not a retailer checkout/stock API. Listings can be stale, regional, or package-size-specific; verify prices and availability at the retailer before purchasing.
- The app currently saves preferences, recipes and lists in this browser's `localStorage`. There is no account system or cross-device cloud sync.
- The API function includes a best-effort in-memory per-instance request limit. For a public launch, add a persistent rate limiter/WAF and authentication or deployment protection.
- The OpenAI API is billed separately from a ChatGPT subscription. Ask a parent/guardian before enabling API billing or deploying a public endpoint that can incur charges.

## Deploy with Vercel

1. Create a **private** GitHub repository for this project.
2. Upload the contents of this folder to the repository. Do not upload a real `.env` file or any API key.
3. Import that repository into Vercel and deploy it as a Vercel project. The `api/crockbot.js` file is automatically deployed as a serverless function.
4. In Vercel, open **Project → Settings → Environment Variables**.
5. Add:
   - `OPENAI_API_KEY` = a newly created, rotated OpenAI API key
   - `OPENAI_MODEL` = `gpt-6.2-sol` (optional; this is the default)
6. Apply the variables to the Production environment and redeploy.
7. Open the deployed website, go to **Settings → Test CrockBot connection**, and confirm it reports that the server key is configured.
8. Add a city/state or ZIP in **Settings → Shopping region** to improve grocery searches.

### Local development

Use Node.js 20+ and the Vercel CLI. From this folder:

```bash
npx vercel dev
```

Create a local `.env.local` file (never commit it) with:

```env
OPENAI_API_KEY=your_new_rotated_key
OPENAI_MODEL=gpt-6.2-sol
```

Then open the local URL printed by Vercel. Do not open `index.html` directly as a `file://` URL; the `/api/crockbot` backend will not exist in that mode.

## Security: rotate any key previously pasted into a chat

An API key was pasted into the earlier conversation. Treat it as exposed: revoke it in the OpenAI Platform API Keys page, check API usage, and create a fresh key only if you choose to enable the integration. Never paste the replacement key into ChatGPT, Claude, Gemini, a public repository, or `index.html`. Store it only as the server-side `OPENAI_API_KEY` environment variable.

## Files

- `index.html` — CrockBot UI and browser-side integration adapter
- `api/crockbot.js` — server-side OpenAI Responses API gateway
- `manifest.webmanifest` — PWA metadata
- `sw.js` — caches the app shell; API calls always go to the network
- `icon.svg` — app icon
- `.env.example` — variable names only; contains no real secret
- `vercel.json` — serverless function configuration
