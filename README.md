# CrockBot — AI kitchen companion

CrockBot is a mobile-first cooking app with recipes, a food-photo helper, paper-recipe scanning, meal planning, a grocery list, and a kitchen calculator.

## Project layout

- `index.html` — frontend interface
- `api/crockbot.js` — server-side OpenAI Responses API endpoint for Vercel
- `sw.js` — service worker for the installable app shell
- `manifest.webmanifest` and `icon.svg` — app metadata and icon
- `vercel.json` — Vercel function settings
- `.env.example` — names of local environment variables only; it contains no secrets

## Important: GitHub Pages cannot run the AI backend

The GitHub Pages address can serve the static interface, but GitHub Pages does not execute the Node.js function in `api/crockbot.js`. The AI chat, photo analysis, paper-recipe scan, and live grocery research need the backend.

For the complete app, deploy this same repository as a Vercel project and open the Vercel deployment URL. The frontend calls `/api/crockbot` on that same deployment. The GitHub Pages version now explains this limitation instead of silently failing.

## Deploy the complete app

1. Have a parent or guardian review and approve the hosting and API-billing setup. OpenAI API usage is billed separately from a ChatGPT subscription, and a public endpoint can incur charges.
2. Import this repository into a Vercel project. Use the repository root as the project root; no frontend build command is required.
3. In Vercel project settings, add these environment variables to the Production environment:
   - `OPENAI_API_KEY` — a newly created API key
   - `OPENAI_MODEL` — `gpt-6.2-sol` (optional; this is the default)
4. Redeploy after adding or changing environment variables.
5. Open the Vercel deployment URL, go to **Settings → AI connection**, and select **Test CrockBot connection**.
6. A successful test reports that the backend is connected and the server key is configured.

Never put an API key in `index.html`, browser JavaScript, a public GitHub file, a screenshot, or a chat message. Store it only in the server's environment-variable settings. If a key was ever exposed, revoke it and review API usage before creating a replacement.

## Local development

Requirements: Node.js 20+ and the Vercel CLI.

1. Copy `.env.example` to `.env.local`.
2. Add your own API key to `.env.local` only if a parent or guardian has approved API billing.
3. Run:

```bash
npx vercel dev
```

Open the local URL printed by the command. Do not open `index.html` directly with a `file://` URL; the server endpoint will not exist.

## Privacy, accuracy, and safety notes

- The API key stays on the server; the frontend does not read or store it.
- The app stores preferences, recipes, and shopping lists in the current browser's local storage. There is no account system or cross-device sync.
- Photo-based food identification and nutrition are estimates. A photo cannot establish exact ingredients, weights, internal temperature, or food safety.
- Check ingredient labels and cross-contact information for allergies.
- Grocery results are web research, not a retailer inventory or checkout API. Verify package size, price, and availability with the retailer.
- The built-in in-memory request limiter is best-effort only. Before any public launch, add persistent rate limiting and access controls; do not treat the current endpoint as abuse-proof.
- The API can incur usage charges. Keep spending limits and usage alerts enabled in the API account.
