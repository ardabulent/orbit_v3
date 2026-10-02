import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  UploadCloud,
} from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { isDemoMode } from "@/auth/runtime";
import { educationKeys } from "@/education/educationQueries";
import { readImportTable } from "@/education/importFile";
import {
  buildImportRows,
  detectHeaderRow,
  guessMapping,
  type ImportMapping,
  type ImportTable,
} from "@/education/importMapping";
import {
  IMPORT_MAX_ROWS,
  importStudents,
  importTemplateCsv,
  type ImportResult,
  type ImportRow,
} from "@/education/studentImport";
import { ImportMappingStep } from "./ImportMappingStep";
import { ImportPreview } from "./ImportPreview";

type Source = { fileName: string; table: ImportTable };
type Mapped = Source & { headerRow: number; mapping: ImportMapping };
type Checked = Mapped & {
  rows: ImportRow[];
  lineNumbers: number[];
  result: ImportResult;
};

type Step =
  | { kind: "idle"; problem?: string }
  | { kind: "reading" }
  | ({ kind: "mapping"; busy: boolean; problem?: string } & Mapped)
  | ({ kind: "preview"; saving: boolean } & Checked)
  | { kind: "saved"; result: ImportResult };

const EXCEL_TEMPLATE = "/sablonlar/orbit-ogrenci-sablonu.xlsx";

/**
 * Ayarlar → Veri içe aktarma. İlk sürüm 2026-09-29 (yalnız CSV, sabit
 * başlıklar); 2026-10-01'de kullanıcı geri bildirimiyle ("nasıl çalışıyor,
 * hangi format, şablon?") Excel (.xlsx) ve SÜTUN EŞLEME adımı eklendi.
 *
 * Akış: dosya → sütun eşleme (otomatik tahmin, düzeltilebilir) → ön izleme
 * (veritabanı her satırı doğrular, hiçbir şey yazılmaz) → hatasızsa tek
 * düğmeyle kayıt — ya hepsi ya hiçbiri. Hesap ve şifre açılmaz.
 */
