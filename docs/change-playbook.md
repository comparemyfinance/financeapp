# Change Playbook (Runtime Truth)

Use this for safe, incremental changes.

## Baseline checks

```bash
npm run sanity
npm run lint
npm test
```

## Where to change what

### Add or modify a backend action

- Edit: `server/router/actions.gs`
- Keep entrypoints stable in `Code.gs`
- Update: `docs/API_ACTIONS.md` if action/auth/alias behavior changes

### Change config behavior

- Edit: `server/shared/config.gs`
- Update: `docs/ENVIRONMENT.md` and `docs/SETUP_CHECKLIST.md`

### Change error envelope behavior

- Edit: `server/shared/response.gs`
- Update: `docs/ERROR_POLICY.md`

### Change auth/session backend

- Edit: `Auth.js`
- Validate router auth-gated behavior in contracts

### Change shared frontend API/session handling

- Canonical edit location: `Index.html`
- If tab-level duplicate logic is touched (`tabSalesPipeline.html`), document whether change is canonical or compatibility-only.

## Guardrails

- No broad rewrites in mixed-purpose PRs.
- Keep API contracts backward compatible unless explicitly planned and documented.
- No secrets in source.
- Prefer additive compatibility fallbacks over hard cutovers.
- For Markdown/config formatting drift, format touched files when required by checks, but keep repo-wide normalization in a separate cleanup PR rather than mixing it into behavior fixes.

## High-risk areas

- `server/router/actions.gs` action dispatch and auth gating
- `Code.gs` write paths (`save`, `delete`, `batchUpdate`)
- `Index.html` and `tabSalesPipeline.html` due to large inline scripts and overlapping logic
- Jigsaw/webhook paths
