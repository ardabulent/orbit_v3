import type { ImportResult, ImportRow } from "@/education/studentImport";

const FIELD_LABELS: Record<string, string> = {
  full_name: "Ad Soyad",
  student_number: "Öğrenci No",
  class_name: "Sınıf",
  guardian_name: "Veli Ad Soyad",
  guardian_phone: "Veli Telefon",
};

const PREVIEW_ROWS = 10;

/**
 * Toplu aktarım ön izlemesi: hatalar DOSYADAKİ satır numarasıyla (eşleme
 * adımı her satırın kaçıncı satırdan geldiğini taşır; başlık ilk satırda
 * olmayabilir), ilk satırların görünümü ve kaydet düğmesi.
 * Hata varken kaydet düğmesi yoktur — ya hepsi ya hiçbiri.
 */
export function ImportPreview({
  fileName,
  rows,
  lineNumbers,
  result,
  saving,
  onSave,
  onBack,
  onCancel,
}: {
  fileName: string;
  rows: ImportRow[];
  /** `rows[i]` dosyanın kaçıncı satırı. */
  lineNumbers: number[];
  result: ImportResult;
  saving: boolean;
  onSave: () => void;
  /** Sütun eşlemesine geri dön. */
  onBack: () => void;
  onCancel: () => void;
}) {
  const hasErrors = result.errors.length > 0;
  // Sunucu satırı 1'den sayar (gönderilen listenin sırası).
  const lineOf = (row: number) => lineNumbers[row - 1] ?? row;

  return (
    <div className="mt-5 space-y-4">
      <div
        className={`rounded-xl border px-4 py-3 ${
          hasErrors
            ? "border-rose-200 bg-rose-50"
            : "border-emerald-200 bg-emerald-50"
        }`}
      >
        <p
          className={`text-[12px] font-extrabold ${hasErrors ? "text-rose-800" : "text-emerald-800"}`}
        >
          {fileName} · {rows.length} öğrenci ·{" "}
          {hasErrors
            ? `${result.errors.length} hata — hiçbir şey kaydedilmedi`
            : "hata yok, kaydedilmeye hazır"}
        </p>
        {hasErrors ? (
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-[11px] text-rose-800">
            {result.errors.map((error, index) => (
              <li key={`${error.row}-${error.field}-${index}`}>
                <strong>{lineOf(error.row)}. satır</strong> ·{" "}
                {FIELD_LABELS[error.field] ?? error.field}: {error.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[560px] text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-extrabold uppercase tracking-[.06em] text-slate-400">
              <th className="px-3 py-2">Satır</th>
              {Object.values(FIELD_LABELS).map(label => (
                <th key={label} className="px-3 py-2">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, PREVIEW_ROWS).map((row, index) => {
              const rowNo = index + 1;
              const bad = result.errors.some(e => e.row === rowNo);
              return (
                <tr key={rowNo} className={bad ? "bg-rose-50/60" : ""}>
                  <td className="px-3 py-2 text-slate-400">{lineOf(rowNo)}</td>
                  <td className="px-3 py-2 font-bold text-slate-800">
                    {row.full_name || "—"}
                  </td>
                  <td className="px-3 py-2">{row.student_number || "—"}</td>
                  <td className="px-3 py-2">{row.class_name || "—"}</td>
                  <td className="px-3 py-2">{row.guardian_name || "—"}</td>
                  <td className="px-3 py-2">{row.guardian_phone || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > PREVIEW_ROWS ? (
          <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
            İlk {PREVIEW_ROWS} satır gösteriliyor; {rows.length} satırın hepsi
            denetlendi.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {!hasErrors ? (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="h-9 rounded-lg bg-blue-600 px-4 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <span className="text-[12px] font-bold">
              {saving ? "Kaydediliyor…" : `${rows.length} öğrenciyi kaydet`}
            </span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="h-9 rounded-lg border border-slate-200 px-4 text-slate-700 hover:bg-slate-50"
        >
          <span className="text-[12px] font-bold">Eşlemeyi değiştir</span>
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="h-9 rounded-lg border border-slate-200 px-4 text-slate-700 hover:bg-slate-50"
        >
          <span className="text-[12px] font-bold">
            {hasErrors ? "Düzeltip yeniden yükle" : "Vazgeç"}
          </span>
        </button>
      </div>
    </div>
  );
}
