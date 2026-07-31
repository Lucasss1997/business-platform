import type { CompanyFormValues } from "@/lib/types/company";

export type ExistingCompany = {
  id: string | number;
  company_name: string;
  status: string | null;
  industry: string | null;
  division: string | null;
};

export type CompanyPayload = {
  company_name: string;
  website: string | null;
  phone: string | null;
  industry: string | null;
  contact_name: string | null;
  email: string | null;
  mobile: string | null;
  division: string | null;
  status: string;
  lead_source: string | null;
  annual_value: number;
  notes: string | null;
};

export type CompanyChange = {
  key: keyof CompanyFormValues;
  label: string;
  previousValue: string;
  nextValue: string;
};
