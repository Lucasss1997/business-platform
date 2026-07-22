import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity";

export const CATALOGUE_ITEM_TYPES = [
  "product",
  "service",
  "software",
  "labour",
  "rental",
  "subscription",
  "consumable",
  "contract",
  "miscellaneous",
] as const;

export type CatalogueItemType =
  (typeof CATALOGUE_ITEM_TYPES)[number];

export interface CatalogueItem {
  id: string;

  sku: string | null;

  name: string;

  item_type: CatalogueItemType;

  category: string;

  manufacturer: string | null;

  description: string | null;

  unit: string;

  cost_price: number;

  sell_price: number;

  vat_rate: number;

  favourite: boolean;

  active: boolean;

  created_at: string;

  updated_at: string;
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

export interface CreateCatalogueItemInput {
  sku?: string;

  name: string;

  item_type?: CatalogueItemType;

  category?: string;

  manufacturer?: string;

  description?: string;

  unit?: string;

  cost_price?: number;

  sell_price?: number;

  vat_rate?: number;

  favourite?: boolean;
}

export interface UpdateCatalogueItemInput {
  sku?: string;

  name?: string;

  item_type?: CatalogueItemType;

  category?: string;

  manufacturer?: string;

  description?: string;

  unit?: string;

  cost_price?: number;

  sell_price?: number;

  vat_rate?: number;

  favourite?: boolean;

  active?: boolean;
}

export function calculateMargin(
  cost: number,
  sell: number,
) {
  const profit = sell - cost;

  const margin =
    sell === 0
      ? 0
      : Number(((profit / sell) * 100).toFixed(2));

  const markup =
    cost === 0
      ? 0
      : Number(((profit / cost) * 100).toFixed(2));

  return {
    profit,
    margin,
    markup,
  };
}

export async function getCatalogueItems(): Promise<
  ServiceResult<CatalogueItem[]>
> {
  const { data, error } = await supabase
    .from("catalogue_items")
    .select("*")
    .order("name");

  if (error) {
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }

  return {
    success: true,
    data: data as CatalogueItem[],
    error: "",
  };
}

export async function createCatalogueItem(
  input: CreateCatalogueItemInput,
): Promise<ServiceResult<CatalogueItem>> {
  const name = input.name.trim();

  if (!name) {
    return {
      success: false,
      data: null,
      error: "Name is required.",
    };
  }

  const { data, error } = await supabase
    .from("catalogue_items")
    .insert({
      sku: input.sku?.trim() || null,

      name,

      item_type:
        input.item_type || "product",

      category:
        input.category?.trim() ||
        "General",

      manufacturer:
        input.manufacturer?.trim() ||
        null,

      description:
        input.description?.trim() ||
        null,

      unit:
        input.unit?.trim() ||
        "Each",

      cost_price:
        input.cost_price ?? 0,

      sell_price:
        input.sell_price ?? 0,

      vat_rate:
        input.vat_rate ?? 20,

      favourite:
        input.favourite ?? false,
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      data: null,
      error: error.message,
    };
  }

  await logActivity({
    entityType: "document",
    action: "created",
    description: `Created catalogue item "${name}"`,
    actorName: "System",
  });

  return {
    success: true,
    data: data as CatalogueItem,
    error: "",
  };
}