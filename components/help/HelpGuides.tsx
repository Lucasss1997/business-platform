"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { supabase } from "@/lib/supabase";
import Modal, { modalSaveButton } from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  HELP_BUCKET,
  HELP_CATEGORIES,
  filterHelpGuides,
  validateHelpPdf,
  type HelpGuide,
} from "@/lib/help-guides";

const field =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm";
const button =
  "rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-semibold hover:bg-[var(--surface-soft)] disabled:opacity-50";
const date = (value: string) =>
  new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function HelpGuides({ guideId }: { guideId?: string }) {
  const [guides, setGuides] = useState<HelpGuide[]>([]);
  const [org, setOrg] = useState("");
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editor, setEditor] = useState<{ guide?: HelpGuide } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<HelpGuide | null>(null);
  const [busy, setBusy] = useState(false);
  const mutationLock = useRef(false);
  const load = useCallback(async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      setLoading(true);
      setError("");
      if (authError || !user) throw new Error("Please sign in again.");
      const membership = await supabase
        .from("organisation_members")
        .select("organisation_id,role")
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();
      if (membership.error || !membership.data)
        throw new Error("No single active organisation is available.");
      setOrg(membership.data.organisation_id);
      setAdmin(membership.data.role === "admin");
      const rows: HelpGuide[] = [];
      for (let start = 0; ; start += 1000) {
        const result = await supabase
          .from("help_guides")
          .select("*")
          .eq("organisation_id", membership.data.organisation_id)
          .order("updated_at", { ascending: false })
          .order("id")
          .range(start, start + 999);
        if (result.error) {
          if (["42P01", "PGRST205"].includes(result.error.code))
            throw new Error(
              "Help & guides setup is not complete. Ask your administrator to run the help-guides database update.",
            );
          throw new Error(
            "Unable to load your organisation's guides. Please refresh and try again.",
          );
        }
        rows.push(...(result.data as HelpGuide[]));
        if (result.data.length < 1000) break;
      }
      setGuides(rows);
    } catch (err) {
      setError(message(err));
      setGuides([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          guides
            .filter((g) => includeArchived || !g.archived)
            .map((g) => g.category),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [guides, includeArchived],
  );
  const visible = useMemo(
    () => filterHelpGuides(guides, query, category, includeArchived),
    [guides, query, category, includeArchived],
  );
  const selected = guideId ? guides.find((g) => g.id === guideId) : undefined;

  async function archive(guide: HelpGuide) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await supabase
        .from("help_guides")
        .update({ archived: !guide.archived })
        .eq("id", guide.id)
        .eq("organisation_id", org)
        .eq("version", guide.version)
        .select("id")
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      if (!result.data)
        throw new Error(
          "This guide changed or you no longer have access. Refresh before trying again.",
        );
      setArchiveTarget(null);
      setNotice(
        guide.archived
          ? "Guide restored."
          : "Guide archived. Its contents and PDF have been retained.",
      );
      await load();
    } catch (err) {
      setError(message(err));
      setArchiveTarget(null);
    } finally {
      setBusy(false);
      mutationLock.current = false;
    }
  }

  return (
    <div className="space-y-6">
      {guideId && (
        <Link
          className="font-semibold text-[var(--accent)] underline"
          href="/help"
        >
          ← All help guides
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
          Your organisation&apos;s instructions and training documents, together
          in one place.
        </p>
        <div className="flex gap-2">
          <button
            className={button}
            disabled={loading || busy}
            onClick={() => void load()}
          >
            Refresh
          </button>
          {admin && (
            <button
              className={modalSaveButton}
              disabled={loading || busy || !!error}
              onClick={() => setEditor({})}
            >
              Add guide
            </button>
          )}
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-[var(--accent)] p-4"
        >
          {notice}
        </p>
      )}
      {loading ? (
        <p>Loading help guides…</p>
      ) : (
        !error &&
        (guideId ? (
          selected ? (
            <article className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-8">
              <header className="space-y-3">
                <p className="text-sm font-semibold text-[var(--accent)]">
                  {selected.category}
                  {selected.archived ? " · Archived" : ""}
                </p>
                <h2 className="text-2xl font-bold">{selected.title}</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Updated {date(selected.updated_at)} · Version{" "}
                  {selected.version + 1}
                </p>
                {selected.summary && (
                  <p className="text-lg leading-7">{selected.summary}</p>
                )}
              </header>
              <div className="flex flex-wrap gap-3">
                {selected.file_path && (
                  <>
                    <a
                      className={modalSaveButton}
                      href={`/help/files/${selected.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open PDF
                    </a>
                    <a
                      className={button}
                      href={`/help/files/${selected.id}?download=1`}
                    >
                      Download PDF
                    </a>
                  </>
                )}
                {admin && (
                  <>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => setEditor({ guide: selected })}
                    >
                      Edit guide
                    </button>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => setArchiveTarget(selected)}
                    >
                      {selected.archived ? "Restore guide" : "Archive guide"}
                    </button>
                  </>
                )}
              </div>
              {selected.file_name && (
                <p className="break-words text-sm text-[var(--text-secondary)]">
                  {selected.file_name} ·{" "}
                  {((selected.file_size || 0) / 1024 / 1024).toFixed(1)} MB
                </p>
              )}
              {selected.content ? (
                <div className="max-w-4xl space-y-5">
                  {selected.content.split(/\n\s*\n/).map((part, index) => (
                    <p
                      key={index}
                      className="whitespace-pre-wrap break-words leading-7"
                    >
                      {part}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-[var(--text-secondary)]">
                  Open the PDF above to read this guide and its screenshots.
                </p>
              )}
            </article>
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              This guide is unavailable or you do not have access to it.{" "}
              <Link className="underline" href="/help">
                Browse available guides
              </Link>
              .
            </div>
          )
        ) : (
          <>
            <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <label className="block font-semibold">
                Search guides
                <input
                  type="search"
                  className={`${field} mt-2`}
                  placeholder="Search titles, summaries and articles"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div
                className="flex flex-wrap gap-2"
                aria-label="Guide categories"
              >
                <button
                  className={`${button} ${!category ? "bg-[var(--accent)] text-white" : ""}`}
                  aria-pressed={!category}
                  onClick={() => setCategory("")}
                >
                  All categories
                </button>
                {categories.map((name) => (
                  <button
                    key={name}
                    className={`${button} ${category === name ? "bg-[var(--accent)] text-white" : ""}`}
                    aria-pressed={category === name}
                    onClick={() => setCategory(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {admin && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(e) => setIncludeArchived(e.target.checked)}
                  />
                  Include archived guides
                </label>
              )}
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              {visible.length} guide{visible.length === 1 ? "" : "s"}
            </p>
            <div className="grid gap-4 xl:grid-cols-2">
              {visible.map((guide) => (
                <article
                  key={guide.id}
                  className="flex flex-col items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                    {guide.category}
                    {guide.archived ? " · Archived" : ""}
                  </p>
                  <h2 className="text-xl font-bold">
                    <Link
                      className="hover:underline"
                      href={`/help/${guide.id}`}
                    >
                      {guide.title}
                    </Link>
                  </h2>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">
                    {guide.summary ||
                      "Open this guide to read the instructions."}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Updated {date(guide.updated_at)}
                    {guide.file_path ? " · PDF available" : " · Article"}
                  </p>
                  <Link
                    href={`/help/${guide.id}`}
                    className={`${button} mt-auto`}
                  >
                    Read guide
                  </Link>
                </article>
              ))}
            </div>
            {!visible.length && (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
                <h2 className="text-xl font-bold">
                  {guides.length
                    ? "No matching guides"
                    : "Your help centre is ready for its first guide"}
                </h2>
                <p className="mt-2 text-[var(--text-secondary)]">
                  {guides.length
                    ? "Try different words or another category."
                    : admin
                      ? "Click Add guide to upload the calling team PDF or write instructions for the team."
                      : "Your administrator will add your team's guides here."}
                </p>
                {(query || category) && (
                  <button
                    className={`${button} mt-4`}
                    onClick={() => {
                      setQuery("");
                      setCategory("");
                    }}
                  >
                    Clear search and category
                  </button>
                )}
              </div>
            )}
          </>
        ))
      )}
      {editor && admin && (
        <GuideEditor
          org={org}
          guide={editor.guide}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            setNotice("Guide saved and available to your team.");
            await load();
          }}
        />
      )}
      <ConfirmDialog
        open={!!archiveTarget}
        title={
          archiveTarget?.archived
            ? "Restore this guide?"
            : "Archive this guide?"
        }
        description={
          archiveTarget?.archived
            ? "This makes the guide available to the team again."
            : "This hides the guide from the team. Its contents and PDF are kept and can be restored by an admin."
        }
        confirmLabel={
          archiveTarget?.archived ? "Restore guide" : "Archive guide"
        }
        loading={busy}
        onCancel={() => {
          if (!busy) setArchiveTarget(null);
        }}
        onConfirm={() => {
          if (archiveTarget) void archive(archiveTarget);
        }}
      />
    </div>
  );
}

function GuideEditor({
  org,
  guide,
  onClose,
  onSaved,
}: {
  org: string;
  guide?: HelpGuide;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const initial = {
    title: guide?.title || "",
    category: guide?.category || "Getting started",
    summary: guide?.summary || "",
    content: guide?.content || "",
  };
  const [values, setValues] = useState(initial);
  const [file, setFile] = useState<File | null>(null);
  const [removePdf, setRemovePdf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const formId = useId();
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const title = values.title.trim(),
      category = values.category.trim(),
      content = values.content.trim();
    if (!title || !category) {
      setError("Enter a title and category.");
      return;
    }
    if (!content && !file && (!guide?.file_path || removePdf)) {
      setError("Write the guide content or attach a PDF.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    let uploadedPath: string | null = null;
    let metadataSaved = false;
    try {
      let filePath = removePdf ? null : guide?.file_path || null;
      let fileName = removePdf ? null : guide?.file_name || null;
      let fileSize = removePdf ? null : guide?.file_size || null;
      if (file) {
        await validateHelpPdf(file);
        if (file.name.length > 250)
          throw new Error("Use a PDF filename shorter than 250 characters.");
        const path = `${org}/${crypto.randomUUID()}/guide.pdf`;
        const upload = await supabase.storage
          .from(HELP_BUCKET)
          .upload(path, file, {
            contentType: "application/pdf",
            cacheControl: "0",
            upsert: false,
          });
        if (upload.error) throw new Error(upload.error.message);
        uploadedPath = path;
        filePath = path;
        fileName = file.name;
        fileSize = file.size;
      }
      const payload = {
        title,
        category,
        summary: values.summary.trim(),
        content,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
      };
      const result = guide
        ? await supabase
            .from("help_guides")
            .update(payload)
            .eq("id", guide.id)
            .eq("organisation_id", org)
            .eq("version", guide.version)
            .select("id")
            .maybeSingle()
        : await supabase
            .from("help_guides")
            .insert({ ...payload, organisation_id: org })
            .select("id")
            .single();
      if (result.error) throw new Error(result.error.message);
      if (!result.data)
        throw new Error(
          "This guide was changed by someone else. Copy your draft before closing, refresh and open the latest version.",
        );
      metadataSaved = true;
      await onSaved();
    } catch (err) {
      if (uploadedPath && !metadataSaved) {
        try {
          await supabase.storage.from(HELP_BUCKET).remove([uploadedPath]);
        } catch {
          /* An unreferenced file is not visible to the team. */
        }
      }
      setError(message(err));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <Modal
      title={guide ? "Edit help guide" : "Add help guide"}
      description="Write an article, attach a PDF, or include both. Saved guides are visible to your organisation."
      wide
      onClose={onClose}
      busy={busy}
      dirty={
        JSON.stringify(values) !== JSON.stringify(initial) ||
        !!file ||
        removePdf
      }
      formId={formId}
      footer={
        <button
          form={formId}
          type="submit"
          className={modalSaveButton}
          disabled={busy}
        >
          {busy ? "Saving guide…" : "Save guide"}
        </button>
      }
    >
      <form id={formId} onSubmit={save}>
        <fieldset disabled={busy} className="space-y-5">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-300 p-4 text-red-700"
            >
              {error} Your draft remains available.
            </p>
          )}
          <label className="block font-semibold">
            Title
            <input
              required
              maxLength={160}
              autoFocus
              className={`${field} mt-2`}
              value={values.title}
              onChange={(e) =>
                setValues((v) => ({ ...v, title: e.target.value }))
              }
              placeholder="For example, Calling tasks team guide"
            />
          </label>
          <label className="block font-semibold">
            Category
            <input
              required
              maxLength={80}
              list={`${formId}-categories`}
              className={`${field} mt-2`}
              value={values.category}
              onChange={(e) =>
                setValues((v) => ({ ...v, category: e.target.value }))
              }
            />
            <datalist id={`${formId}-categories`}>
              {HELP_CATEGORIES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="block font-semibold">
            Short description
            <textarea
              maxLength={600}
              rows={2}
              className={`${field} mt-2`}
              value={values.summary}
              onChange={(e) =>
                setValues((v) => ({ ...v, summary: e.target.value }))
              }
            />
          </label>
          <label className="block font-semibold">
            Guide content
            <textarea
              rows={12}
              maxLength={60000}
              className={`${field} mt-2 font-normal leading-6`}
              value={values.content}
              onChange={(e) =>
                setValues((v) => ({ ...v, content: e.target.value }))
              }
              placeholder="Write the instructions here. Separate paragraphs with a blank line. Leave blank if the full guide is in the attached PDF."
            />
          </label>
          <div className="space-y-3 rounded-xl border border-[var(--border)] p-4">
            <label className="block font-semibold">
              {guide?.file_path
                ? "Replace PDF (optional)"
                : "Attach PDF (optional)"}
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="mt-2 block w-full text-sm font-normal"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setRemovePdf(false);
                }}
              />
            </label>
            <p className="text-xs text-[var(--text-secondary)]">
              PDF only, up to 10 MB. Screenshots can be included in your PDF.
            </p>
            {file && (
              <button
                className={button}
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
              >
                Clear selected PDF
              </button>
            )}
            {guide?.file_name && !file && (
              <>
                <p className="break-words text-sm">
                  Current PDF: {guide.file_name}
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={removePdf}
                    onChange={(e) => setRemovePdf(e.target.checked)}
                  />
                  Remove the PDF from this guide
                </label>
              </>
            )}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
