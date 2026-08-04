# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability. Contact the repository owner privately through the GitHub profile or the project maintainer's verified contact channel with:

- a concise description and affected component;
- reproduction steps or a minimal proof of concept;
- impact and any required account/provider configuration;
- a safe way to coordinate a fix.

Allow time for a fix before public disclosure. Do not send passwords, API keys, OTPs, payment tokens, session cookies, or real farmer records in a report.

## Security boundaries

AgriSense keeps model keys, payment credentials, database URLs, OTPs, and session secrets on the server. Authentication identities are hashed where stored, browser sessions are opaque HttpOnly tokens, and recovery credentials are redacted from activity and model context. These controls are defense-in-depth; deploy behind HTTPS, use a managed secret store, rotate credentials after accidental exposure, and review provider permissions before production use.
