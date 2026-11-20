"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { importContacts, type ImportResult, type ImportRow } from "@/app/(app)/contacts/actions";

// Reads CSV text into rows of cells. Handles quoted cells, commas inside quotes and Windows line endings.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

// Column headers we recognise (capitals and spaces are ignored), so Google Sheets exports just work.
const ALIASES: Record<string, string[]> = {
  first_name: ["firstname", "first", "givenname"],
  last_name: ["lastname", "last", "surname", "familyname"],
  full_name: ["name", "fullname", "contactname", "contact"],
  email: ["email", "emailaddress", "mail"],
  phone: ["phone", "phonenumber", "mobile", "telephone", "cell"],
  company: ["company", "companyname", "business", "businessname", "organisation", "organization"],
  source: ["source", "leadsource"],
  status: ["status", "stage"],
  tags: ["tags", "tag", "labels"],
};

function toRows(grid: string[][]): { rows: ImportRow[]; recognised: string[] } {
  const headers = grid[0].map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const col = (key: string) => headers.findIndex((h) => ALIASES[key].includes(h));
  const idx = Object.fromEntries(Object.keys(ALIASES).map((k) => [k, col(k)]));
  const recognised = Object.keys(ALIASES).filter((k) => idx[k] >= 0).map((k) => (k === "full_name" ? "name" : k.replace("_", " ")));
  const get = (r: string[], k: string) => (idx[k] >= 0 ? (r[idx[k]] ?? "").trim() : "");

  const rows = grid.slice(1).map((r) => {
    let first = get(r, "first_name");
    let last = get(r, "last_name");
    if (!first && !last && idx.full_name >= 0) {
      const [f, ...rest] = get(r, "full_name").split(/\s+/);
      first = f ?? ""; last = rest.join(" ");
    }
    return { first_name: first, last_name: last, email: get(r, "email"), phone: get(r, "phone"), company: get(r, "company"), source: get(r, "source"), status: get(r, "status"), tags: get(r, "tags") };
  });
  return { rows, recognised };
}

export default function ImportContacts() {
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<{ rows: ImportRow[]; recognised: string[] } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    setResult(null); setError(""); setParsed(null);
    if (!file) return;
    setFileName(file.name);
    const grid = parseCsv(await file.text());
    if (grid.length < 2) { setError("That file has no data rows."); return; }
    const p = toRows(grid);
    if (!p.recognised.includes("email") && !p.recognised.includes("first name") && !p.recognised.includes("name")) {
      setError("We couldn't find name or email columns. Check the first row has headers like First Name, Last Name, Email, Phone.");
      return;
    }
    if (p.rows.length > 500) { setError("Please import 500 rows or fewer at a time."); return; }
    setParsed(p);
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-slate-900">1. Choose a CSV file</h2>
        <p className="mt-1 text-sm text-slate-500">
          In Google Sheets use <b>File → Download → Comma-separated values (.csv)</b>. The first row must be headers such as
          First Name, Last Name, Email, Phone, Company, Tags. Contacts with an email or phone already in LeadTrove are skipped.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <label className="btn-secondary cursor-pointer">
            Choose file
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <span className="text-sm text-slate-600">{fileName || "No file chosen"}</span>
          <a href="/sample-contacts.csv" download className="ml-auto text-sm font-medium text-accent hover:underline">Download sample file</a>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>

      {parsed && !result && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">2. Check and import</h2>
          <p className="mt-1 text-sm text-slate-500">
            Found <b>{parsed.rows.length}</b> rows. Columns recognised: {parsed.recognised.join(", ")}.
          </p>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">Tags</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.rows.slice(0, 5).map((r, i) => (
                  <tr key={i}><td className="px-3 py-2">{r.first_name} {r.last_name}</td><td className="px-3 py-2">{r.email}</td><td className="px-3 py-2">{r.phone}</td><td className="px-3 py-2">{r.company}</td><td className="px-3 py-2">{r.tags}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.rows.length > 5 && <p className="mt-1 text-xs text-slate-400">Showing the first 5 rows.</p>}
          <button
            className="btn-primary mt-4"
            disabled={pending}
            onClick={() => start(async () => setResult(await importContacts(parsed.rows)))}
          >
            {pending ? "Importing…" : `Import ${parsed.rows.length} contacts`}
          </button>
        </div>
      )}

      {result && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-slate-900">Import finished</h2>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-emerald-50 p-3"><p className="text-2xl font-semibold text-emerald-700">{result.imported}</p><p className="text-xs text-emerald-700">Imported</p></div>
            <div className="rounded-lg bg-amber-50 p-3"><p className="text-2xl font-semibold text-amber-700">{result.duplicates.length}</p><p className="text-xs text-amber-700">Duplicates skipped</p></div>
            <div className="rounded-lg bg-red-50 p-3"><p className="text-2xl font-semibold text-red-700">{result.invalid.length}</p><p className="text-xs text-red-700">Rows with problems</p></div>
          </div>
          {[...result.duplicates, ...result.invalid].length > 0 && (
            <ul className="mt-4 max-h-60 space-y-1 overflow-y-auto text-sm text-slate-600">
              {result.duplicates.map((d) => <li key={"d" + d.line}>Line {d.line}: <b>{d.name}</b> skipped. {d.reason}.</li>)}
              {result.invalid.map((d) => <li key={"i" + d.line}>Line {d.line}: <b>{d.name}</b> not imported. {d.reason}.</li>)}
            </ul>
          )}
          <div className="mt-4 flex gap-2">
            <Link href="/contacts" className="btn-primary">View contacts</Link>
            <button className="btn-secondary" onClick={() => { setResult(null); setParsed(null); setFileName(""); }}>Import another file</button>
          </div>
        </div>
      )}
    </div>
  );
}
