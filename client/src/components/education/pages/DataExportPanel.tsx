import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/auth/useAuth";
import {
  EXPORT_DATASETS,
  prepareDataExport,
  type ExportDatasetKey,
  type ExportFile,
  type ExportFormat,
} from "@/education/dataExportService";

/**
 * Kurum verisini dışa aktarma paneli (2026-10-24, ana plan 2.4).
 *
 * Yalnız yöneticinin Ayarlar → Veri Yönetimi'nde görünür. Bu bir güvenlik
 * sınırı DEĞİLDİR: okuma RLS'ten geçer (yönetici yalnız kendi kurumunu
 * görür) ve denetim kaydını yazan `record_data_export` yönetici değilse
 * reddeder; o reddedilirse dosya da verilmez.
 */
export function DataExportPanel() {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? null;
  const [selected, setSelected] = useState<ExportDatasetKey[]>(
    EXPORT_DATASETS.map(d => d.key)
  );
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: ExportDatasetKey) =>
    setSelected(current =>
      current.includes(key) ? current.filter(k => k !== key) : [...current, key]
    );

  const run = async () => {
    if (!organizationId || progress) return;
    setError(null);
    setProgress("Hazırlanıyor…");
    try {
      const { files, tables } = await prepareDataExport(
        organizationId,
        selected,
        format,
        title => setProgress(`${title} hazırlanıyor…`)
      );
      await downloadAll(files);
      const total = tables.reduce((sum, t) => sum + t.rows.length, 0);
      toast.success("Dışa aktarma hazır", {
        description: `${tables.map(t => `${t.title}: ${t.rows.length}`).join(" · ")} (toplam ${total} satır). İşlem Denetim Kaydı'na yazıldı.`,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Dışa aktarma hazırlanamadı."
      );
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <fieldset>
        <legend className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
          Veri kümeleri
        </legend>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {EXPORT_DATASETS.map(dataset => (
            <label
              key={dataset.key}
              className="flex items-center gap-2 text-[12px] text-slate-700"
            >
              <input
                type="checkbox"
                checked={selected.includes(dataset.key)}
                onChange={() => toggle(dataset.key)}
                disabled={Boolean(progress)}
              />
              {dataset.title}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
          Biçim
        </legend>
        <div className="mt-2 space-y-1.5 text-[12px] text-slate-700">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="export-format"
              checked={format === "xlsx"}
              onChange={() => setFormat("xlsx")}
              disabled={Boolean(progress)}
            />
            Excel — tek dosya, her küme ayrı sayfa
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="export-format"
              checked={format === "csv"}
              onChange={() => setFormat("csv")}
              disabled={Boolean(progress)}
            />
            CSV — her küme ayrı dosya
          </label>
        </div>
      </fieldset>

      <p className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-900">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Dosyada kişisel veri var (veli telefonu, yoklama, notlar, ödemeler).
          Güvenli bir yerde saklayın, gereksiz yere paylaşmayın. Her dışa
          aktarma kim tarafından ve ne zaman yapıldığıyla Denetim Kaydı'na
          yazılır.
        </span>
      </p>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[12px] font-medium text-rose-800"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void run()}
        disabled={!organizationId || selected.length === 0 || Boolean(progress)}
        className="rounded-lg bg-blue-600 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {progress ?? "Dışa aktar"}
      </button>
    </div>
  );
}

async function downloadAll(files: ExportFile[]): Promise<void> {
  for (const [index, file] of files.entries()) {
    // Tarayıcılar art arda indirmeyi engelleyebiliyor; kısa aralık.
    if (index > 0) await new Promise(resolve => setTimeout(resolve, 400));
    const url = URL.createObjectURL(new Blob([file.data], { type: file.mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
