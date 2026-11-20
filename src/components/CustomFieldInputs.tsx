import type { CustomField } from "@/lib/objects";

const label = "mb-1 block text-sm font-medium text-slate-700";

// The form inputs for a list of custom fields. Input names are f_<key>.
export default function CustomFieldInputs({ fields, values, columns = false }: { fields: CustomField[]; values?: Record<string, unknown>; columns?: boolean }) {
  if (fields.length === 0) return null;
  return (
    <div className={columns ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
      {fields.map((f) => {
        const v = values?.[f.key];
        const name = `f_${f.key}`;
        if (f.type === "yesno") {
          return (
            <label key={f.id} className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" name={name} defaultChecked={v === true} className="h-4 w-4 rounded border-slate-300" /> {f.label}
            </label>
          );
        }
        return (
          <label key={f.id} className="block">
            <span className={label}>{f.label}{f.required && <sup className="ml-0.5 text-sm font-bold text-red-600" title="Required">*</sup>}</span>
            {f.type === "dropdown" ? (
              <select name={name} defaultValue={typeof v === "string" ? v : ""} required={f.required} className="input">
                <option value="">Choose…</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                name={name} required={f.required} className="input"
                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                step={f.type === "number" ? "any" : undefined} maxLength={f.type === "text" ? 500 : undefined}
                defaultValue={v === undefined || v === null ? "" : String(v)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
