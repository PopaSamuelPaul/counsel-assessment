# Release handover

## Changed

I prioritized the three customer reports (data trust), one focused workflow improvement, and three optional requests.

**Focused improvement.** Selection and the pending undo used to survive a week/filter change, so "Apply to N selected" or "Undo last action" could act on rows no longer on screen. Any view change now clears both and says so; action scope always matches the visible rows.

**Report fixes.** (Alex) the edit form now seeds Billable from the entry, so editing the description no longer flips it. (Sofia) weekly totals and Export view ignored filters — both now follow the visible rows, and selection never changes export scope. (Sofia) a meaningful client/billability correction returns entries to Needs review, and Undo now reverts only affected entries, declining with an explanation if they changed.

**Optional.** Repeat last entry (prefills the profile's most recent entry, dated today); a one-click "Needs review" filter; and a system-aware dark theme built as an additive override, leaving light mode untouched.

## Verified

- `npm test`: 49 pass.
- `npm run test:e2e`: 70 pass across five projects — Chromium, Firefox and WebKit (desktop + mobile Safari) — including reproductions of all three reports and axe checks in light and dark.
- `npm run build` + Prettier pass; a fresh clone (`npm ci`, `npm run check`, `npm run test:e2e`) reproduced everything; CI runs both.

## Remaining

Emulated, not physical, devices and no live walkthrough. On non-Ubuntu Linux, WebKit needs `npm run setup:browsers` to stage two libraries Playwright does not bundle.

## Release recommendation

Yes for the pilot: these fixes remove the trust-eroding number and action-scope bugs. Residual risk is emulated devices and no manual cross-team walkthrough.

## AI use

An AI agent traced causes and drafted tests. I corrected its full-dataset undo test to affected-entry-only, rejected its "preserve selection" proposal for clear-and-explain, and fixed a mobile toolbar overflow its repeat-entry change introduced that the suite caught.

Final commit SHA: supplied in the portal submission (this handover ships in that commit).
