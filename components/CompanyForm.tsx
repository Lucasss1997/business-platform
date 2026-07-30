"use client";

import {
  type FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import {
  companyStatuses,
  divisions,
  type CompanyFormValues,
} from "@/lib/types/company";

const industries = [
  "Construction",
  "Manufacturing",
  "Logistics",
  "Retail",
  "Healthcare",
  "Education",
  "Hospitality",
  "Managed Print",
  "Energy",
  "Telecoms",
  "Professional Services",
  "Other",
];

const emptyValues: CompanyFormValues = {
  company_name: "",
  website: "",
  phone: "",
  industry: "",
  contact_name: "",
  email: "",
  mobile: "",
  division: "",
  status: "Prospect",
  lead_source: "",
  annual_value: null,
  notes: "",
};

type ExistingCompany = {
  id: string | number;
  company_name: string;
  status: string | null;
  industry: string | null;
  division: string | null;
};

type DuplicateCheckContext = "name-field" | "submit";

type CompanyFormProps = {
  companyId?: string;
  initialValues?: Partial<CompanyFormValues>;
};

function normaliseCompanyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function CompanyForm({
  companyId,
  initialValues,
}: CompanyFormProps) {
  const router = useRouter();

  const [values, setValues] = useState<CompanyFormValues>({
    ...emptyValues,
    ...initialValues,
  });

  const [saving, setSaving] = useState(false);
  const [checkingName, setCheckingName] = useState(false);
  const [error, setError] = useState("");

  const [duplicateCompany, setDuplicateCompany] =
    useState<ExistingCompany | null>(null);

  const [duplicateCheckContext, setDuplicateCheckContext] =
    useState<DuplicateCheckContext>("name-field");

  const [approvedDuplicateName, setApprovedDuplicateName] =
    useState("");

  const inputClass =
    "mt-2 w-full rounded-xl border border-[var(--border)] bg-white px-3.5 py-3 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

  const labelClass = "text-sm font-semibold text-slate-700";

  function update(
    name: keyof CompanyFormValues,
    value: string,
  ) {
    setValues((current) => ({
      ...current,
      [name]:
        name === "annual_value"
          ? value === ""
            ? null
            : Number(value)
          : value,
    }));

    if (name === "company_name") {
      setApprovedDuplicateName("");
      setDuplicateCompany(null);
    }
  }

  async function findExistingCompany(
    companyName: string,
  ): Promise<ExistingCompany | null> {
    const normalisedName = normaliseCompanyName(companyName);

    if (!normalisedName) {
      return null;
    }

    const { data, error: checkError } = await supabase
      .from("companies")
      .select(
        "id, company_name, status, industry, division",
      );

    if (checkError) {
      throw new Error(checkError.message);
    }

    const companies = (data ?? []) as ExistingCompany[];

    return (
      companies.find((company) => {
        const isCurrentCompany =
          companyId &&
          String(company.id) === String(companyId);

        if (isCurrentCompany) {
          return false;
        }

        return (
          normaliseCompanyName(company.company_name) ===
          normalisedName
        );
      }) ?? null
    );
  }

  async function checkNameOnBlur() {
    if (companyId) {
      return;
    }

    const companyName = values.company_name.trim();
    const normalisedName =
      normaliseCompanyName(companyName);

    if (
      companyName.length < 2 ||
      approvedDuplicateName === normalisedName
    ) {
      return;
    }

    setCheckingName(true);
    setError("");

    try {
      const existingCompany =
        await findExistingCompany(companyName);

      if (existingCompany) {
        setDuplicateCheckContext("name-field");
        setDuplicateCompany(existingCompany);
      }
    } catch (checkError) {
      setError(
        checkError instanceof Error
          ? checkError.message
          : "The company name could not be checked.",
      );
    } finally {
      setCheckingName(false);
    }
  }

  function buildPayload() {
    return {
      ...values,
      company_name: values.company_name.trim(),
      website: values.website?.trim() || null,
      phone: values.phone?.trim() || null,
      industry: values.industry || null,
      contact_name: values.contact_name?.trim() || null,
      email: values.email?.trim() || null,
      mobile: values.mobile?.trim() || null,
      division: values.division || null,
      status: values.status || "Prospect",
      lead_source: values.lead_source?.trim() || null,
      annual_value: values.annual_value || 0,
      notes: values.notes?.trim() || null,
    };
  }

  async function saveCompany() {
    setSaving(true);
    setError("");

    const payload = buildPayload();

    const result = companyId
      ? await supabase
          .from("companies")
          .update(payload)
          .eq("id", companyId)
      : await supabase
          .from("companies")
          .insert(payload);

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    router.push(
      companyId
        ? `/companies/${companyId}`
        : "/companies",
    );

    router.refresh();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const companyName = values.company_name.trim();

    if (!companyName) {
      setError("Please enter a company name.");
      return;
    }

    setSaving(true);
    setError("");

    if (!companyId) {
      const normalisedName =
        normaliseCompanyName(companyName);

      if (approvedDuplicateName !== normalisedName) {
        try {
          const existingCompany =
            await findExistingCompany(companyName);

          if (existingCompany) {
            setDuplicateCheckContext("submit");
            setDuplicateCompany(existingCompany);
            setSaving(false);
            return;
          }
        } catch (checkError) {
          setError(
            checkError instanceof Error
              ? checkError.message
              : "The company name could not be checked.",
          );

          setSaving(false);
          return;
        }
      }
    }

    await saveCompany();
  }

  function useExistingCompany() {
    if (!duplicateCompany) {
      return;
    }

    router.push(
      `/companies/${duplicateCompany.id}`,
    );
  }

  function addAsNewCompany() {
    const approvedName = normaliseCompanyName(
      values.company_name,
    );

    setApprovedDuplicateName(approvedName);
    setDuplicateCompany(null);

    if (duplicateCheckContext === "submit") {
      void saveCompany();
    }
  }

  function closeDuplicateWarning() {
    setDuplicateCompany(null);
    setDuplicateCheckContext("name-field");
  }

  return (
    <>
      <form
        onSubmit={submit}
        className="space-y-8"
      >
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">
            Company details
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className={labelClass}>
              Company name *

              <div className="relative">
                <input
                  required
                  className={inputClass}
                  value={values.company_name}
                  onChange={(event) =>
                    update(
                      "company_name",
                      event.target.value,
                    )
                  }
                  onBlur={() => {
                    void checkNameOnBlur();
                  }}
                  placeholder="Enter company name"
                />

                {checkingName ? (
                  <span className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-xs font-medium text-slate-400">
                    Checking…
                  </span>
                ) : null}
              </div>
            </label>

            <label className={labelClass}>
              Website

              <input
                className={inputClass}
                value={values.website || ""}
                onChange={(event) =>
                  update("website", event.target.value)
                }
                placeholder="https://example.co.uk"
              />
            </label>

            <label className={labelClass}>
              Phone

              <input
                className={inputClass}
                value={values.phone || ""}
                onChange={(event) =>
                  update("phone", event.target.value)
                }
                placeholder="Main office number"
              />
            </label>

            <label className={labelClass}>
              Industry

              <select
                className={inputClass}
                value={values.industry || ""}
                onChange={(event) =>
                  update("industry", event.target.value)
                }
              >
                <option value="">
                  Select industry
                </option>

                {industries.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">
            Primary contact
          </h2>

          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            We can move this into a full contacts module
            in v0.2.
          </p>

          <div className="mt-5 grid gap-5 md:grid-cols-3">
            <label className={labelClass}>
              Contact name

              <input
                className={inputClass}
                value={values.contact_name || ""}
                onChange={(event) =>
                  update(
                    "contact_name",
                    event.target.value,
                  )
                }
                placeholder="Full name"
              />
            </label>

            <label className={labelClass}>
              Email

              <input
                type="email"
                className={inputClass}
                value={values.email || ""}
                onChange={(event) =>
                  update("email", event.target.value)
                }
                placeholder="name@company.co.uk"
              />
            </label>

            <label className={labelClass}>
              Mobile

              <input
                className={inputClass}
                value={values.mobile || ""}
                onChange={(event) =>
                  update("mobile", event.target.value)
                }
                placeholder="Mobile number"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">
            Commercial information
          </h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <label className={labelClass}>
              Division

              <select
                className={inputClass}
                value={values.division || ""}
                onChange={(event) =>
                  update("division", event.target.value)
                }
              >
                <option value="">
                  Select division
                </option>

                {divisions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Status

              <select
                className={inputClass}
                value={values.status || "Prospect"}
                onChange={(event) =>
                  update("status", event.target.value)
                }
              >
                {companyStatuses.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              Lead source

              <input
                className={inputClass}
                value={values.lead_source || ""}
                onChange={(event) =>
                  update(
                    "lead_source",
                    event.target.value,
                  )
                }
                placeholder="Referral, website, outbound..."
              />
            </label>

            <label className={labelClass}>
              Annual value (£)

              <input
                min="0"
                step="0.01"
                type="number"
                className={inputClass}
                value={values.annual_value ?? ""}
                onChange={(event) =>
                  update(
                    "annual_value",
                    event.target.value,
                  )
                }
                placeholder="0"
              />
            </label>
          </div>

          <label
            className={`${labelClass} mt-5 block`}
          >
            Notes

            <textarea
              rows={5}
              className={inputClass}
              value={values.notes || ""}
              onChange={(event) =>
                update("notes", event.target.value)
              }
              placeholder="Useful background, current requirements and next steps"
            />
          </label>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            disabled={saving || checkingName}
            className="rounded-xl bg-[var(--text-primary)] px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : companyId
                ? "Save changes"
                : "Create company"}
          </button>
        </div>
      </form>

      {duplicateCompany ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="duplicate-company-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-600">
                  Possible duplicate
                </p>

                <h2
                  id="duplicate-company-title"
                  className="mt-1 text-xl font-bold text-slate-900"
                >
                  Company already exists
                </h2>
              </div>

              <button
                type="button"
                onClick={closeDuplicateWarning}
                aria-label="Close duplicate warning"
                className="rounded-lg px-2 py-1 text-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              A company with the same name is already in
              the CRM. Check the existing record before
              creating another one.
            </p>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="font-bold text-slate-900">
                {duplicateCompany.company_name}
              </p>

              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">
                  {duplicateCompany.status ||
                    "No status"}
                </span>

                {duplicateCompany.industry ? (
                  <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">
                    {duplicateCompany.industry}
                  </span>
                ) : null}

                {duplicateCompany.division ? (
                  <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">
                    {duplicateCompany.division}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={useExistingCompany}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
              >
                Use existing company
              </button>

              <button
                type="button"
                onClick={addAsNewCompany}
                className="rounded-xl border border-[var(--border)] bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Add as a new company anyway
              </button>

              <button
                type="button"
                onClick={closeDuplicateWarning}
                className="px-5 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                Cancel
              </button>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-400">
              Choosing “Add as a new company anyway” does
              not merge or alter the existing record.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}