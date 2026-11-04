# Archive

Superseded audit reports. **Nothing here describes the current system.**

These files are snapshots of the codebase on the day they were written, kept because the
reasoning behind a decision is often more useful than the decision, and because "was this
ever a problem?" is a question worth being able to answer. They are not documentation: for
how the project works today, read [`docs/README.md`](../README.md) and the code.

| File | Date | What it was |
|------|------|-------------|
| [AUDIT-2026-09-19.md](./AUDIT-2026-09-19.md) | 2026-09-19 | Read-only production-readiness audit on branch `refactor-v1`. 192 findings, numbered `P0`–`P3` by the report's own scheme |

## Reading a report in here

Three things that will otherwise waste your time or mislead you:

- **The numbering is the report's own.** `P1-30` and `P2-21` mean nothing outside the file
  they appear in, and they are not the `M1…Mxx` numbering used for the live audit work —
  those ids refer to a different, later pass. Never quote an id from an archived report
  without naming the report.
- **A finding being listed says nothing about whether it is still open.** Most of the 192
  were fixed; several were fixed before the report was even read. Check the code.
- **Statements of fact decay fastest.** The report measured real things — key counts,
  coverage, table listings — and those measurements were true for a few days.

Claims in `AUDIT-2026-09-19.md` that are verifiably wrong now, so nobody re-fixes them:

| The report says | Reality today |
|---|---|
| "`playwright.config.*`, `tests/e2e/` do not exist; Playwright is not a dependency" | Both exist and `npm run test:e2e` runs Chromium against the dev server |
| "`common.close` and `common.noResults` are missing from both locale files but used in 5 places" | Both keys are present in `ua.json` and `en.json` |
| `P2-21`: `GroupCoOrganizer` was created after the RLS migration loop and never got the flag | `database/migrations/20260921160000_constraints_indexes_rls` enables it explicitly; `tests/integration/rls.test.ts` covers every public table |
| Running the coverage suite wrote rows into the live database (`cascade-deletes.test.ts`) | Integration tests are gated by `tests/integration/_guard.ts`, which skips every suite unless `TEST_DATABASE_URL` points at a throwaway database that is not `DATABASE_URL` |

One thing it got right that is easy to lose: RLS was described as a deliberate default-deny
posture. It still is — and it still filters nothing, which is documented honestly in
[security.md §10](../security.md#10-database-security-posture) rather than being cited as an
active control.
