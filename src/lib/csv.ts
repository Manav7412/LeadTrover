// Turns rows into a CSV file that opens correctly in Excel and Google Sheets.

// Spreadsheets treat a cell starting with = + - @ as a formula, which someone could abuse
// (for example through a public form). Defuse those, but leave normal phone numbers alone.
function defuse(text: string): string {
  if (/^[=@\t\r]/.test(text)) return `'${text}`;
  if (/^[+-]/.test(text) && !/^[+-]?[\d\s().-]+$/.test(text)) return `'${text}`;
  return text;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = defuse(String(value));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: string[], rows: unknown[][]): string {
  const lines = [columns, ...rows].map((r) => r.map(cell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n"; // BOM so Excel reads accents correctly
}

export function csvResponse(name: string, csv: string): Response {
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leadtrove-${name}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

// The database hands back at most 1,000 rows per request, so keep asking until we have them all.
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) return all;
  }
}

export const yesNo = (b: boolean) => (b ? "Yes" : "No");
export const isoDate = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
