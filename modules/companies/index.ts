export {
  buildCompanyPayload,
  createCompany,
  findDuplicateCompany,
  getCompanyChanges,
  normaliseCompanyName,
  updateCompany,
} from "@/modules/companies/service";

export type {
  CompanyChange,
  CompanyPayload,
  ExistingCompany,
} from "@/modules/companies/types";
