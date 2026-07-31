import { supabase } from "@/lib/supabase";

import type {
  CompanyPayload,
  ExistingCompany,
} from "@/modules/companies/types";

export async function listCompaniesForDuplicateCheck(): Promise<
  ExistingCompany[]
> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, company_name, status, industry, division");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ExistingCompany[];
}

export async function createCompanyRecord(
  payload: CompanyPayload,
): Promise<string> {
  const { data, error } = await supabase
    .from("companies")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error(
      "The company was created but its ID could not be returned.",
    );
  }

  return String(data.id);
}

export async function updateCompanyRecord(
  companyId: string,
  payload: CompanyPayload,
): Promise<void> {
  const { error } = await supabase
    .from("companies")
    .update(payload)
    .eq("id", companyId);

  if (error) {
    throw new Error(error.message);
  }
}
