# Security Policy

## Reporting a vulnerability

Please do not publish exploit details, access tokens, passwords, session tokens, payment secrets, or personal data in a public issue.

Report suspected vulnerabilities privately to the repository owner through GitHub. Include the affected file or endpoint, the impact, and reproducible steps where safe. Allow time for investigation before publicly disclosing a confirmed issue.

## Handling secrets

- Keep production credentials in the hosting provider's environment settings.
- Never commit `.env`, access tokens, database connection strings, or payment credentials.
- Use `.env.example` only for placeholder names and example values.
- Revoke and rotate any credential that may have been exposed.
- Preserve Messenger signature validation and PayMongo webhook verification when making unrelated changes.

## Scope and validation

Security fixes should be minimal, tested, and reviewed against existing behavior. Do not test against real users' accounts, production balances, or live payment flows without explicit authorization.
