# Release handover

## Changed

I prioritized the three customer reports (data trust) and one focused workflow improvement for Sofia.

**Focused improvement (which records will the next action touch?).** Before: selection and the pending undo persisted when the week or a filter changed, so "Apply to N selected" or "Undo last action" could silently act on rows no longer on screen. After: any week/filter change clears the selection and the undo, and says so ("View changed — selection and undo were cleared"). Action scope now always matches the visible rows. E.g. select rows under Meridian, switch to Northstar — previously the hidden Meridian rows were still targeted.

Correctness fixes:

- Editing an entry forced **Billable** on; the edit form now seeds from the entry.
- Weekly review totals and **Export view** used the whole week, ignoring filters; both now follow the visible rows. Selection never changes export scope.
- Bulk client/billability changes left entries marked Reviewed; a meaningful change now returns them to Needs review. Unchanged saves keep review.
- Undo restored a whole-dataset snapshot, discarding newer work; it now reverts only the affected entries and declines with an explanation if those changed.

## Verified

- `npm test`: 39 pass (`src/review.test.ts`, `src/components/ReviewPage.test.tsx`).
- `npm run test:e2e`: 22 pass on desktop + mobile Chromium, including `tests/review.spec.ts` reproducing all three reports, selection/undo clearing, and undo conflict; axe accessibility checks pass.
- `npm run build` + Prettier: pass.
- Independently reproduced from a fresh clone of the submitted commit (`npm ci`, `npm run check`, `npm run test:e2e`).

## Remaining

Deferred optional requests: dark theme, repeat-yesterday, a "needs checking" shortcut. Chromium-only browser coverage; no real Safari/native mobile run.

## Release recommendation

Yes for the pilot: these fixes remove the trust-eroding number and action-scope bugs. Residual risk is single-browser coverage and no manual cross-team walkthrough.

## AI use

An AI agent helped trace causes and draft tests. One check: its first undo test compared full datasets and failed; I corrected the `UndoRecord` semantics to affected-entry-only and re-ran. I also rejected its "preserve selection" proposal for the simpler clear-and-explain after re-reading the scope expectation.

Final commit SHA: supplied to the interviewer after the final push.
