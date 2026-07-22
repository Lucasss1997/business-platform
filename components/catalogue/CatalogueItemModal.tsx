"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  CATALOGUE_ITEM_TYPES,
  calculateMargin,
  createCatalogueItem,
  updateCatalogueItem,
  type CatalogueItem,
  type CatalogueItemType,
} from "@/lib/catalogue";

interface CatalogueItemModalProps {
  open: boolean;
  item: CatalogueItem | null;
  actorName?: string;
  onClose: () => void;
  onSaved: (item: CatalogueItem) => void;
}

interface CatalogueFormState {
  sku: string;
  name: string;
  itemType: CatalogueItemType;
  category: string;
  manufacturer: string;
  description: string;
  unit: string;
  costPrice: string;
  sellPrice: string;
  vatRate: string;
  favourite: boolean;
  active: boolean;
}

const TYPE_LABELS: Record<CatalogueItemType, string> = {
  product: "Product",
  service: "Service",
  software: "Software",
  labour: "Labour",
  rental: "Rental",
  subscription: "Subscription",
  consumable: "Consumable",
  contract: "Contract",
  miscellaneous: "Miscellaneous",
};

const UNIT_OPTIONS = [
  "Each",
  "Hour",
  "Day",
  "Week",
  "Month",
  "Year",
  "Licence",
  "User",
  "Site",
  "Pack",
  "Box",
  "Metre",
  "Kilogram",
];

function createInitialState(
  item: CatalogueItem | null,
): CatalogueFormState {
  if (item) {
    return {
      sku: item.sku ?? "",
      name: item.name,
      itemType: item.item_type,
      category: item.category,
      manufacturer: item.manufacturer ?? "",
      description: item.description ?? "",
      unit: item.unit,
      costPrice: String(item.cost_price),
      sellPrice: String(item.sell_price),
      vatRate: String(item.vat_rate),
      favourite: item.favourite,
      active: item.active,
    };
  }

  return {
    sku: "",
    name: "",
    itemType: "product",
    category: "General",
    manufacturer: "",
    description: "",
    unit: "Each",
    costPrice: "0.00",
    sellPrice: "0.00",
    vatRate: "20",
    favourite: false,
    active: true,
  };
}

