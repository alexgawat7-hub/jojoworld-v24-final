# Contributing to JojoWorld

## Development environment

- Node.js 20 or newer
- npm
- MongoDB replica set or Atlas for transaction-dependent flows
- Test credentials for integrations; do not use production payment credentials for local testing

## Validate changes

Run these commands from the repository root before committing:

```sh
npm install
npm run check
npm test
```

The automated checks cover the syntax checks and unit tests currently configured in `package.json`. A passing CI run does not replace integration testing against Messenger, MongoDB, Render, or payment-provider test mode.

## Change safety

- Keep changes focused and preserve existing commands, routes, game behavior, and mobile layouts unless the change explicitly targets them.
- Do not change PayMongo validation, webhook signatures, or payment settlement as part of unrelated work.
- Do not commit secrets, real user data, local databases, generated cache files, or build output.
- For coin-related features, preserve server-side balance validation and transactional updates.
- Add or update tests for behavior changes and document any remaining manual verification.
- Use clear commit messages and include the checks actually run in the change summary.
