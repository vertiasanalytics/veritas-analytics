/**
 * VeritasDataTable — Tabela de dados dos relatórios Veritas
 *
 * Colunas com suporte a alinhamento e largura relativa.
 * Footer opcional com linha de totais.
 */

export interface TableColumn {
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface DataTableOptions {
  columns: TableColumn[];
  rows: string[][];
  footer?: string[];
  emptyMessage?: string;
}

export function renderVeritasTable(opts: DataTableOptions): string {
  const { columns, rows, footer, emptyMessage = "Nenhum registro." } = opts;

  if (rows.length === 0) {
    return `<p style="font-size:12px;color:#64748b;margin:8px 0;">${emptyMessage}</p>`;
  }

  const colgroup = columns
    .map(c => c.width ? `<col style="width:${c.width}">` : "<col>")
    .join("");

  const thead = columns
    .map(c => `<th class="${c.align ?? "left"}">${c.header}</th>`)
    .join("");

  const tbody = rows
    .map(row =>
      `<tr>${row.map((cell, i) => `<td class="${columns[i]?.align ?? "left"}">${cell}</td>`).join("")}</tr>`
    )
    .join("");

  const tfoot = footer
    ? `<tfoot><tr>${footer.map((cell, i) => `<td class="${columns[i]?.align ?? "left"}">${cell}</td>`).join("")}</tr></tfoot>`
    : "";

  return `
    <table>
      <colgroup>${colgroup}</colgroup>
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
      ${tfoot}
    </table>`;
}
