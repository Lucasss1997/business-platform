export const companyStatuses = [
  "Prospect",
  "Qualified",
  "Proposal Sent",
  "Customer",
  "Inactive",
] as const;

export const divisions = [
  "MLT Consultants",
  "Fuel Save Group",
  "OC Digital",
] as const;

export type CompanyStatus = (typeof companyStatuses)[number];
export type Division = (typeof divisions)[number];

export type Company = {
  id: string | number;
  company_name: string;
  website: string | null;
  phone: string | null;
  industry: string | null;
  contact_name: string | null;
  email: string | null;
  mobile: string | null;
  division: string | null;
  status: string | null;
  lead_source: string | null;
  annual_value: number | null;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CompanyFormValues = Omit<Company, "id" | "created_at" | "updated_at"> & {
  annual_value: number | null;
};
