"use client";

import { useEffect, useRef, useState } from "react";

type BrandingFormProps = {
  organisationId: string;
  initialName: string;
  initialLogoUrl: string;
  initialPrimaryColour: string;
  initialEmailFooter: string;
};

export default function BrandingForm({
  organisationId,
  initialName,
  initialLogoUrl,
  initialPrimaryColour,
  initialEmailFooter,
}: BrandingFormProps) {
  const [name, setName] = useState(initialName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(initialLogoUrl);
  const [primaryColour, setPrimaryColour] = useState(initialPrimaryColour);
  const [emailFooter, setEmailFooter] = useState(initialEmailFooter);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(logoUrl);
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [logoFile, logoUrl]);

  function handleLogoSelected(file: File | null) {
    setMessage("");

    if (!file) {
      setLogoFile(null);
      return;
    }

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setMessage("Please choose a PNG, JPG or WebP image.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage("Logo must be 2 MB or smaller.");
      return;
    }

    setLogoFile(file);
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const formData = new FormData();

      formData.append("organisationId", organisationId);
      formData.append("name", name);
      formData.append("brandPrimaryColour", primaryColour);
      formData.append("emailFooterText", emailFooter);

      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const response = await fetch("/api/organisation/branding", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save branding.");
      }

      if (data.logoUrl) {
        setLogoUrl(data.logoUrl);
        setLogoPreviewUrl(data.logoUrl);
      }

      setLogoFile(null);
      setMessage("Branding saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save branding."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div>
        <h2 className="font-semibold text-[var(--text-primary)]">
          Master branding
        </h2>

        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          These details are used across customer-facing emails, secure shares
          and other white-labelled content.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text-primary)]">
          Organisation name
        </label>

        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
        />
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-[var(--text-primary)]">
            Master logo
          </label>

          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            PNG, JPG or WebP. Maximum file size 2 MB. A transparent PNG is recommended.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) =>
            handleLogoSelected(event.target.files?.[0] || null)
          }
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--background)] px-6 py-8 text-center transition hover:border-[var(--accent)] hover:bg-[var(--surface-muted)]"
        >
          {logoPreviewUrl ? (
            <img
              src={logoPreviewUrl}
              alt={`${name} logo preview`}
              className="mb-5 max-h-24 max-w-[320px] object-contain"
            />
          ) : (
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-2xl font-bold text-[var(--text-secondary)]">
              +
            </div>
          )}

          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {logoPreviewUrl ? "Choose a different logo" : "Choose logo"}
          </span>

          <span className="mt-1 text-xs text-[var(--text-secondary)]">
            Click to browse your files
          </span>
        </button>

        {logoFile && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                {logoFile.name}
              </div>

              <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {(logoFile.size / 1024).toFixed(0)} KB selected
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setLogoFile(null);

                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
              className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--background)]"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text-primary)]">
          Primary brand colour
        </label>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColour}
            onChange={(event) => setPrimaryColour(event.target.value)}
            className="h-11 w-14 cursor-pointer rounded-lg border border-[var(--border)] bg-transparent"
          />

          <input
            value={primaryColour}
            onChange={(event) => setPrimaryColour(event.target.value)}
            className="w-32 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-[var(--text-primary)]">
          Email footer
        </label>

        <textarea
          value={emailFooter}
          onChange={(event) => setEmailFooter(event.target.value)}
          rows={4}
          placeholder="Optional customer-facing footer text"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]">
        <div className="border-b border-[var(--border)] px-5 py-3">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            Customer preview
          </div>
        </div>

        <div className="p-6">
          {logoPreviewUrl && (
            <img
              src={logoPreviewUrl}
              alt=""
              className="mb-6 max-h-16 max-w-[240px] object-contain"
            />
          )}

          <div className="text-lg font-semibold text-[var(--text-primary)]">
            {name}
          </div>

          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            A document has been securely shared with you.
          </p>

          <button
            type="button"
            style={{ backgroundColor: primaryColour }}
            className="mt-5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
          >
            View secure document
          </button>

          {emailFooter && (
            <p className="mt-6 whitespace-pre-line border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--text-secondary)]">
              {emailFooter}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save branding"}
        </button>

        {message && (
          <span className="text-sm text-[var(--text-secondary)]">
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
