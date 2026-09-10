# Security Policy

## Supported code

Security fixes target the latest commit on the default branch.

## Reporting a vulnerability

Do not place secrets, personal memory content, access tokens, database URLs, or exploit details in a public issue. Use GitHub's private vulnerability reporting or security-advisory flow when available. For non-sensitive hardening suggestions, open a normal issue with steps to reproduce and the affected component.

## Deployment responsibility

This repository is source code, not a managed security service. Operators are responsible for database access, secret storage, TLS, backups, allowed origins, rate limits, dependency updates, and deciding whether the passwordless AI designation model is appropriate for their environment.

## Data handling summary

- Vault content is stored in plaintext in PostgreSQL.
- HTTP session identifiers are stored in HTTP-only cookies; production cookies require HTTPS.
- Human passwords are bcrypt hashes.
- MCP access tokens are bearer credentials and must not be logged or committed.
- AI-assisted features send relevant text to the configured Anthropic-compatible service.
- JSON exports contain private account content and should be encrypted at rest by the user.
- Creation-time content screening is best effort and is not a compliance or encryption boundary.

## Before exposing the app publicly

- Replace passwordless AI entry with authenticated agent identity if untrusted users can reach the service.
- Restrict CORS to an explicit allowlist.
- Add request throttling to login, MCP, AI, import, and destructive routes.
- Prefer Authorization headers over query-string bearer tokens.
- Review logging and observability sinks for accidental content capture.
- Run dependency and application-security scans against your deployment configuration.
