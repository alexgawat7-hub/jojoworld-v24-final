# JojoWorld V26 shared modules

The `v26/` directory is a shared-code area inside the main JojoWorld application, not a standalone deployment or an isolated branch. The production entry point remains the repository-root `index.js`, started with `npm start` (`node index.js`). The root application imports modules from `v26/src/`.

## Modules currently used by the root application

- `src/security/messenger.js` — Messenger request signature verification.
- `src/security/paymongo.js` — PayMongo webhook signature verification.
- `src/services/gifts.js` — gift catalog and gift transaction rules.
- `src/services/ai-name-art.js` — optional name-art generation and cached artwork.

**Do not delete this directory without first migrating its imports and tests and confirming the replacement works.** Keep the existing Render deployment and environment-variable names intact. Never commit `.env` files or expose secrets.

## Checks

Run from the repository root with Node.js 20 or newer:

```sh
npm install
npm run check
npm test
```

The GitHub Actions workflow runs these checks on pushes to and pull requests targeting `main` as well as the legacy `jojoworld-v26-ultimate-evolution` branch.

## Safety notes

- Keep Messenger signature verification enabled.
- Keep PayMongo signature verification enabled; reject webhook requests when the required secret is missing.
- Preserve payment validation and duplicate-event protection. Do not change payment behavior as part of unrelated cleanup.
- Test changes before relying on them in the live Render service.
