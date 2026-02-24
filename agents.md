# CRM Project Rules
- **Stack:** Google Apps Script + GitHub Actions.
- **Syncing:** Always use `clasp` naming conventions (no spaces in filenames).
- **GitHub Workflow:** All features should be developed on branches, never directly on `main`.
- **Formatting:** Use Prettier for HTML and standard GAS style for .gs files.
### Custom Commands
- When I say "Deploy," you should:
  1. Run `git add .`
  2. Commit with a summary of changes.
  3. Run `git push origin main`.
- When I say "Sync Local," you should:
  1. Run `clasp pull`.
