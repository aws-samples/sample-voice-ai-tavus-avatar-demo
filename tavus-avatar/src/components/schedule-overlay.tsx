"use client";

import { useMemo } from "react";

import { parseMarkdownTable } from "@/lib/markdown-table";

export type ScheduleOverlayColumn = {
  markdownTable: string;
  title?: string;
};

type ScheduleOverlayProps = {
  columns: ScheduleOverlayColumn[];
  title?: string;
};

function normalizeHeader(header: string) {
  return header.trim().toLowerCase();
}

function getColumnWeight(header: string) {
  const normalizedHeader = normalizeHeader(header);

  if (normalizedHeader.includes("demo") || normalizedHeader.includes("session")) {
    return 2.8;
  }

  if (
    normalizedHeader.includes("why") ||
    normalizedHeader.includes("relevant") ||
    normalizedHeader.includes("description")
  ) {
    return 2.3;
  }

  if (normalizedHeader.includes("time") || normalizedHeader.includes("when")) {
    return 1.15;
  }

  if (
    normalizedHeader.includes("kiosk") ||
    normalizedHeader.includes("booth") ||
    normalizedHeader.includes("area") ||
    normalizedHeader.includes("location")
  ) {
    return 0.85;
  }

  return 1;
}

function getColumnWidths(headers: string[]) {
  const weights = headers.map(getColumnWeight);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  return weights.map((weight) => `${(weight / totalWeight) * 100}%`);
}

function getDensity(markdownTable: string, totalColumnCount: number, rowCount: number) {
  const longestLineLength = markdownTable
    .split(/\r?\n/)
    .reduce((maxLength, line) => Math.max(maxLength, line.trim().length), 0);

  if (totalColumnCount >= 3 || rowCount >= 10 || longestLineLength >= 110) {
    return "tight";
  }

  if (totalColumnCount >= 2 || rowCount >= 7 || longestLineLength >= 85) {
    return "compact";
  }

  return "regular";
}

function getGridClassName(columnCount: number) {
  if (columnCount >= 3) {
    return "grid min-h-0 gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
  }

  if (columnCount === 2) {
    return "grid min-h-0 gap-3 grid-cols-1 lg:grid-cols-2";
  }

  return "grid min-h-0 gap-3 grid-cols-1";
}

type ScheduleColumnCardProps = {
  column: ScheduleOverlayColumn;
  totalColumnCount: number;
};

function ScheduleColumnCard({ column, totalColumnCount }: ScheduleColumnCardProps) {
  const table = useMemo(() => parseMarkdownTable(column.markdownTable), [column.markdownTable]);
  const rowCount = table?.rows.length ?? 0;
  const density = getDensity(column.markdownTable, totalColumnCount, rowCount);
  const columnWidths = useMemo(() => (table ? getColumnWidths(table.headers) : []), [table]);

  const cardClassName =
    density === "tight"
      ? "grid min-h-0 grid-rows-[auto,1fr] gap-2 rounded-[1.45rem] border border-white/10 bg-white/[0.045] p-3"
      : density === "compact"
        ? "grid min-h-0 grid-rows-[auto,1fr] gap-2.5 rounded-[1.55rem] border border-white/10 bg-white/[0.045] p-3.5"
        : "grid min-h-0 grid-rows-[auto,1fr] gap-3 rounded-[1.65rem] border border-white/10 bg-white/[0.045] p-4";

  const columnTitleClassName =
    density === "tight"
      ? "text-[0.85rem] font-semibold tracking-tight text-white"
      : density === "compact"
        ? "text-[0.95rem] font-semibold tracking-tight text-white"
        : "text-[1.05rem] font-semibold tracking-tight text-white";

  const headerCellClassName =
    density === "tight"
      ? "border-b border-white/10 px-2.5 py-1.5 text-left text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-sky-100/80"
      : density === "compact"
        ? "border-b border-white/10 px-3 py-2 text-left text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-sky-100/80"
        : "border-b border-white/10 px-3 py-2.5 text-left text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-sky-100/80";

  const bodyCellClassName =
    density === "tight"
      ? "border-b border-white/8 px-2.5 py-1.5 align-top text-[0.66rem] leading-[1.2] text-slate-100"
      : density === "compact"
        ? "border-b border-white/8 px-3 py-2 align-top text-[0.74rem] leading-[1.28] text-slate-100"
        : "border-b border-white/8 px-3 py-2.5 align-top text-[0.84rem] leading-[1.38] text-slate-100";

  return (
    <section className={cardClassName}>
      {column.title?.trim() ? (
        <header className="space-y-1">
          <p className="text-[0.58rem] font-medium uppercase tracking-[0.24em] text-sky-200/70">
            Schedule Box
          </p>
          <h3 className={columnTitleClassName}>{column.title.trim()}</h3>
        </header>
      ) : null}

      <div className="min-h-0 overflow-hidden rounded-[1.1rem] border border-white/8 bg-slate-950/45">
        {table ? (
          <table className="h-full w-full table-fixed border-separate border-spacing-0">
            <colgroup>
              {columnWidths.map((width, index) => (
                <col key={`${column.title ?? "col"}-${index}`} style={{ width }} />
              ))}
            </colgroup>
            <thead className="bg-sky-300/8">
              <tr>
                {table.headers.map((header) => (
                  <th className={headerCellClassName} key={header} scope="col">
                    <span className="block break-words">{header}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr className="bg-transparent even:bg-white/[0.03]" key={`${rowIndex}-${row.join("|")}`}>
                  {row.map((cell, cellIndex) => (
                    <td className={bodyCellClassName} key={`${rowIndex}-${cellIndex}`}>
                      <span className="block break-words">{cell}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex h-full items-center justify-center px-6 py-5 text-center">
            <pre className="max-w-full whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-100">
              {column.markdownTable}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}

export function ScheduleOverlay({ columns, title }: ScheduleOverlayProps) {
  const visibleColumns = columns.slice(0, 3);
  const gridClassName = getGridClassName(visibleColumns.length);

  const titleClassName =
    visibleColumns.length >= 3
      ? "text-[1.65rem] font-semibold tracking-tight text-white"
      : visibleColumns.length === 2
        ? "text-[1.8rem] font-semibold tracking-tight text-white"
        : "text-[2rem] font-semibold tracking-tight text-white";

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_38%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.16),_transparent_35%),linear-gradient(180deg,_#08111d_0%,_#050812_100%)] p-5 md:p-6">
      <div className="grid h-full grid-rows-[auto,1fr] gap-3 rounded-[2.25rem] border border-white/12 bg-slate-950/82 p-4 pt-16 pr-32 shadow-[0_30px_120px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:pr-36 md:p-5 md:pt-16 md:pr-44">
        <header className="flex items-start gap-6">
          <div className="space-y-3">
            <p className="text-[0.72rem] font-medium uppercase tracking-[0.34em] text-sky-200/75">
              AWS At GTC Schedule
            </p>
            <h2 className={titleClassName}>{title?.trim() || "Schedule Snapshot"}</h2>
          </div>
        </header>

        <div className={gridClassName}>
          {visibleColumns.map((column, index) => (
            <ScheduleColumnCard
              column={column}
              key={`${index}-${column.title ?? "schedule-column"}`}
              totalColumnCount={visibleColumns.length}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
