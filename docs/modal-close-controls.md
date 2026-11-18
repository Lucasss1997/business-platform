# Modal close controls

The calling workflow now uses the same native dialog frame as task, contact, opportunity, catalogue and document forms. Header and footer controls stay outside the scrolling body. Read-only dialogs close immediately; dirty forms offer **Save and close**, **Close without saving** and **Keep editing**. Escape and backdrop clicks use the same guard. During a save, close controls are disabled. Save and close submits the original form through browser validation and only its successful existing save handler dismisses the window. Errors retain the entries and are brought into view.

Call dirty tracking includes rating, date and manager selection as well as outcome/notes. Company and sales-pipeline links open another tab so notes remain in the calling window. Contact saves refresh the contact list without a page reload, avoiding an erroneous unsaved-changes warning after a successful save.

Create calling batch and Sales managers remain restricted to organisation admins. Both buttons expose expanded state and are highlighted while open. Manager settings save immediately. The batch has persistent header/footer controls and protects unsaved input even when closed using its toggle button. Save and close creates the selected tasks; it is not a draft-save operation.

No migration, role changes, runtime dependencies or calling database rules change in this update.

## Validation

- TypeScript and production build using placeholder public Supabase settings.
- Isolated DOM interaction checks against the real components and mocked data: clean close, dirty rating-only changes, all close choices, required-field validation, successful callback save, failed save retaining values/focusing error, close blocked while saving, normal-user admin-control visibility, active panel states, batch-toggle discard protection, task/opportunity error handling, catalogue choices, document missing-file validation and contact discard protection.
- Browser preview access was unavailable in the development environment. Native browser scrolling, responsive geometry and focus trapping still require acceptance checking on the deployed site. The team guide uses screenshots supplied from the successful live callback and manager-handover tests.

## Publish and acceptance check

Use the supplied popup-controls installer from a clean main checkout. It backs up affected files, checks/applies the patch, builds, stages only this update, commits and pushes main. It does not execute SQL. If the build fails it stops before committing or pushing and copies the report.

Once Vercel is Ready, refresh Tasks with Ctrl+F5. Open an owned due test task, change notes and scroll the body. Check Close and Save remain visible. Close should offer all three choices; Keep editing preserves notes; incomplete Save and close stays open; valid Save and close records the outcome. Confirm ordinary users do not see admin buttons. Check batch and manager button highlights/Close controls. Use clearly labelled internal test records for these checks.
