export type MarkdownTable = {
  headers: string[];
  rows: string[][];
};

function parseMarkdownTableRow(line: string) {
  const trimmed = line.trim();

  if (!trimmed) {
    return [];
  }

  const withoutLeadingPipe = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const withoutOuterPipes = withoutLeadingPipe.endsWith("|")
    ? withoutLeadingPipe.slice(0, -1)
    : withoutLeadingPipe;

  return withoutOuterPipes.split("|").map((cell) => cell.trim());
}

function isAlignmentCell(cell: string) {
  return /^:?-{3,}:?$/.test(cell.replace(/\s+/g, ""));
}

function isAlignmentRow(line: string) {
  const cells = parseMarkdownTableRow(line);
  return cells.length > 0 && cells.every(isAlignmentCell);
}

function normalizeRowLength(cells: string[], expectedLength: number) {
  if (cells.length === expectedLength) {
    return cells;
  }

  if (cells.length < expectedLength) {
    return [...cells, ...Array.from({ length: expectedLength - cells.length }, () => "")];
  }

  return [
    ...cells.slice(0, expectedLength - 1),
    cells.slice(expectedLength - 1).join(" | "),
  ];
}

export function parseMarkdownTable(markdown: string): MarkdownTable | null {
  const lines = markdown.split(/\r?\n/);

  for (let index = 0; index < lines.length - 1; index += 1) {
    const headerLine = lines[index];
    const separatorLine = lines[index + 1];

    if (!headerLine.includes("|") || !separatorLine.includes("|") || !isAlignmentRow(separatorLine)) {
      continue;
    }

    const headers = parseMarkdownTableRow(headerLine);

    if (headers.length === 0) {
      continue;
    }

    const rows: string[][] = [];

    for (let rowIndex = index + 2; rowIndex < lines.length; rowIndex += 1) {
      const rowLine = lines[rowIndex];

      if (!rowLine.trim()) {
        break;
      }

      if (!rowLine.includes("|")) {
        break;
      }

      const row = parseMarkdownTableRow(rowLine);

      if (row.length === 0) {
        continue;
      }

      rows.push(normalizeRowLength(row, headers.length));
    }

    return {
      headers,
      rows,
    };
  }

  return null;
}
