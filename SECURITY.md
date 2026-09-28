# Security Policy

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting, which reaches the maintainers
without disclosing the report publicly:

<https://github.com/PreCogSecurity/awesome-nodejs-projects/security/advisories/new>

Please include:

- the file or entry involved (`data/projects.json` line, or the path in `src/`),
- what an attacker gains, and
- a reproduction, if you have one.

We aim to acknowledge a report within 3 business days. Fixes for confirmed
issues are released through a normal pull request, and we are happy to credit
the reporter unless you prefer otherwise.

## What counts as a vulnerability here

This repository is a curated list plus a small validation toolchain, so the
realistic threat model is narrower than it would be for a running service. The
issues we treat as security bugs:

- **Malicious or deceptive list entries.** A pull request that adds a link
  pointing at a look-alike domain, an attacker-controlled mirror, a
  credential-harvesting page, or a `rawgit`/`pastebin`-style aggregator used
  to launder a URL.
- **Downgrade or redirection of existing links.** Repointing a well-known
  entry at a different host, or moving a link from `https://` to `http://`.
- **Injection into generated Markdown.** Content in `data/projects.json` that
  breaks out of a link into the rendered README - for example via control
  characters, bidirectional overrides, or unbalanced brackets.
- **Leaked secrets or history in the repository or the container image.** A
  committed credential, or anything that causes `.git` to be baked into a
  published image.
- **Execution of unreviewed code.** Installing a dependency, enabling a
  lifecycle script, or weakening the container posture without discussion.

## What is not a vulnerability

- A linked project being unmaintained, renamed or slow. That is a
  [CONTRIBUTING](CONTRIBUTING.md) matter, not a security one.
- A link that has rotted. We do not run live link checking in CI precisely
  because it is unreliable; please open a normal pull request.
- Missing hardening of a third-party project we merely list a link to.

## Threat model summary

| Control | Where |
| --- | --- |
| `https://` enforced on every curated URL | `src/validate.mjs`, `requireHttps` in `lint.config.mjs` |
| Repository host allowlist | `allowedRepoHosts` in `lint.config.mjs` |
| Denied link hosts (dead CDN, paste sites) | `deniedHostPatterns` in `lint.config.mjs` |
| Control / bidirectional-override characters stripped from text | `CONTROL_CHARACTERS` in `src/validate.mjs` |
| Credentials rejected inside URLs | `embedded-credentials` rule |
| Duplicate detection across the catalog | `duplicate-repo` rule |
| Container runs non-root, read-only, no capabilities, no network | `Dockerfile`, `docker-compose.yml`, asserted in `test/container.test.mjs` |
| `.git` and `.env` excluded from the build context | `.dockerignore`, asserted in `test/container.test.mjs` |
| No third-party dependencies at all | `package.json`, `npm audit` in CI |
