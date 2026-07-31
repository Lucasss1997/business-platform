import type { CompanyFormValues } from "@/lib/types/company";
import { emitEvent } from "@/platform/events";

import {
  createCompanyRecord,
  listCompaniesForDuplicateCheck,
  updateCompanyRecord,
} from "@/modules/companies/repository";

import type {
  CompanyChange,
  CompanyPayload,
  ExistingCompany,
} from "@/modules/companies/types";

const trackedFields: {
  key: keyof CompanyFormValues;
  label: string;
}[] = [
  { key: "company_name", label: "Company name" },
  { key: "website", label: "Website" },
  { key: "phone", label: "Phone" },
  { key: "industry", label: "Industry" },
  { key: "contact_name", label: "Primary contact" },
  { key: "email", label: "Email" },
  { key: "mobile", label: "Mobile" },
  { key: "division", label: "Division" },
  { key: "status", label: "Status" },
  { key: "lead_source", label: "Lead source" },
  { key: "annual_value", label: "Annual value" },
  { key: "notes", label: "Notes" },
];

export function normaliseCompanyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCompanyPayload(
  values: CompanyFormValues,
): CompanyPayload {
  return {
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
    annual_value: values.annual_value ?? 0,
    notes: values.notes?.trim() || null,
  };
}

function formatActivityValue(
  key: keyof CompanyFormValues,
  value: CompanyPayload[keyof CompanyPayload],
) {
  if (key === "annual_value") {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  }

  if (key === "notes") {
    return value ? "Notes present" : "No notes";
  }

  return String(value || "Not recorded");
}

export function getCompanyChanges(
  initialValues: CompanyFormValues,
  nextValues: CompanyPayload,
): CompanyChange[] {
  const initial = buildCompanyPayload(initialValues);

  return trackedFields.flatMap(({ key, label }) => {
    const previousValue = initial[key];
    const nextValue = nextValues[key];

    if (previousValue === nextValue) {
      return [];
    }

    return [
      {
        key,
        label,
        previousValue: formatActivityValue(key, previousValue),
        nextValue: formatActivityValue(key, nextValue),
      },
    ];
  });
}

export async function findDuplicateCompany(
  companyName: string,
  currentCompanyId?: string,
): Promise<ExistingCompany | null> {
  const normalisedName = normaliseCompanyName(companyName);

  if (!normalisedName) {
    return null;
  }

  const companies = await listCompaniesForDuplicateCheck();

  return (
    companies.find((company) => {
      if (
        currentCompanyId &&
        String(company.id) === String(currentCompanyId)
      ) {
        return false;
      }

      return (
        normaliseCompanyName(company.company_name) === normalisedName
      );
    }) ?? null
  );
}

export async function createCompany(
  values: CompanyFormValues,
  actorName = "Lucas",
): Promise<string> {
  const payload = buildCompanyPayload(values);
  const companyId = await createCompanyRecord(payload);

  await emitEvent({
    companyId,
    entityType: "company",
    entityId: companyId,
    action: "created",
    description: `${payload.company_name} was created`,
    actorName,
    metadata: {
      company_name: payload.company_name,
      status: payload.status,
      annual_value: payload.annual_value,
    },
  });

  return companyId;
}

export async function updateCompany(
  companyId: string,
  values: CompanyFormValues,
  initialValues: CompanyFormValues,
  actorName = "Lucas",
): Promise<void> {
  const payload = buildCompanyPayload(values);
  const changes = getCompanyChanges(initialValues, payload);

  await updateCompanyRecord(companyId, payload);

  if (changes.length === 0) {
    await emitEvent({
      companyId,
      entityType: "company",
      entityId: companyId,
      action: "updated",
      description: `${payload.company_name} was saved with no recorded field changes`,
      actorName,
      metadata: {
        company_name: payload.company_name,
      },
    });

    return;
  }

  for (const change of changes) {
    await emitEvent({
      companyId,
      entityType: "company",
      entityId: companyId,
      action: "updated",
      description: `${change.label} changed from ${change.previousValue} to ${change.nextValue}`,
      actorName,
      metadata: {
        field: String(change.key),
        previous_value: change.previousValue,
        new_value: change.nextValue,
      },
    });
  }
}
