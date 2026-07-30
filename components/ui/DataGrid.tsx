"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

export type SortDirection = "asc" | "desc";

export type DataGridColumn<T> = {
  key: string;
  header: string;
  accessor?: keyof T;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => unknown;
};

export type DataGridProps<T> = {
  data: T[];
  columns: DataGridColumn<T>[];
  getRowId: (row: T) => string;
  pageSize?: number;
  pageSizeOptions?: number[];
  initialSortKey?: string;
  initialSortDirection?: SortDirection;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  className?: string;
  embedded?: boolean;
};

function compareValues(
  firstValue: unknown,
  secondValue: unknown,
  direction: SortDirection,
): number {
  const multiplier = direction === "asc" ? 1 : -1;

  const firstIsEmpty =
    firstValue === null ||
    firstValue === undefined ||
    firstValue === "";

  const secondIsEmpty =
    secondValue === null ||
    secondValue === undefined ||
    secondValue === "";

  if (firstIsEmpty && secondIsEmpty) {
    return 0;
  }

  if (firstIsEmpty) {
    return 1;
  }

  if (secondIsEmpty) {
    return -1;
  }

  if (firstValue instanceof Date && secondValue instanceof Date) {
    return (
      (firstValue.getTime() - secondValue.getTime()) * multiplier
    );
  }

  if (
    typeof firstValue === "number" &&
    typeof secondValue === "number"
  ) {
    return (firstValue - secondValue) * multiplier;
  }

  return (
    String(firstValue).localeCompare(String(secondValue), undefined, {
      numeric: true,
      sensitivity: "base",
    }) * multiplier
  );
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "a, button, input, select, textarea, summary, [role='button']",
    ),
  );
}

export default function DataGrid<T>({
  data,
  columns,
  getRowId,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  initialSortKey,
  initialSortDirection = "asc",
  onRowClick,
  emptyState,
  className = "",
  embedded = false,
}: DataGridProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(
    initialSortKey,
  );

  const [sortDirection, setSortDirection] =
    useState<SortDirection>(initialSortDirection);

  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  const sortedData = useMemo(() => {
    if (!sortKey) {
      return data;
    }

    const activeColumn = columns.find(
      (column) => column.key === sortKey,
    );

    if (!activeColumn) {
      return data;
    }

    return [...data].sort((firstRow, secondRow) => {
      const firstValue = activeColumn.sortValue
        ? activeColumn.sortValue(firstRow)
        : activeColumn.accessor
          ? firstRow[activeColumn.accessor]
          : null;

      const secondValue = activeColumn.sortValue
        ? activeColumn.sortValue(secondRow)
        : activeColumn.accessor
          ? secondRow[activeColumn.accessor]
          : null;

      return compareValues(
        firstValue,
        secondValue,
        sortDirection,
      );
    });
  }, [columns, data, sortDirection, sortKey]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedData.length / pageSize),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [data, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;

    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [currentPage, pageSize, sortedData]);

  function handleSort(column: DataGridColumn<T>) {
    if (!column.sortable) {
      return;
    }

    if (sortKey === column.key) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );

      return;
    }

    setSortKey(column.key);
    setSortDirection("asc");
  }

  function handleRowClick(
    event: MouseEvent<HTMLTableRowElement>,
    row: T,
  ) {
    if (!onRowClick || isInteractiveTarget(event.target)) {
      return;
    }

    onRowClick(row);
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    row: T,
  ) {
    if (!onRowClick || isInteractiveTarget(event.target)) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  }

  const firstVisibleRecord =
    sortedData.length === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const lastVisibleRecord = Math.min(
    currentPage * pageSize,
    sortedData.length,
  );

  const wrapperClasses = embedded
    ? className
    : [
        "overflow-hidden rounded-2xl border border-[var(--border)]",
        "bg-white shadow-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ");

  if (data.length === 0) {
    return (
      <div className={wrapperClasses}>
        {emptyState ?? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-bold text-slate-900">
              No records found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              There are no records available to display.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={wrapperClasses}>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => {
                const isActiveSort = sortKey === column.key;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={[
                      "whitespace-nowrap px-5 py-3 font-semibold",
                      column.headerClassName ?? "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column)}
                        className="inline-flex items-center gap-1.5 transition hover:text-slate-900"
                      >
                        <span>{column.header}</span>

                        <span
                          aria-hidden="true"
                          className={[
                            "text-[10px]",
                            isActiveSort
                              ? "text-slate-700"
                              : "text-slate-300",
                          ].join(" ")}
                        >
                          {isActiveSort
                            ? sortDirection === "asc"
                              ? "▲"
                              : "▼"
                            : "↕"}
                        </span>

                        <span className="sr-only">
                          {isActiveSort
                            ? `Sorted ${
                                sortDirection === "asc"
                                  ? "ascending"
                                  : "descending"
                              }`
                            : "Not sorted"}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border)]">
            {paginatedData.map((row) => (
              <tr
                key={getRowId(row)}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={(event) => handleRowClick(event, row)}
                onKeyDown={(event) =>
                  handleRowKeyDown(event, row)
                }
                className={[
                  "transition hover:bg-slate-50",
                  onRowClick
                    ? "cursor-pointer focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {columns.map((column) => {
                  const cellValue = column.accessor
                    ? row[column.accessor]
                    : null;

                  return (
                    <td
                      key={column.key}
                      className={[
                        "px-5 py-4 text-slate-700",
                        column.className ?? "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {column.render
                        ? column.render(row)
                        : cellValue === null ||
                            cellValue === undefined ||
                            cellValue === ""
                          ? "—"
                          : String(cellValue)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <label htmlFor="data-grid-page-size">
            Rows per page
          </label>

          <select
            id="data-grid-page-size"
            value={pageSize}
            onChange={(event) =>
              setPageSize(Number(event.target.value))
            }
            className="rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-sm text-slate-700 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            Showing {firstVisibleRecord}–{lastVisibleRecord} of{" "}
            {sortedData.length}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="min-w-20 text-center text-sm text-slate-500">
              {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1),
                )
              }
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}