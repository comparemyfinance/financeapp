# Changelog

## 2026-03-05 — Refactor program (staged)

- Added rollback anchors locally (`pre-refactor-20260305-aa8278e` tag and `backup/pre-refactor-20260305-aa8278e` branch).
- Added repository syntax validation script for Apps Script and embedded template JS.
- Updated CI to call project syntax validation script.
- Fixed an `index.html` JavaScript parse blocker caused by an unmatched IIFE closer.
- Added `docs/audit.md` and `docs/architecture.md` to document inventory, risks, and migration conventions.
