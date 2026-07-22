import { logActivity } from "@/lib/activity";
import { supabase } from "@/lib/supabase";

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
  active?: boolean;
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

interface CatalogueActivityOptions {
  actorName?: string;
}

function cleanOptionalText(value: string | undefined) {
  const cleaned = value?.trim();

  return cleaned ? cleaned : null;
}

function validatePrice(value: number, label: string) {
  if (!Number.isFinite(value)) {
    return `${label} must be a valid number.`;
  }

  if (value < 0) {
    return `${label} cannot be negative.`;
  }

  return "";
}

function validateCatalogueInput(
  input: CreateCatalogueItemInput | UpdateCatalogueItemInput,
) {
  if ("name" in input && input.name !== undefined) {
    if (!input.name.trim()) {
      return "Name is required.";
    }
  }

  if (input.cost_price !== undefined) {
    const error = validatePrice(input.cost_price, "Cost price");

    if (error) {
      return error;
    }
  }

  if (input.sell_price !== undefined) {
    const error = validatePrice(input.sell_price, "Sell price");

    if (error) {
      return error;
    }
  }

  if (input.vat_rate !== undefined) {
    if (!Number.isFinite(input.vat_rate)) {
      return "VAT rate must be a valid number.";
    }

    if (input.vat_rate < 0 || input.vat_rate > 100) {
      return "VAT rate must be between 0 and 100.";
    }
  }

  return "";
}

function getCatalogueErrorMessage(message: string) {
  const normalisedMessage = message.toLowerCase();

  if (
    normalisedMessage.includes("duplicate key") ||
    normalisedMessage.includes("catalogue_items_sku_key")
  ) {
    return "An item with this SKU already exists.";
  }

  if (normalisedMessage.includes("row-level security")) {
    return "Catalogue access was blocked by the database security policy.";
  }

  return message;
}

