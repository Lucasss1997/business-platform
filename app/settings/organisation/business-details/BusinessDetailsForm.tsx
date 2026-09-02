"use client";

import { useState } from "react";

type Organisation = {
  id: string;
  name: string;
  legal_name: string | null;
  trading_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  town_city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  company_number: string | null;
  vat_number: string | null;
  telephone: string | null;
  email: string | null;
  website: string | null;
};

export default function BusinessDetailsForm({
  organisation,
}: {
  organisation: Organisation;
}) {
  const [form, setForm] = useState({
    legal_name: organisation.legal_name || organisation.name || "",
    trading_name: organisation.trading_name || "",
    address_line_1: organisation.address_line_1 || "",
    address_line_2: organisation.address_line_2 || "",
    town_city: organisation.town_city || "",
    county: organisation.county || "",
    postcode: organisation.postcode || "",
    country: organisation.country || "United Kingdom",
    company_number: organisation.company_number || "",
    vat_number: organisation.vat_number || "",
    telephone: organisation.telephone || "",
    email: organisation.email || "",
    website: organisation.website || "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function updateField(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/organisation/business-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisationId: organisation.id,
          ...form,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save business details.");
      }

      setMessage("Business details saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save business details."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)]";

  const labelClass =
    "mb-2 block text-sm font-medium text-[var(--text-primary)]";

  return (
    <div className="max-w-4xl space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Company information
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass}>Legal company name</label>
            <input className={inputClass} value={form.legal_name}
              onChange={(e) => updateField("legal_name", e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Trading name</label>
            <input className={inputClass} value={form.trading_name}
              onChange={(e) => updateField("trading_name", e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Company number</label>
            <input className={inputClass} value={form.company_number}
              onChange={(e) => updateField("company_number", e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>VAT number</label>
            <input className={inputClass} value={form.vat_number}
              onChange={(e) => updateField("vat_number", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Address
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {[
            ["address_line_1", "Address line 1"],
            ["address_line_2", "Address line 2"],
            ["town_city", "Town / City"],
            ["county", "County"],
            ["postcode", "Postcode"],
            ["country", "Country"],
          ].map(([key, label]) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input
                className={inputClass}
                value={form[key as keyof typeof form]}
                onChange={(e) => updateField(key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Contact details
        </h2>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass}>Telephone</label>
            <input className={inputClass} value={form.telephone}
              onChange={(e) => updateField("telephone", e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Email</label>
            <input type="email" className={inputClass} value={form.email}
              onChange={(e) => updateField("email", e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Website</label>
            <input className={inputClass} value={form.website}
              onChange={(e) => updateField("website", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save business details"}
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