function parseNumber(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

export default function CatalogueItemModal({
  open,
  item,
  actorName = "Lucas",
  onClose,
  onSaved,
}: CatalogueItemModalProps) {
  const [form, setForm] = useState<CatalogueFormState>(
    createInitialState(item),
  );

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(createInitialState(item));
    setSaving(false);
    setFormError("");
  }, [item, open]);

  const pricing = useMemo(
    () =>
      calculateMargin(
        parseNumber(form.costPrice),
        parseNumber(form.sellPrice),
      ),
    [form.costPrice, form.sellPrice],
  );

  if (!open) {
    return null;
  }

  function updateField<Key extends keyof CatalogueFormState>(
    key: Key,
    value: CatalogueFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleClose() {
    if (!saving) {
      onClose();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setFormError("");

    const input = {
      sku: form.sku,
      name: form.name,
      item_type: form.itemType,
      category: form.category,
      manufacturer: form.manufacturer,
      description: form.description,
      unit: form.unit,
      cost_price: parseNumber(form.costPrice),
      sell_price: parseNumber(form.sellPrice),
      vat_rate: parseNumber(form.vatRate),
      favourite: form.favourite,
      active: form.active,
    };

    const result = item
      ? await updateCatalogueItem(item.id, input, {
          actorName,
        })
      : await createCatalogueItem(input, {
          actorName,
        });

    if (!result.success) {
      setFormError(result.error);
      setSaving(false);
      return;
    }

    onSaved(result.data);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalogue-modal-title"
        className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <form
          onSubmit={handleSubmit}
          className="flex max-h-[92vh] flex-col"
        >
          <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Catalogue
              </p>

              <h2
                id="catalogue-modal-title"
                className="mt-1 text-xl font-bold text-slate-900"
              >
                {item ? "Edit catalogue item" : "New catalogue item"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Store reusable product, service and pricing
                information.
              </p>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              aria-label="Close"
              className="rounded-lg px-3 py-2 text-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed"
            >
              ×
            </button>
          </header>

          <div className="overflow-y-auto px-6 py-6">
            {formError && (
              <div
                role="alert"
                className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {formError}
              </div>
            )}

            <div className="space-y-8">
              <section>
                <SectionHeading
                  title="General information"
                  description="The name and classification used throughout the platform."
                />

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Name" required>
                    <input
                      required
                      autoFocus
                      value={form.name}
                      onChange={(event) =>
                        updateField("name", event.target.value)
                      }
                      className={inputClasses}
                      placeholder="e.g. Ricoh IM C3000"
                    />
                  </Field>

                  <Field label="SKU or item code">
                    <input
                      value={form.sku}
                      onChange={(event) =>
                        updateField("sku", event.target.value)
                      }
                      className={inputClasses}
                      placeholder="e.g. RIC-IMC3000"
                    />
                  </Field>

                  <Field label="Item type" required>
                    <select
                      required
                      value={form.itemType}
                      onChange={(event) =>
                        updateField(
                          "itemType",
                          event.target.value as CatalogueItemType,
                        )
                      }
                      className={inputClasses}
                    >
                      {CATALOGUE_ITEM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Category">
                    <input
                      value={form.category}
                      onChange={(event) =>
                        updateField("category", event.target.value)
                      }
                      className={inputClasses}
                      placeholder="e.g. Multifunction Printers"
                    />
                  </Field>

                  <Field label="Manufacturer">
                    <input
                      value={form.manufacturer}
                      onChange={(event) =>
                        updateField(
                          "manufacturer",
                          event.target.value,
                        )
                      }
                      className={inputClasses}
                      placeholder="e.g. Ricoh"
                    />
                  </Field>

                  <Field label="Unit">
                    <input
                      value={form.unit}
                      onChange={(event) =>
                        updateField("unit", event.target.value)
                      }
                      list="catalogue-unit-options"
                      className={inputClasses}
                      placeholder="Each"
                    />

                    <datalist id="catalogue-unit-options">
                      {UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit} />
                      ))}
                    </datalist>
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Description">
                      <textarea
                        value={form.description}
                        onChange={(event) =>
                          updateField(
                            "description",
                            event.target.value,
                          )
                        }
                        rows={4}
                        className={inputClasses}
                        placeholder="Description used on proposals, orders and invoices..."
                      />
                    </Field>
                  </div>
                </div>
              </section>

              <section>
                <SectionHeading
                  title="Pricing"
                  description="Base catalogue pricing before proposal-specific quantities or discounts."
                />

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Field label="Cost price">
                    <MoneyInput
                      value={form.costPrice}
                      onChange={(value) =>
                        updateField("costPrice", value)
                      }
                    />
                  </Field>

                  <Field label="Sell price">
                    <MoneyInput
                      value={form.sellPrice}
                      onChange={(value) =>
                        updateField("sellPrice", value)
                      }
                    />
                  </Field>

                  <Field label="VAT rate">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={form.vatRate}
                        onChange={(event) =>
                          updateField(
                            "vatRate",
                            event.target.value,
                          )
                        }
                        className={`${inputClasses} pr-10`}
                      />

                      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-500">
                        %
                      </span>
                    </div>
                  </Field>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <PricingMetric
                    label="Gross profit"
                    value={formatMoney(pricing.profit)}
                  />

                  <PricingMetric
                    label="Margin"
                    value={`${pricing.margin.toFixed(2)}%`}
                  />

                  <PricingMetric
                    label="Markup"
                    value={`${pricing.markup.toFixed(2)}%`}
                  />
                </div>

                {pricing.profit < 0 && (
                  <p className="mt-3 text-sm font-semibold text-red-600">
                    The sell price is below the cost price.
                  </p>
                )}
              </section>

              <section>
                <SectionHeading
                  title="Availability"
                  description="Control whether this item is prioritised or available for future transactions."
                />

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <ToggleCard
                    label="Favourite item"
                    description="Show this item prominently in catalogue searches."
                    checked={form.favourite}
                    onChange={(checked) =>
                      updateField("favourite", checked)
                    }
                  />

                  <ToggleCard
                    label="Active item"
                    description="Allow this item to be selected on new proposals and transactions."
                    checked={form.active}
                    onChange={(checked) =>
                      updateField("active", checked)
                    }
                  />
                </div>
              </section>
            </div>
          </div>

          <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving
                ? "Saving…"
                : item
                  ? "Save changes"
                  : "Create item"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

const inputClasses =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-4 focus:ring-slate-100";

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500" aria-hidden>
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-base font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm text-slate-500">
        £
      </span>

      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClasses} pl-8`}
      />
    </div>
  );
}

function PricingMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

function ToggleCard({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 transition hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-slate-300"
      />

      <span>
        <span className="block text-sm font-bold text-slate-900">
          {label}
        </span>

        <span className="mt-1 block text-xs leading-5 text-slate-500">
          {description}
        </span>
      </span>
    </label>
  );
}