export function calculateMargin(cost: number, sell: number) {
  const safeCost = Number(cost || 0);
  const safeSell = Number(sell || 0);
  const profit = safeSell - safeCost;

  const margin =
    safeSell === 0
      ? 0
      : Number(((profit / safeSell) * 100).toFixed(2));

  const markup =
    safeCost === 0
      ? 0
      : Number(((profit / safeCost) * 100).toFixed(2));

  return {
    profit: Number(profit.toFixed(2)),
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
    .order("favourite", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    return {
      success: false,
      data: null,
      error: getCatalogueErrorMessage(error.message),
    };
  }

  return {
    success: true,
    data: (data ?? []) as CatalogueItem[],
    error: "",
  };
}

export async function getCatalogueItem(
  catalogueItemId: string,
): Promise<ServiceResult<CatalogueItem>> {
  if (!catalogueItemId.trim()) {
    return {
      success: false,
      data: null,
      error: "Catalogue item ID is required.",
    };
  }

  const { data, error } = await supabase
    .from("catalogue_items")
    .select("*")
    .eq("id", catalogueItemId)
    .single();

  if (error) {
    return {
      success: false,
      data: null,
      error: getCatalogueErrorMessage(error.message),
    };
  }

  return {
    success: true,
    data: data as CatalogueItem,
    error: "",
  };
}

export async function createCatalogueItem(
  input: CreateCatalogueItemInput,
  options: CatalogueActivityOptions = {},
): Promise<ServiceResult<CatalogueItem>> {
  const validationError = validateCatalogueInput(input);

  if (validationError) {
    return {
      success: false,
      data: null,
      error: validationError,
    };
  }

  const name = input.name.trim();

  const { data, error } = await supabase
    .from("catalogue_items")
    .insert({
      sku: cleanOptionalText(input.sku),
      name,
      item_type: input.item_type ?? "product",
      category: input.category?.trim() || "General",
      manufacturer: cleanOptionalText(input.manufacturer),
      description: cleanOptionalText(input.description),
      unit: input.unit?.trim() || "Each",
      cost_price: input.cost_price ?? 0,
      sell_price: input.sell_price ?? 0,
      vat_rate: input.vat_rate ?? 20,
      favourite: input.favourite ?? false,
      active: input.active ?? true,
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      data: null,
      error: getCatalogueErrorMessage(error.message),
    };
  }

  const catalogueItem = data as CatalogueItem;

  await logActivity({
    entityType: "catalogue_item",
    entityId: catalogueItem.id,
    action: "created",
    description: `Created catalogue item "${catalogueItem.name}"`,
    actorName: options.actorName ?? "System",
  });

  return {
    success: true,
    data: catalogueItem,
    error: "",
  };
}

export async function updateCatalogueItem(
  catalogueItemId: string,
  input: UpdateCatalogueItemInput,
  options: CatalogueActivityOptions = {},
): Promise<ServiceResult<CatalogueItem>> {
  if (!catalogueItemId.trim()) {
    return {
      success: false,
      data: null,
      error: "Catalogue item ID is required.",
    };
  }

  const validationError = validateCatalogueInput(input);

  if (validationError) {
    return {
      success: false,
      data: null,
      error: validationError,
    };
  }

  const updatePayload: Record<string, unknown> = {};

  if (input.sku !== undefined) {
    updatePayload.sku = cleanOptionalText(input.sku);
  }

  if (input.name !== undefined) {
    updatePayload.name = input.name.trim();
  }

  if (input.item_type !== undefined) {
    updatePayload.item_type = input.item_type;
  }

  if (input.category !== undefined) {
    updatePayload.category = input.category.trim() || "General";
  }

  if (input.manufacturer !== undefined) {
    updatePayload.manufacturer = cleanOptionalText(
      input.manufacturer,
    );
  }

  if (input.description !== undefined) {
    updatePayload.description = cleanOptionalText(
      input.description,
    );
  }

  if (input.unit !== undefined) {
    updatePayload.unit = input.unit.trim() || "Each";
  }

  if (input.cost_price !== undefined) {
    updatePayload.cost_price = input.cost_price;
  }

  if (input.sell_price !== undefined) {
    updatePayload.sell_price = input.sell_price;
  }

  if (input.vat_rate !== undefined) {
    updatePayload.vat_rate = input.vat_rate;
  }

  if (input.favourite !== undefined) {
    updatePayload.favourite = input.favourite;
  }

  if (input.active !== undefined) {
    updatePayload.active = input.active;
  }

  if (Object.keys(updatePayload).length === 0) {
    return {
      success: false,
      data: null,
      error: "No catalogue changes were supplied.",
    };
  }

  const { data, error } = await supabase
    .from("catalogue_items")
    .update(updatePayload)
    .eq("id", catalogueItemId)
    .select()
    .single();

  if (error) {
    return {
      success: false,
      data: null,
      error: getCatalogueErrorMessage(error.message),
    };
  }

  const catalogueItem = data as CatalogueItem;

  await logActivity({
    entityType: "catalogue_item",
    entityId: catalogueItem.id,
    action: "updated",
    description: `Updated catalogue item "${catalogueItem.name}"`,
    actorName: options.actorName ?? "System",
  });

  return {
    success: true,
    data: catalogueItem,
    error: "",
  };
}

export async function setCatalogueItemFavourite(
  catalogueItemId: string,
  favourite: boolean,
  options: CatalogueActivityOptions = {},
): Promise<ServiceResult<CatalogueItem>> {
  return updateCatalogueItem(
    catalogueItemId,
    { favourite },
    options,
  );
}

export async function setCatalogueItemActive(
  catalogueItemId: string,
  active: boolean,
  options: CatalogueActivityOptions = {},
): Promise<ServiceResult<CatalogueItem>> {
  if (!catalogueItemId.trim()) {
    return {
      success: false,
      data: null,
      error: "Catalogue item ID is required.",
    };
  }

  const { data, error } = await supabase
    .from("catalogue_items")
    .update({ active })
    .eq("id", catalogueItemId)
    .select()
    .single();

  if (error) {
    return {
      success: false,
      data: null,
      error: getCatalogueErrorMessage(error.message),
    };
  }

  const catalogueItem = data as CatalogueItem;

  await logActivity({
    entityType: "catalogue_item",
    entityId: catalogueItem.id,
    action: "updated",
    description: active
      ? `Restored catalogue item "${catalogueItem.name}"`
      : `Archived catalogue item "${catalogueItem.name}"`,
    actorName: options.actorName ?? "System",
  });

  return {
    success: true,
    data: catalogueItem,
    error: "",
  };
}

export async function duplicateCatalogueItem(
  catalogueItemId: string,
  options: CatalogueActivityOptions = {},
): Promise<ServiceResult<CatalogueItem>> {
  const sourceResult = await getCatalogueItem(catalogueItemId);

  if (!sourceResult.success) {
    return sourceResult;
  }

  const source = sourceResult.data;

  const duplicateResult = await createCatalogueItem(
    {
      sku: "",
      name: `${source.name} (Copy)`,
      item_type: source.item_type,
      category: source.category,
      manufacturer: source.manufacturer ?? "",
      description: source.description ?? "",
      unit: source.unit,
      cost_price: Number(source.cost_price),
      sell_price: Number(source.sell_price),
      vat_rate: Number(source.vat_rate),
      favourite: false,
      active: true,
    },
    options,
  );

  if (!duplicateResult.success) {
    return duplicateResult;
  }

  await logActivity({
    entityType: "catalogue_item",
    entityId: duplicateResult.data.id,
    action: "created",
    description: `Duplicated catalogue item "${source.name}" as "${duplicateResult.data.name}"`,
    actorName: options.actorName ?? "System",
  });

  return duplicateResult;
}