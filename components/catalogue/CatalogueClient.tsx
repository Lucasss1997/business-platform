"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import CatalogueItemModal from "@/components/catalogue/CatalogueItemModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

import {
  CATALOGUE_ITEM_TYPES,
  calculateMargin,
  duplicateCatalogueItem,
  getCatalogueItems,
  setCatalogueItemActive,
  setCatalogueItemFavourite,
  type CatalogueItem,
  type CatalogueItemType,
} from "@/lib/catalogue";

type StatusFilter = "all" | "active" | "archived";
type TypeFilter = "all" | CatalogueItemType;
type ConfirmationAction = "archive" | "restore" | "duplicate";

interface PendingConfirmation {
  action: ConfirmationAction;
  item: CatalogueItem;
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(value);
}

function sortCatalogueItems(items: CatalogueItem[]) {
  return [...items].sort((first, second) => {
    if (first.favourite !== second.favourite) {
      return first.favourite ? -1 : 1;
    }

    return first.name.localeCompare(second.name);
  });
}

export default function CatalogueClient() {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] =
    useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("active");
  const [favouritesOnly, setFavouritesOnly] =
    useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] =
    useState<CatalogueItem | null>(null);

  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);

  const [confirmationLoading, setConfirmationLoading] =
    useState(false);

  const [busyItemId, setBusyItemId] =
    useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setPageError("");

    const result = await getCatalogueItems();

    if (!result.success) {
      setItems([]);
      setPageError(result.error);
      setLoading(false);
      return;
    }

    setItems(sortCatalogueItems(result.data));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const normalisedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !normalisedSearch ||
        [
          item.sku,
          item.name,
          item.item_type,
          item.category,
          item.manufacturer,
          item.description,
          item.unit,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalisedSearch);

      const matchesType =
        typeFilter === "all" ||
        item.item_type === typeFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.active) ||
        (statusFilter === "archived" && !item.active);

      const matchesFavourite =
        !favouritesOnly || item.favourite;

      return (
        matchesSearch &&
        matchesType &&
        matchesStatus &&
        matchesFavourite
      );
    });
  }, [
    favouritesOnly,
    items,
    search,
    statusFilter,
    typeFilter,
  ]);

  const metrics = useMemo(() => {
    const activeItems = items.filter((item) => item.active);

    const favouriteItems = activeItems.filter(
      (item) => item.favourite,
    );

    const totalCostValue = activeItems.reduce(
      (total, item) =>
        total + Number(item.cost_price || 0),
      0,
    );

    const totalSellValue = activeItems.reduce(
      (total, item) =>
        total + Number(item.sell_price || 0),
      0,
    );

    return {
      total: items.length,
      active: activeItems.length,
      favourites: favouriteItems.length,
      overallMargin: calculateMargin(
        totalCostValue,
        totalSellValue,
      ).margin,
    };
  }, [items]);

  function replaceItem(updatedItem: CatalogueItem) {
    setItems((currentItems) =>
      sortCatalogueItems(
        currentItems.map((item) =>
          item.id === updatedItem.id ? updatedItem : item,
        ),
      ),
    );
  }

  function addItem(newItem: CatalogueItem) {
    setItems((currentItems) =>
      sortCatalogueItems([newItem, ...currentItems]),
    );
  }

  function openCreateModal() {
    setSelectedItem(null);
    setModalOpen(true);
  }

  function openEditModal(item: CatalogueItem) {
    setSelectedItem(item);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedItem(null);
  }

  function handleSaved(savedItem: CatalogueItem) {
    const itemExists = items.some(
      (item) => item.id === savedItem.id,
    );

    if (itemExists) {
      replaceItem(savedItem);
    } else {
      addItem(savedItem);
    }

    closeModal();
  }

  async function toggleFavourite(item: CatalogueItem) {
    setBusyItemId(item.id);
    setPageError("");

    const result = await setCatalogueItemFavourite(
      item.id,
      !item.favourite,
      { actorName: "Lucas" },
    );

    if (!result.success) {
      setPageError(result.error);
      setBusyItemId(null);
      return;
    }

    replaceItem(result.data);
    setBusyItemId(null);
  }

  function requestConfirmation(
    action: ConfirmationAction,
    item: CatalogueItem,
  ) {
    setPendingConfirmation({ action, item });
  }

  function cancelConfirmation() {
    if (!confirmationLoading) {
      setPendingConfirmation(null);
    }
  }

  async function runConfirmedAction() {
    if (!pendingConfirmation) {
      return;
    }

    setConfirmationLoading(true);
    setPageError("");

    const { action, item } = pendingConfirmation;

    if (action === "duplicate") {
      const result = await duplicateCatalogueItem(
        item.id,
        { actorName: "Lucas" },
      );

      if (!result.success) {
        setPageError(result.error);
        setConfirmationLoading(false);
        setPendingConfirmation(null);
        return;
      }

      addItem(result.data);
      setConfirmationLoading(false);
      setPendingConfirmation(null);
      openEditModal(result.data);
      return;
    }

    const shouldBeActive = action === "restore";

    const result = await setCatalogueItemActive(
      item.id,
      shouldBeActive,
      { actorName: "Lucas" },
    );

    if (!result.success) {
      setPageError(result.error);
      setConfirmationLoading(false);
      setPendingConfirmation(null);
      return;
    }

    replaceItem(result.data);
    setConfirmationLoading(false);
    setPendingConfirmation(null);
  }

  function resetFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("active");
    setFavouritesOnly(false);
  }

  const filtersActive =
    search.trim() !== "" ||
    typeFilter !== "all" ||
    statusFilter !== "active" ||
    favouritesOnly;

  const confirmationContent = getConfirmationContent(
    pendingConfirmation,
  );

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Catalogue items"
            value={String(metrics.total)}
            detail="All active and archived records"
          />

          <MetricCard
            label="Active items"
            value={String(metrics.active)}
            detail="Available for commercial use"
          />

          <MetricCard
            label="Favourites"
            value={String(metrics.favourites)}
            detail="Frequently used items"
          />

          <MetricCard
            label="Average margin"
            value={`${formatPercentage(metrics.overallMargin)}%`}
            detail="Across active catalogue pricing"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 lg:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Catalogue items
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Search and manage the reusable items held in
                  your commercial catalogue.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled
                  title="Catalogue import will be added in Sprint 13.4"
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  Import
                </button>

                <button
                  type="button"
                  disabled
                  title="Catalogue export will be added in Sprint 13.4"
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  Export
                </button>

                <button
                  type="button"
                  onClick={openCreateModal}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
                >
                  + New item
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_190px_170px_auto]">
              <label className="block">
                <span className="sr-only">
                  Search catalogue
                </span>

                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search by SKU, name, manufacturer or category..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
                />
              </label>

              <label className="block">
                <span className="sr-only">
                  Filter by item type
                </span>

                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(
                      event.target.value as TypeFilter,
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
                >
                  <option value="all">
                    All item types
                  </option>

                  {CATALOGUE_ITEM_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="sr-only">
                  Filter by catalogue status
                </span>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as StatusFilter,
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
                >
                  <option value="active">Active items</option>
                  <option value="archived">
                    Archived items
                  </option>
                  <option value="all">All items</option>
                </select>
              </label>

              <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={favouritesOnly}
                  onChange={(event) =>
                    setFavouritesOnly(
                      event.target.checked,
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />

                Favourites
              </label>
            </div>

            {filtersActive && (
              <div className="mt-4 flex items-center justify-between gap-4">
                <p className="text-sm text-slate-500">
                  Showing {filteredItems.length} of{" "}
                  {items.length} items
                </p>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {pageError && (
            <div className="border-b border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700 lg:px-6">
              {pageError}
            </div>
          )}

          {loading ? (
            <LoadingState />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              hasItems={items.length > 0}
              onReset={resetFilters}
              onCreate={openCreateModal}
            />
          ) : (
            <CatalogueTable
              items={filteredItems}
              busyItemId={busyItemId}
              onEdit={openEditModal}
              onFavourite={toggleFavourite}
              onDuplicate={(item) =>
                requestConfirmation("duplicate", item)
              }
              onArchive={(item) =>
                requestConfirmation(
                  item.active ? "archive" : "restore",
                  item,
                )
              }
            />
          )}
        </div>
      </div>

      <CatalogueItemModal
        open={modalOpen}
        item={selectedItem}
        actorName="Lucas"
        onClose={closeModal}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={pendingConfirmation !== null}
        title={confirmationContent.title}
        description={confirmationContent.description}
        confirmLabel={confirmationContent.confirmLabel}
        destructive={
          pendingConfirmation?.action === "archive"
        }
        loading={confirmationLoading}
        onConfirm={() => void runConfirmedAction()}
        onCancel={cancelConfirmation}
      />
    </>
  );
}

function CatalogueTable({
  items,
  busyItemId,
  onEdit,
  onFavourite,
  onDuplicate,
  onArchive,
}: {
  items: CatalogueItem[];
  busyItemId: string | null;
  onEdit: (item: CatalogueItem) => void;
  onFavourite: (item: CatalogueItem) => void;
  onDuplicate: (item: CatalogueItem) => void;
  onArchive: (item: CatalogueItem) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <TableHeading>Item</TableHeading>
            <TableHeading>Type</TableHeading>
            <TableHeading>Category</TableHeading>
            <TableHeading align="right">Cost</TableHeading>
            <TableHeading align="right">Sell</TableHeading>
            <TableHeading align="right">Margin</TableHeading>
            <TableHeading>Status</TableHeading>
            <TableHeading align="right">
              Actions
            </TableHeading>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100 bg-white">
          {items.map((item) => {
            const pricing = calculateMargin(
              Number(item.cost_price || 0),
              Number(item.sell_price || 0),
            );

            const itemBusy = busyItemId === item.id;

            return (
              <tr
                key={item.id}
                className="transition hover:bg-slate-50"
              >
                <td className="min-w-72 px-5 py-4 lg:px-6">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      disabled={itemBusy}
                      onClick={() => void onFavourite(item)}
                      aria-label={
                        item.favourite
                          ? `Remove ${item.name} from favourites`
                          : `Add ${item.name} to favourites`
                      }
                      title={
                        item.favourite
                          ? "Remove from favourites"
                          : "Add to favourites"
                      }
                      className={`mt-0.5 text-xl leading-none transition disabled:cursor-wait disabled:opacity-50 ${
                        item.favourite
                          ? "text-amber-500 hover:text-amber-600"
                          : "text-slate-300 hover:text-amber-500"
                      }`}
                    >
                      {item.favourite ? "★" : "☆"}
                    </button>

                    <div>
                      <p className="font-semibold text-slate-900">
                        {item.name}
                      </p>

                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>
                          SKU: {item.sku || "Not assigned"}
                        </span>

                        {item.manufacturer && (
                          <span>{item.manufacturer}</span>
                        )}

                        <span>{item.unit}</span>
                      </div>

                      {item.description && (
                        <p className="mt-2 max-w-xl text-sm text-slate-500">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                <td className="whitespace-nowrap px-5 py-4 lg:px-6">
                  <TypeBadge type={item.item_type} />
                </td>

                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600 lg:px-6">
                  {item.category}
                </td>

                <td className="whitespace-nowrap px-5 py-4 text-right text-sm text-slate-600 lg:px-6">
                  {formatMoney(item.cost_price)}
                </td>

                <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-slate-900 lg:px-6">
                  {formatMoney(item.sell_price)}
                </td>

                <td className="whitespace-nowrap px-5 py-4 text-right lg:px-6">
                  <span
                    className={
                      pricing.margin < 10
                        ? "font-semibold text-red-600"
                        : pricing.margin < 25
                          ? "font-semibold text-amber-600"
                          : "font-semibold text-emerald-700"
                    }
                  >
                    {formatPercentage(pricing.margin)}%
                  </span>

                  <p className="mt-1 text-xs text-slate-400">
                    {formatMoney(pricing.profit)} profit
                  </p>
                </td>

                <td className="whitespace-nowrap px-5 py-4 lg:px-6">
                  <StatusBadge active={item.active} />
                </td>

                <td className="whitespace-nowrap px-5 py-4 text-right lg:px-6">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => onDuplicate(item)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      Duplicate
                    </button>

                    <button
                      type="button"
                      onClick={() => onArchive(item)}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        item.active
                          ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                          : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      {item.active ? "Archive" : "Restore"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getConfirmationContent(
  confirmation: PendingConfirmation | null,
) {
  if (!confirmation) {
    return {
      title: "",
      description: "",
      confirmLabel: "Confirm",
    };
  }

  const { action, item } = confirmation;

  if (action === "duplicate") {
    return {
      title: "Duplicate catalogue item?",
      description: `A new copy of "${item.name}" will be created without an SKU. The copied item will open automatically so you can review and rename it.`,
      confirmLabel: "Duplicate item",
    };
  }

  if (action === "restore") {
    return {
      title: "Restore catalogue item?",
      description: `"${item.name}" will become available for selection on new proposals and transactions.`,
      confirmLabel: "Restore item",
    };
  }

  return {
    title: "Archive catalogue item?",
    description: `"${item.name}" will be hidden from active catalogue searches. Existing proposals and historic records will not be affected.`,
    confirmLabel: "Archive item",
  };
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function TableHeading({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 lg:px-6 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function TypeBadge({
  type,
}: {
  type: CatalogueItemType;
}) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
      {TYPE_LABELS[type]}
    </span>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "Active" : "Archived"}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />

      <p className="mt-4 text-sm font-medium text-slate-600">
        Loading catalogue…
      </p>
    </div>
  );
}

function EmptyState({
  hasItems,
  onReset,
  onCreate,
}: {
  hasItems: boolean;
  onReset: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">
        ◫
      </div>

      <h3 className="mt-4 text-base font-bold text-slate-900">
        {hasItems
          ? "No catalogue items match these filters"
          : "Your catalogue is empty"}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {hasItems
          ? "Clear or adjust the current filters to display more catalogue items."
          : "Add your first product, service, labour charge, subscription or other reusable item."}
      </p>

      <div className="mt-5 flex justify-center gap-3">
        {hasItems ? (
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Clear filters
          </button>
        ) : (
          <button
            type="button"
            onClick={onCreate}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            + New item
          </button>
        )}
      </div>
    </div>
  );
}