import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity";

export const PROPOSAL_STATUSES = [
  "draft",
  "ready",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "archived",
] as const;

export type ProposalStatus =
  (typeof PROPOSAL_STATUSES)[number];

export interface Proposal {
  id: string;
  company_id: string;
  opportunity_id: string | null;
  proposal_number: string;
  title: string;
  introduction: string | null;
  scope: string | null;
  terms: string | null;
  notes: string | null;
  status: ProposalStatus;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  valid_until: string | null;
  contact_name: string | null;
  contact_email: string | null;
  version: number;
  document_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProposalItem {
  id: string;
  proposal_id: string;
  position: number;
  title: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  line_total: number;
  created_at?: string;
  updated_at?: string;
}

export type ServiceResult<T> =
  | {
      success: true;
      data: T;
      error: "";
    }
  | {
      success: false;
      data: null;
      error: string;
    };

export interface CreateProposalInput {
  company_id: string;
  opportunity_id?: string;
  title: string;
  introduction?: string;
  scope?: string;
  terms?: string;
  notes?: string;
  contact_name?: string;
  contact_email?: string;
  valid_until?: string;
  created_by?: string;
}

export interface UpdateProposalInput {
  title?: string;
  introduction?: string;
  scope?: string;
  terms?: string;
  notes?: string;
  status?: ProposalStatus;
  contact_name?: string;
  contact_email?: string;
  valid_until?: string;
  document_id?: string | null;
}

async function generateProposalNumber(): Promise<string> {
  const year = new Date().getFullYear();

  const { data, error } = await supabase
    .from("proposals")
    .select("proposal_number")
    .like("proposal_number", `PROP-${year}-%`)
    .order("proposal_number", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  let nextNumber = 1;

  if (data && data.length > 0) {
    const currentNumber = data[0].proposal_number;
    const parts = currentNumber.split("-");
    const sequence = Number(parts[2]);

    if (Number.isFinite(sequence)) {
      nextNumber = sequence + 1;
    }
  }

  return `PROP-${year}-${String(nextNumber).padStart(4, "0")}`;
}

export async function createProposal(
  input: CreateProposalInput,
): Promise<ServiceResult<Proposal>> {
  try {
    const companyId = input.company_id.trim();
    const title = input.title.trim();
    const actorName = input.created_by?.trim() || "System";

    if (!companyId) {
      return {
        success: false,
        data: null,
        error: "A company is required.",
      };
    }

    if (!title) {
      return {
        success: false,
        data: null,
        error: "A proposal title is required.",
      };
    }

    const proposalNumber = await generateProposalNumber();

    const { data, error } = await supabase
      .from("proposals")
      .insert({
        company_id: companyId,
        opportunity_id: input.opportunity_id?.trim() || null,
        proposal_number: proposalNumber,
        title,
        introduction: input.introduction?.trim() || null,
        scope: input.scope?.trim() || null,
        terms: input.terms?.trim() || null,
        notes: input.notes?.trim() || null,
        contact_name: input.contact_name?.trim() || null,
        contact_email: input.contact_email?.trim() || null,
        valid_until: input.valid_until || null,
        created_by: actorName,
      })
      .select("*")
      .single();

    if (error) {
      return {
        success: false,
        data: null,
        error: error.message,
      };
    }

    const proposal = data as Proposal;

    try {
      await logActivity({
        companyId,
        entityType: "proposal",
        entityId: proposal.id,
        action: "created",
        description: `Created proposal ${proposalNumber}`,
        actorName,
        metadata: {
          proposalNumber,
          title,
        },
      });
    } catch (activityError) {
      console.error(
        "Proposal created, but activity logging failed:",
        activityError,
      );
    }

    return {
      success: true,
      data: proposal,
      error: "",
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "The proposal could not be created.",
    };
  }
}