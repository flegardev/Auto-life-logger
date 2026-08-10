# Changelog

## Unreleased

- Made data deletion an ordered privacy reset that also forgets the active session and temporary in-memory tracking state.
- Added regression coverage for both delayed and concurrent session writes after deletion.
- Added accessible names to settings toggles and form fields, plus polite live status regions.
- Added repository and maintainer metadata and removed a machine-specific path from public documentation.
- Expanded CI to run unit, unpacked-extension, and responsive Playwright checks before packaging.

## 2.1.0 - Local Quality Pass

- Added Chrome options page.
- Added first-install onboarding.
- Added tracking pause, never-track domains, and configurable data retention.
- Added settings-only export/import and reset controls.
- Added Strict Mode bypass duration, scheduled strict hours, no-bypass mode, and per-site thresholds.
- Added weekly trend visualization.
- Included live active-session duration in popup/dashboard totals.
- Removed remote favicon lookups.
- Added missing extension PNG icons.
- Added validation and Chrome unpacked-load smoke scripts.
- Added README, privacy policy, and manual QA checklist.
