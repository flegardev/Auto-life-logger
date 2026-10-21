# Verification on 2026-10-21

Candidate 2.2.0, previous 2.1.1.

- Static validation/lint: passed.
- Unit and UI checks: 11 Node regression tests + 6 Playwright UI tests, passed.
- Browser: Real extension worker, valid/malformed legacy backup, dashboard, responsive settings and restart history checks passed.
- Upgrade fixture: old extension files replaced in the same disposable-profile path; identity and seeded data retained.
- Dependency audit: zero findings in each package root as checked locally.
- Manifest asset existence: passed.
- Store upload, submission and publication: not performed.
- Live marketplace variations and full YouTube playback: not verified by offline fixtures.
- CI: see the current PR checks; local checks do not imply hosted CI passed.

The 2.1.1 upgrade baseline was recovered from Git commit 8fa2552, not an independently downloaded published CRX. Its published item identity is unconfirmed.
