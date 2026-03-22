# Application Tab Embed Validation

Date checked: 2026-03-19

## Scope

Validate whether the two external Apps Script customer application forms can be embedded inside the CRM via `iframe`, using the same pattern as the existing Document Upload tab.

URLs checked:

- Sales Agent: `https://script.google.com/macros/s/AKfycbyIPCTxFa1D_0ff2cfcPlDV3Zc49m-yYQ8jQEn9XS119akHU9ZkKLWDVWqzS1PF8zqq/exec`
- Refi Direct: `https://script.google.com/macros/s/AKfycbx2qsErYPiL-28OvrjOPtfXNmoKpVDReXH1GPPTSuIYzp0f8k9Xo4CVLZTjfib9DHrOtw/exec`

## Validation method

Used raw header inspection with:

```powershell
curl.exe -I -L "<url>"
```

This captures redirect behavior and embed-related headers without changing CRM code.

## Findings

Both URLs currently fail the embed check.

Observed response pattern for both forms:

- Initial `302` redirect away from the Apps Script URL to `accounts.google.com`
- `X-Frame-Options: SAMEORIGIN` on the Apps Script redirect response
- `Content-Security-Policy: frame-ancestors 'self'` on the Apps Script redirect response
- Follow-up Google Accounts responses include `X-Frame-Options: DENY`

Implication:

- The CRM cannot reliably embed either URL in an `iframe` in the current deployment state.
- Even before the target form renders, the browser is redirected into a framed-blocked Google sign-in flow.

## Decision

Stop before UI implementation.

The planned "Application" tab should not proceed as an embedded in-CRM `iframe` against these two URLs until the external deployment is changed and revalidated.

## Recommended fallback

Preferred fallback for the next PR:

1. Keep the planned Application landing screen inside the CRM.
2. Replace embedded `iframe` launch with explicit open-in-new-tab actions for each form.
3. Add short helper text explaining that the form opens in a separate tab/window.

Alternative fallback:

- Reconfigure or redeploy the external application forms so they are publicly accessible and actually permit framing, then rerun this validation before any CRM embed work.

## Notes

- No server/API contract changes are required for this validation PR.
- Follow-up UI status: the CRM should use the chooser + open-in-new-tab fallback until the external deployments are revalidated as iframe-safe.
