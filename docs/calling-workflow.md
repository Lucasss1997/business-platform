# Calling task workflow

This extends `/tasks` without altering existing `tasks` rows or their free-text assignments. Existing tasks remain in the **Existing tasks** tab. Structured calling work is stored in dedicated `crm_call_*` tables with active organisation membership checks, read-only authenticated table grants and transactional RPC writes.

## Installation order

1. Apply the code patch to a clean checkout and run the production build using the existing local environment.
2. Run `database/migrations/20261118_calling_workflow.sql` once in Supabase SQL Editor. It creates new tables/functions in a transaction; it does not modify existing company/task columns. A second run intentionally fails rather than hiding a partially installed schema. Do not drop the tables to retry on a database containing call history.
3. Commit and deploy the code only after the migration succeeds. No new environment variables or runtime dependencies are required.
4. In Tasks, an organisation admin opens **Sales managers** and designates active members who can receive qualified leads.
5. Admin creates a calling batch from existing CRM companies, records a brief/due date and confirms number screening. New research leads must first be imported and reviewed using the existing company importer. No research batch is included in this code change.

## Behaviour

- My calls: owned calls due today or overdue. Team tasks: all due open calls, with owner displayed; unassigned calls must be claimed. Admins can reassign or return a task to the shared queue.
- Scheduled callbacks: future tasks are saved immediately, appear in the same popup format, and enter the due queue automatically on their due date. No cron service is needed. Business dates use Europe/London.
- One open calling task per company; batch creation skips an already-open task, closed prospect, suppressed number, or company without a number. Batches accept up to 500 selected companies.
- Every call outcome requires notes. Positive follow-ups require a 1–5 rating. Historical outcomes, actors, dates and ratings are retained.
- No answer / voicemail: require a retry date; the third consecutive unanswered attempt closes as **unreachable**. A spoken callback/information request resets the consecutive attempt count.
- Callback: completes current task and creates a linked callback on the chosen date; quick buttons add 1, 3 or 6 calendar months, clamped at month end.
- Send information: records the request and creates an information follow-up task. It does **not** send email. The salesperson must send the information separately.
- Qualified: completes the call and creates a manager follow-up with the selected due date and active designated manager as owner. This appears in that manager's queue; no email/bell notification is added in this version.
- A manager/admin can close the call queue once an opportunity is being handled in the existing Sales pipeline; they must record its reference/owner in notes. This does **not** automatically create a `leads` row because the live sales table schema has not been supplied.
- Not suitable / wrong number: retained but closed; an admin can explicitly restore the prospect with a reason after correction/review, then create a fresh batch task.
- Do not contact: retained and blocked. Both current company numbers are normalised (UK +44 / 0044 / 0 and formatting) and suppressed within the organisation, so importing a second company with the same number cannot queue it. This UI cannot lift do-not-contact suppression.
- Locks and version checks reject two people claiming/saving the same task. Outcome, history and follow-up task are committed together. A repeat save cannot create a second callback.

## Limits to verify in the live environment

- This is not a TPS/CTPS lookup service. The admin's screening acknowledgement is logged; actual screening must happen separately before queueing. Opt-out numbers remain suppressed here, but unrelated dialling/email systems do not automatically consume these suppressions.
- The pre-existing Companies calling screen and legacy company rating fields remain unchanged. Call ratings and disposition for this workflow live in its history/state tables; old company call notes are displayed in the popup.
- Reimport protection covers the same stored company or its normalised suppressed numbers, not a different company name **and** different number. The existing importer must still be used to review duplicates.
- The migration has been tested against an isolated PostgreSQL engine using the supplied schema shape. Live Supabase RLS/permissions and authenticated browser interaction must be acceptance-tested before adding a real calling batch.
- No production database credentials were used; no companies, tasks, leads, phone calls or outbound messages have been created in the live system.

## Verification

`npx tsc --noEmit` and `npm run build` validate the code. The latter requires the application's normal local environment; development validation used placeholder public Supabase values, not live secrets.

For transactional tests, install `@electric-sql/pglite` in a disposable directory, then set `PGLITE_MODULE` to its `dist/index.js` and run `node scripts/test-calling-workflow.mjs`. The harness creates an isolated fixture schema and tests permissions, tenant isolation, stale saves, rollback, callbacks, manager assignment, number suppression/reimports and the retry cap. It never connects to Supabase.

Acceptance test: queue one internal/test company; claim it as a salesperson; save a three-month callback; verify exactly one future task and preserved history; test handover using a second test company. Keep real lead imports separate until these pass.

## Popup controls update

See `docs/modal-close-controls.md` for the shared close/save/discard controls and admin section behaviour. The user-confirmed live acceptance run on 18 November 2026 produced one three-month callback due 18 February 2027, plus one due manager follow-up assigned to Paul. The later visual controls still need a deployed browser check after publishing.
