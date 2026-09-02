"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Contact = {
  id: string;
  company_id: string | number;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
};

type ContactForm = {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
};

const emptyForm: ContactForm = {
  firstName: "",
  lastName: "",
  jobTitle: "",
  email: "",
  phone: "",
};

export default function ContactList({
  companyId,
  onContactCountChange,
}: {
  companyId: string | number;
  onContactCountChange?: (count: number) => void;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshingPage, setRefreshingPage] = useState(false);

  const emailIsValid = useMemo(() => {
    if (!form.email.trim()) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  }, [form.email]);

  const hasName = Boolean(form.firstName.trim() || form.lastName.trim());

  const loadContacts = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("company_id", companyId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });

    if (error) {
      setLoadError(error.message);
      setContacts([]);
      onContactCountChange?.(0);
    } else {
      const nextContacts = (data || []) as Contact[];
      setContacts(nextContacts);
      onContactCountChange?.(nextContacts.length);
    }

    setLoading(false);
  }, [companyId, onContactCountChange]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  function updateForm(field: keyof ContactForm, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openAddModal() {
    setEditingContact(null);
    setForm(emptyForm);
    setSaveError("");
    setSubmitted(false);
    setModalOpen(true);
  }

  function openEditModal(contact: Contact) {
    setEditingContact(contact);
    setForm({
      firstName: contact.first_name || "",
      lastName: contact.last_name || "",
      jobTitle: contact.job_title || "",
      email: contact.email || "",
      phone: contact.phone || "",
    });
    setSaveError("");
    setSubmitted(false);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingContact(null);
    setForm(emptyForm);
    setSaveError("");
    setSubmitted(false);
  }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setSaveError("");

    if (!hasName) {
      setSaveError("Enter at least a first name or last name.");
      return;
    }

    if (!emailIsValid) {
      setSaveError("Enter a valid email address.");
      return;
    }

    setSaving(true);

    const payload = {
      company_id: companyId,
      first_name: form.firstName.trim() || null,
      last_name: form.lastName.trim() || null,
      job_title: form.jobTitle.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
    };

    const wasEditing = Boolean(editingContact);

    const { error } = editingContact
      ? await supabase
          .from("contacts")
          .update(payload)
          .eq("id", editingContact.id)
      : await supabase.from("contacts").insert(payload);

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }

    if (!wasEditing) {
      onContactCountChange?.(contacts.length + 1);
    }

    setSaving(false);
    setModalOpen(false);
    setRefreshingPage(true);

    window.location.reload();
  }

  async function deleteContact(contact: Contact) {
    const name =
      [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
      "this contact";

    const confirmed = window.confirm(
      `Delete ${name}? This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingId(contact.id);
    setLoadError("");

    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", contact.id);

    if (error) {
      setLoadError(error.message);
      setDeletingId(null);
      return;
    }

    setDeletingId(null);

    onContactCountChange?.(Math.max(0, contacts.length - 1));

    await loadContacts();
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Company contacts</h3>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            People associated with this company.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)]"
        >
          + Add contact
        </button>
      </div>

      {loadError ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] p-10 text-center">
          <p className="text-sm font-semibold text-[var(--text-secondary)]">
            Loading contacts...
          </p>
        </div>
      ) : null}

      {!loading && !loadError && contacts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-xl shadow-sm">
            👤
          </div>

          <h4 className="mt-4 text-base font-bold text-[var(--text-primary)]">
            No contacts yet
          </h4>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
            Add decision-makers, technical contacts, finance contacts and other
            people linked to this company.
          </p>

          <button
            type="button"
            onClick={openAddModal}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)]"
          >
            + Add your first contact
          </button>
        </div>
      ) : null}

      {!loading && !loadError && contacts.length > 0 ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {contacts.map((contact) => {
            const name =
              [contact.first_name, contact.last_name]
                .filter(Boolean)
                .join(" ") || "Unnamed contact";

            const initials =
              [contact.first_name, contact.last_name]
                .filter(Boolean)
                .map((part) => part?.charAt(0).toUpperCase())
                .join("")
                .slice(0, 2) || "?";

            return (
              <article
                key={contact.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-sm font-black text-[var(--text-primary)]">
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-base font-bold text-[var(--text-primary)]">
                      {name}
                    </h4>

                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {contact.job_title || "Job title not recorded"}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(contact)}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] transition hover:bg-[var(--surface)]"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteContact(contact)}
                      disabled={deletingId === contact.id}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingId === contact.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>

                <div className="mt-5 space-y-3 border-t border-[var(--border)] pt-4">
                  <ContactDetail
                    label="Email"
                    value={
                      contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="break-all text-[var(--accent)] hover:underline"
                        >
                          {contact.email}
                        </a>
                      ) : (
                        "Not recorded"
                      )
                    }
                  />

                  <ContactDetail
                    label="Phone"
                    value={
                      contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-[var(--accent)] hover:underline"
                        >
                          {contact.phone}
                        </a>
                      ) : (
                        "Not recorded"
                      )
                    }
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={closeModal}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">
                  {editingContact ? "Edit contact" : "Add contact"}
                </h3>

                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {editingContact
                    ? "Update this contact's information."
                    : "Add a person associated with this company."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={saveContact} className="mt-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField
                  label="First name"
                  value={form.firstName}
                  onChange={(value) => updateForm("firstName", value)}
                  autoFocus
                  invalid={submitted && !hasName}
                />

                <FormField
                  label="Last name"
                  value={form.lastName}
                  onChange={(value) => updateForm("lastName", value)}
                  invalid={submitted && !hasName}
                />

                <FormField
                  label="Job title"
                  value={form.jobTitle}
                  onChange={(value) => updateForm("jobTitle", value)}
                />

                <FormField
                  label="Phone"
                  value={form.phone}
                  onChange={(value) => updateForm("phone", value)}
                  inputType="tel"
                />

                <div className="sm:col-span-2">
                  <FormField
                    label="Email"
                    value={form.email}
                    onChange={(value) => updateForm("email", value)}
                    inputType="email"
                    invalid={!emailIsValid}
                    helperText={
                      !emailIsValid ? "Enter a valid email address." : undefined
                    }
                  />
                </div>
              </div>

              <p className="mt-4 text-xs text-[var(--text-secondary)]">
                Enter at least a first name or last name.
              </p>

              {saveError ? (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {saveError}
                </div>
              ) : null}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingContact
                      ? "Save changes →"
                      : "Save contact →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {refreshingPage ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-8 py-7 text-center shadow-xl">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
            <p className="mt-4 text-sm font-bold text-[var(--text-primary)]">
              Updating contacts...
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ContactDetail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[90px_1fr] sm:items-start">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>

      <span className="text-sm font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  inputType = "text",
  autoFocus = false,
  invalid = false,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputType?: "text" | "email" | "tel";
  autoFocus?: boolean;
  invalid?: boolean;
  helperText?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-[var(--text-primary)]">{label}</span>

      <input
        type={inputType}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoFocus={autoFocus}
        aria-invalid={invalid}
        className={`mt-2 w-full rounded-xl border bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-slate-400 focus:ring-2 ${
          invalid
            ? "border-red-300 focus:border-red-400 focus:ring-red-100"
            : "border-[var(--border)] focus:border-[var(--accent)] focus:ring-[var(--accent)]/20"
        }`}
      />

      {helperText ? (
        <span className="mt-2 block text-xs font-medium text-red-600">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}