export function SettingsDataImportSection() {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? null;
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>({ kind: "idle" });

  const downloadCsvTemplate = () => {
    const blob = new Blob([importTemplateCsv()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "orbit-ogrenci-sablonu.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const readFile = async (file: File) => {
    setStep({ kind: "reading" });
    const read = await readImportTable(file);
    if (!read.ok) {
      setStep({ kind: "idle", problem: read.message });
      return;
    }
    const headerRow = detectHeaderRow(read.table);
    setStep({
      kind: "mapping",
      busy: false,
      fileName: file.name,
      table: read.table,
      headerRow,
      mapping: guessMapping(read.table[headerRow] ?? []),
    });
  };

  const check = async (from: Mapped) => {
    if (!organizationId) return;
    // Yalnız eşleme alanları alınır: çağıran `step`'i verir ve onun `kind`
    // alanı aşağıdaki yaymalarda "preview"in üzerine yazıyordu (2026-10-02,
    // tarayıcıda yakalandı: ön izleme isteği gidiyor, ekran eşlemede kalıyordu).
    const mapped: Mapped = {
      fileName: from.fileName,
      table: from.table,
      headerRow: from.headerRow,
      mapping: from.mapping,
    };
    const { rows, lineNumbers } = buildImportRows(
      mapped.table,
      mapped.headerRow,
      mapped.mapping
    );
    const toMapping = (problem: string) =>
      setStep({ kind: "mapping", busy: false, problem, ...mapped });
    if (rows.length === 0) {
      toMapping("Başlık satırından sonra öğrenci satırı yok.");
      return;
    }
    if (rows.length > IMPORT_MAX_ROWS) {
      toMapping(
        `Dosyada ${rows.length} öğrenci var; tek seferde en çok ${IMPORT_MAX_ROWS} aktarılabilir. Dosyayı bölün.`
      );
      return;
    }
    setStep({ kind: "mapping", busy: true, ...mapped });
    try {
      const result = await importStudents(organizationId, rows, true);
      setStep({
        kind: "preview",
        saving: false,
        ...mapped,
        rows,
        lineNumbers,
        result,
      });
    } catch (error) {
      toMapping(
        error instanceof Error ? error.message : "Dosya denetlenemedi."
      );
    }
  };

  const save = async () => {
    if (step.kind !== "preview" || !organizationId) return;
    setStep({ ...step, saving: true });
    try {
      const result = await importStudents(organizationId, step.rows, false);
      if (!result.saved) {
        // Ön izlemeden sonra biri aynı numarayı eklemiş olabilir; yeni
        // hatalar gösterilir, hiçbir şey yazılmamıştır.
        setStep({ ...step, saving: false, result });
        return;
      }
      setStep({ kind: "saved", result });
      void queryClient.invalidateQueries({ queryKey: educationKeys.all });
    } catch (error) {
      setStep({
        kind: "idle",
        problem:
          error instanceof Error ? error.message : "Aktarım tamamlanamadı.",
      });
    }
  };

  return (
    <>
      <h2 className="font-display text-[18px] font-extrabold text-slate-900">
        Öğrencileri toplu ekle
      </h2>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">
        Elinizdeki öğrenci listesini (Excel ya da CSV) yükleyin. Sütun adları
        şablonla aynı olmak zorunda değil; yükledikten sonra hangi sütunun ne
        olduğunu siz seçersiniz. Hiçbir şey onayınız olmadan kaydedilmez. Hesap
        ve şifre açılmaz, yalnız öğrenci ve veli kayıtları oluşur.
      </p>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {[
          [
            "1 · Dosyayı seçin",
            "Excel (.xlsx, en çok 300 KB) ya da CSV (en çok 1 MB). Tek seferde 500 öğrenci.",
          ],
          [
            "2 · Sütunları eşleyin",
            "Ad Soyad zorunlu; numara, sınıf, veli adı ve telefonu isteğe bağlı.",
          ],
          [
            "3 · Ön izleyip kaydedin",
            "Hatalı satırlar numarasıyla gösterilir; hata yoksa tek düğme.",
          ],
        ].map(([title, text]) => (
          <li
            key={title}
            className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5"
          >
            <p className="text-[12px] font-extrabold text-slate-800">{title}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={EXCEL_TEMPLATE}
          download
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-slate-700 hover:bg-slate-50"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-[12px] font-bold">Excel şablonu</span>
        </a>
        <button
          type="button"
          onClick={downloadCsvTemplate}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="text-[12px] font-bold">CSV şablonu</span>
        </button>
        <span className="text-[11px] text-slate-500">
          Sınıf adı ORBIT'teki sınıfla aynı olmalı; sınıf yoksa önce Sınıflar
          sekmesinden açın.
        </span>
      </div>

      {isDemoMode ? (
        <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-600">
          Demo modunda toplu aktarım kapalıdır.
        </p>
      ) : step.kind === "saved" ? (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="flex items-center gap-2 text-[13px] font-extrabold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            {step.result.students} öğrenci eklendi
          </p>
          <p className="mt-1 text-[11px] text-emerald-800">
            {step.result.enrollments ?? 0} sınıf kaydı ·{" "}
            {step.result.guardiansCreated ?? 0} yeni veli ·{" "}
            {step.result.guardiansReused ?? 0} mevcut veliye bağlandı
          </p>
          <button
            type="button"
            onClick={() => setStep({ kind: "idle" })}
            className="mt-3 text-[12px] font-bold text-emerald-900 underline"
          >
            Başka bir dosya yükle
          </button>
        </div>
      ) : step.kind === "mapping" ? (
        <>
          <ImportMappingStep
            fileName={step.fileName}
            table={step.table}
            headerRow={step.headerRow}
            mapping={step.mapping}
            busy={step.busy}
            onHeaderRowChange={headerRow =>
              setStep({
                ...step,
                problem: undefined,
                headerRow,
                mapping: guessMapping(step.table[headerRow] ?? []),
              })
            }
            onMappingChange={mapping =>
              setStep({ ...step, problem: undefined, mapping })
            }
            onContinue={() => void check(step)}
            onCancel={() => setStep({ kind: "idle" })}
          />
          {step.problem ? (
            <p
              role="alert"
              className="mt-2 text-[11px] font-bold text-rose-600"
            >
              {step.problem}
            </p>
          ) : null}
        </>
      ) : step.kind === "preview" ? (
        <ImportPreview
          fileName={step.fileName}
          rows={step.rows}
          lineNumbers={step.lineNumbers}
          result={step.result}
          saving={step.saving}
          onSave={() => void save()}
          onBack={() =>
            setStep({
              kind: "mapping",
              busy: false,
              fileName: step.fileName,
              table: step.table,
              headerRow: step.headerRow,
              mapping: step.mapping,
            })
          }
          onCancel={() => setStep({ kind: "idle" })}
        />
      ) : (
        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <UploadCloud className="h-6 w-6" />
          </span>
          <span className="text-[13px] font-extrabold text-slate-700">
            {step.kind === "reading"
              ? "Dosya okunuyor…"
              : "Excel ya da CSV dosyası seçin"}
          </span>
          <span className="text-[11px] text-slate-500">
            .xlsx veya .csv · eski .xls için Excel'de “Farklı Kaydet → .xlsx”
          </span>
          {step.kind === "idle" && step.problem ? (
            <span role="alert" className="text-[11px] font-bold text-rose-600">
              {step.problem}
            </span>
          ) : null}
          <input
            type="file"
            accept=".xlsx,.csv,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={step.kind === "reading" || !organizationId}
            className="sr-only"
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void readFile(file);
            }}
          />
        </label>
      )}
    </>
  );
}
