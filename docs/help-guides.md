# Help and guides

`/help` is the organisation's internal wiki/help centre. All active members can search titles, summaries and article text, filter by category, read articles, and open/download attached PDFs. Each guide has a stable `/help/[id]` link. PDF contents are not full-text indexed.

Only organisation admins can add/edit guides and archive/restore them. Content is plain text with paragraph breaks (not executable HTML). A guide needs article content, a PDF, or both. Categories accept existing suggestions or a new name. PDF uploads are limited to 10 MiB and validated for filename and PDF header. The editor uses the shared persistent Close/Save controls and dirty-state guard.

## Install

1. Apply the patch and run the production build using the supplied installer.
2. Run `database/migrations/20261118_help_guides.sql` once in Supabase SQL Editor. The transaction creates only the help table/functions/policies and a new private `platform-help-guides` bucket. Do not run it twice or remove tables to retry.
3. After SQL succeeds, use the supplied publish script to stage the listed help files, commit and push main.
4. Once Vercel is Ready, open `/help` as an admin. Click Add guide, enter Calling tasks team guide, choose Calling and tasks, and attach `MLT_CRM_Calling_Team_Guide.pdf` from the extracted ZIP. Save. The PDF is deliberately not committed to the public GitHub repository.
5. Test Open PDF/Download PDF and staff read-only access before directing the team to the page.

## Privacy and retention

Metadata RLS and private Storage policies require active organisation membership. Admin-only writes are enforced in the database as well as the UI. Restrictive bucket guards prevent pre-existing permissive Storage policies from granting broader access to this bucket, without changing access to other buckets. Inactive organisations/members cannot read guides. Archived guides/files remain available to their organisation admins but are hidden from other members.

The download handler rechecks authenticated/RLS access and returns a private, non-cacheable redirect to a 120-second signed URL. A signed URL can be used by anyone who has it during that short validity period; archive/revocation does not invalidate an already issued URL before expiry.

Metadata updates use version matching, with immutable organisation/creator fields and server-stamped editor/time/version. Replacement PDFs use new paths. Previous unreferenced bytes are retained for admin maintenance, not exposed as browsable revision history. A failed save attempts to remove its newly uploaded orphan; Storage denies deletion of a file already referenced by any guide. Archive/restore does not permanently delete a guide or PDF.

## Validation

- TypeScript and production build using placeholder public Supabase values.
- `PGLITE_MODULE=/path/to/@electric-sql/pglite/dist/index.js node scripts/test-help-guides.mjs`: 40 isolated database checks for membership, tenant isolation, writes, archive/restore, file visibility, protected references, immutable uploads, stale edits and existing permissive policy safeguards.
- Isolated helper/download-route checks cover search, PDF validation, authentication, unavailable guides/files, signed download options and no-store redirects.
- Isolated component checks cover staff/admin controls, search, private links, article saving/error retention and archive/restore.
- No production credentials or live Storage uploads were used. Supabase Storage API integration and native browser layout/file selection need a deployed acceptance check after setup. No new runtime dependency or environment variable is required.
