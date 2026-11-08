# Security

Living Uganda is a static website. There is no server-side code, no database, no
login, no form that stores anything and no third-party script. GitHub Pages
serves plain files from this repository.

That removes most of the usual attack surface, but two things still matter:

## If you find a problem

- **Content, credit or privacy problem** — open an issue:
  https://github.com/arsenebaguma/living-uganda/issues
- **Something that could harm visitors** (a script injection, a compromised link,
  a file that should not be public) — please do not open a public issue first.
  Contact the maintainer through the GitHub profile
  https://github.com/arsenebaguma and allow a few days for a reply.

## What the site does to protect visitors

- Every page carries a Content-Security-Policy that allows scripts only from this
  site (`script-src 'self'`), blocks plugins, frames and form submission
  elsewhere, and upgrades insecure requests.
- No inline `<script>`; scripts are external files in `assets/`.
- All text from the catalogue is inserted with `textContent`, not `innerHTML`.
- No analytics, no cookies, no third-party fonts or CDNs.
- `rel="noopener"` on outbound links opened in a new tab.
- A referrer policy of `strict-origin-when-cross-origin`.

GitHub Pages adds HTTPS with HSTS, so the site cannot be served downgraded.

## What the maintainer should do

- Turn on two-factor authentication for the GitHub account that owns this
  repository. The site is only as safe as that account.
- Never commit a token, key or private document. The release check
  (`.github/ci/check_release.py`) scans for common credential patterns, but it is
  a net, not a guarantee.
- Review pull requests before merging. A merged pull request is a deployment.
- If a commit ever publishes something that must not be public, remember that
  removing the file does not remove it from history: treat the secret as exposed
  and rotate it.
