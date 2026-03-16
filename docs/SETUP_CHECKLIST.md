# Setup Checklist (Phase 6)

This checklist removes environment opacity by requiring production-sensitive config via Script Properties.

## Where properties are set

Google Apps Script Editor -> **Project Settings** -> **Script properties**.

## Required properties

| Property               | Purpose                                                           | Safe default                             |
| ---------------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| `SPREADSHEET_ID`       | Primary CRM spreadsheet ID used by backend reads/writes           | None (required)                          |
| `ROOT_FOLDER_ID`       | Root Drive folder scope for client file search                    | None (required)                          |
| `AUTH_USERS_JSON`      | JSON username/password map for auth login (e.g. `{"kyle":"..."}`) | None (required)                          |
| `ONEAUTO_API_KEY`      | Server-side OneAuto / Experian vehicle finance lookup key         | None (required for VRN external lookup)  |
| `JIGSAW_USERNAME`      | Jigsaw API username                                               | None (required for Jigsaw actions)       |
| `JIGSAW_PASSWORD`      | Jigsaw API password                                               | None (required for Jigsaw actions)       |
| `JIGSAW_SHARED_SECRET` | Webhook signature verification secret                             | None (required for webhook verification) |
| `ONEAUTO_API_KEY`      | Server-side OneAuto/Experian VRN finance lookup key               | None (required for external VRN lookup)  |

## Optional properties

| Property                                                           | Purpose                                    | Default behavior          |
| ------------------------------------------------------------------ | ------------------------------------------ | ------------------------- |
| `JIGSAW_ENV`                                                       | Jigsaw environment selector (`uat`/`prod`) | `uat` if missing          |
| `JIGSAW_ALWAYS_VALIDATE_BEFORE_SUBMIT`                             | Toggle validation-before-submit behavior   | `true`                    |
| Jigsaw path override properties (e.g. `JIGSAW_OPEN_REQUESTS_PATH`) | Override integration endpoints             | Built-in defaults in code |

## Environment verification steps

1. Confirm required Script Properties exist and are non-empty.
2. Run local checks:
   ```bash
   npm run lint
   npm test
   ```
3. In Apps Script runtime, verify:
   - `authLogin` works with credentials present in `AUTH_USERS_JSON`.
   - Drive search works (requires valid `ROOT_FOLDER_ID` and permissions).
   - Deal load/save works (requires valid `SPREADSHEET_ID`).
   - External VRN finance lookup works if `ONEAUTO_API_KEY` is configured.
4. If webhooks are enabled, verify signature validation with `JIGSAW_SHARED_SECRET`.

## Notes

- Do not store production secrets in source code.
- Setup helpers may write placeholder values only; replace placeholders before use.
- Any new required property must be added here and to `docs/ENVIRONMENT.md`.
