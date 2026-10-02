import type { ReactNode } from "react";
import {
  columnLetter,
  HEADER_SCAN_ROWS,
  IMPORT_FIELDS,
  mappingProblem,
  type ImportField,
  type ImportMapping,
  type ImportTable,
} from "@/education/importMapping";

const SELECT =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] outline-none focus:border-blue-500";

/**
 * Sütun eşleme adımı (2026-10-01). Dosyanın başlıkları ORBIT'in alanlarına
 * bağlanır; ilk tahmin otomatik gelir, kullanıcı düzeltir. Her seçeneğin
 * yanında ilk öğrenci satırındaki değer görünür ki yanlış sütun fark edilsin.
 */
export function ImportMappingStep({
  fileName,
  table,
  headerRow,
  mapping,
  busy,
  onHeaderRowChange,
  onMappingChange,
  onContinue,
  onCancel,
  blockReason = null,
  studentCount,
  sheetCount = 1,
  children,
}: {
  fileName: string;
  table: ImportTable;
  headerRow: number;
  mapping: ImportMapping;
  busy: boolean;
  onHeaderRowChange: (row: number) => void;
  onMappingChange: (mapping: ImportMapping) => void;
  onContinue: () => void;
  onCancel: () => void;
  /** Eşleme dışında devam etmeyi engelleyen sebep (ör. seçilmemiş sınıf). */
  blockReason?: string | null;
  /** Seçili bütün sayfalardaki öğrenci satırı; verilmezse bu tablodan sayılır. */
  studentCount?: number;
  sheetCount?: number;
  /** Sütun tablosunun altında, düğmelerden önce gösterilir. */
  children?: ReactNode;
}) {
  const header = table[headerRow] ?? [];
  const sample = table[headerRow + 1] ?? [];
  const width = Math.max(...table.slice(0, headerRow + 2).map(r => r.length));
  const columns = Array.from({ length: width }, (_, index) => ({
    index,
    label: `${columnLetter(index)} · ${header[index]?.trim() || "(başlıksız)"}`,
  }));
  const dataRows = studentCount ?? table.length - headerRow - 1;
  const problem = mappingProblem(mapping) ?? blockReason;

  const setField = (field: ImportField, value: string) =>
    onMappingChange({
      ...mapping,
      [field]: value === "" ? null : Number(value),
    });

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
        <p className="text-[12px] font-extrabold text-slate-800">
          {fileName} · {dataRows} öğrenci
          {sheetCount > 1 ? ` · ${sheetCount} sayfa` : ""}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-600">
          Dosyanızdaki sütunları ORBIT'in alanlarıyla eşleyin. Tanıdığımız
          başlıkları sizin için seçtik; yanlışsa değiştirin.
        </p>
      </div>

      <label className="grid max-w-xs gap-1 text-[11px] font-bold text-slate-600">
        Başlıklar hangi satırda?
        <select
          value={headerRow}
          onChange={e => onHeaderRowChange(Number(e.target.value))}
          className={SELECT}
        >
          {table.slice(0, HEADER_SCAN_ROWS).map((row, index) => (
            <option key={index} value={index}>
              {index + 1}. satır —{" "}
              {row.filter(Boolean).slice(0, 3).join(", ").slice(0, 50) ||
                "(boş)"}
            </option>
          ))}
        </select>
      </label>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-extrabold uppercase tracking-[.06em] text-slate-400">
              <th className="px-3 py-2">ORBIT alanı</th>
              <th className="px-3 py-2">Dosyadaki sütun</th>
              <th className="px-3 py-2">İlk satırdaki değer</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {IMPORT_FIELDS.map(field => {
              const index = mapping[field.key];
              return (
                <tr key={field.key}>
                  <td className="px-3 py-2 align-top">
                    <span className="font-bold text-slate-800">
                      {field.label}
                      {field.required ? (
                        <span className="text-rose-600"> *</span>
                      ) : null}
                    </span>
                    {field.hint ? (
                      <span className="block text-[10px] text-slate-500">
                        {field.hint}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <select
                      aria-label={`${field.label} sütunu`}
                      value={index ?? ""}
                      onChange={e => setField(field.key, e.target.value)}
                      className={SELECT}
                    >
                      <option value="">— kullanma —</option>
                      {columns.map(column => (
                        <option key={column.index} value={column.index}>
                          {column.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 align-top text-slate-600">
                    {index === null ? "—" : sample[index] || "(boş)"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {children}

      {problem ? (
        <p role="alert" className="text-[11px] font-bold text-rose-600">
          {problem}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onContinue}
          disabled={busy || problem !== null || dataRows <= 0}
          className="h-9 rounded-lg bg-blue-600 px-4 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <span className="text-[12px] font-bold">
            {busy ? "Denetleniyor…" : "Ön izle"}
          </span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-9 rounded-lg border border-slate-200 px-4 text-slate-700 hover:bg-slate-50"
        >
          <span className="text-[12px] font-bold">Başka dosya seç</span>
        </button>
      </div>
    </div>
  );
}
