# 2.3.0 — flagship redesign candidate

Calm light dashboard and popup; seven-day review; transparent productive-time goal; category explanation; quiet onboarding; improved chart contrast; overlapping category flags no longer double-count in overview.

Not published. Browser activity is not whole-device activity or work quality. Legacy category flags reflect capture-time rules. The published Store ID and package still need independent confirmation.

# Changelog

## 2.2.0 — candidate, 2026-10-21

- Perform session read-modify-write inside the storage queue to avoid lost concurrent writes.
- Persist minute checkpoints under stable IDs and deduplicate live totals.
- Cancel stale session starts and avoid tracking an unfocused or idle browser after worker restart.
- Preserve existing history when settings are missing during initialization.
- Protect privileged analytics, import and deletion messages from content senders.
- Add versioned backup export and validated, deduplicated session restore.
- Refine the analytics hierarchy, readable daily insights and chart accessibility.
- Replace platform-dependent ZIP generation with a deterministic Node ZIP writer.

No Store upload or submission has been performed.
