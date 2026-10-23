# JojoWorld

JojoWorld is a Facebook Messenger bot. The repository-root `index.js` is the application entry point, and shared services and security modules live under `src/`. Run commands from the repository root.

## Requirements

- Node.js 20 or newer
- A Facebook Page and Messenger app with a Page Access Token and Meta App Secret
- A public HTTPS host for the Messenger webhook
- A MongoDB connection string for persistent production data; use MongoDB Atlas or another replica-set deployment that supports transactions
- PayMongo credentials only if payment top-ups are enabled

## Run locally

1. Clone this repository and enter the repository directory. Use the `main` branch.
2. Install dependencies from the repository root:

   ```sh
   npm install
   ```

3. Copy `.env.example` to `.env` and replace the placeholder values with your own credentials. Never commit `.env`.
4. Run the checks:

   ```sh
   npm run check
   npm test
   ```

5. Start the server:

   ```sh
   npm start
   ```

6. Open `/health` on the hosted URL to confirm the process responds. Open `/ready` to see whether Messenger tokens are configured. The process can start before credentials are configured, but Messenger webhooks are rejected until valid `PAGE_TOKEN`, `VERIFY_TOKEN`, and `META_APP_SECRET` values are set and the webhook is configured.

## Project structure

- `index.js` — main application entry point
- `src/security/messenger.js` — Messenger request signature verification
- `src/security/paymongo.js` — PayMongo webhook signature verification
- `src/services/gifts.js` — gift catalog and gift transaction rules
- `src/services/ai-name-art.js` — optional name-effect artwork generation and cache support
- `public/` — browser-facing game and UI assets
- `assets/` and `audio/` — visual and audio assets

The shared modules are part of the same root application; `src/` is not a separate deployment. Keep imports and npm scripts aligned with these paths when updating the code.

## Facebook Messenger webhook

In Meta's developer dashboard, set the callback URL to `https://YOUR-HOST/webhook` and use the same `VERIFY_TOKEN` configured in the environment. Subscribe the Page to the message and postback events required by the bot. The host must be publicly reachable over HTTPS.

## Payments and storage

Set `MONGODB_URI` for persistent user data. Gift transfers and wallet/jackpot saves use MongoDB transactions, so the database must support transactions (for example, MongoDB Atlas or a replica set). Without it, the legacy application falls back to local `db.json`, which is not suitable for ephemeral hosting; automatic payment top-ups stay disabled unless MongoDB is connected. Configure both `PAYMONGO_SECRET` and `PAYMONGO_WEBHOOK_SECRET` before enabling live payment flows. Use test credentials while validating checkout and webhook behavior. Preserve the existing payment validation and webhook-signature checks when making unrelated changes.

## AI-generated name-effect artwork

JojoWorld can optionally generate premium artwork for its name effects through the OpenAI Images API. Add `OPENAI_API_KEY` as a private environment secret on the hosting service (for example, Render); never commit the real key. The default model and quality can be configured with `OPENAI_IMAGE_MODEL` and `OPENAI_IMAGE_QUALITY`.

Artwork is generated lazily when a name-effect shop preview is requested, then cached in the host's `cache/` directory and reused. The user's name remains rendered by Canvas so it is accurate and consistent. Visual profiles only read cached artwork and do not trigger generation by themselves. If the API key is absent or generation fails, the existing Canvas effect remains available as a fallback. OpenAI API usage is billed separately from a ChatGPT subscription, and first-time generation can take longer than a cached preview.

## Automated checks and deployment

GitHub Actions runs the repository's configured syntax checks and unit tests on supported pushes and pull requests. A green check confirms those automated checks passed; it does **not** by itself confirm deployment or live behavior on Render, Facebook Messenger, MongoDB, or PayMongo.

Do not commit secrets, and test changes before relying on them in the live service.
