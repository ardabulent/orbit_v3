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
import { educationKeys, useClasses } from "@/education/educationQueries";
import {
  chooseSheet,
  prepareImport,
  selectedSheets,
  startDraft,
  type ImportDraft,
} from "@/education/importDraft";
import { readImportTable } from "@/education/importFile";
import { guessMapping } from "@/education/importMapping";
import { turkishNameKey } from "@/education/importNormalize";
import {
  findExistingStudentNumbers,
  IMPORT_MAX_ROWS,
  importStudents,
  importTemplateCsv,
  type ImportResult,
  type ImportRow,
} from "@/education/studentImport";
import { ImportMappingStep } from "./ImportMappingStep";
import { ImportOptionsPanel } from "./ImportOptionsPanel";
import { ImportPreview } from "./ImportPreview";

type Checked = {
  draft: ImportDraft;
  rows: ImportRow[];
  rowLabels: string[];
  skipped: number;
  result: ImportResult;
};

type Step =
  | { kind: "idle"; problem?: string }
  | { kind: "reading" }
  | { kind: "mapping"; draft: ImportDraft; busy: boolean; problem?: string }
  | ({ kind: "preview"; saving: boolean } & Checked)
  | { kind: "saved"; result: ImportResult; skipped: number };

const EXCEL_TEMPLATE = "/sablonlar/orbit-ogrenci-sablonu.xlsx";

/**
 * Ayarlar → Veri içe aktarma. İlk sürüm 2026-09-29 (yalnız CSV, sabit
 * başlıklar); 2026-10-01'de Excel (.xlsx) ve SÜTUN EŞLEME; 2026-10-02'de
 * "dosyayı olduğu gibi yükle": bütün sayfalar, sınıf adı eşleme, büyük harf
 * düzeltme, kayıtlıları atlama. Kullanıcının derdi kurumun listesini
 * ORBIT'in biçimine elle yeniden yazmaktı; artık hiçbir hücre elle
 * düzeltilmek zorunda değil.
 *
 * Akış: dosya → eşleme ve seçenekler (hepsi tahminle dolu, düzeltilebilir) →
 * ön izleme (veritabanı her satırı doğrular, hiçbir şey yazılmaz) → hatasızsa
 * tek düğmeyle kayıt — ya hepsi ya hiçbiri. Hesap ve şifre açılmaz.
 * Seçimler `ImportDraft`'ta, satırlar ondan hesaplanır (`importDraft.ts`).
 */
export function SettingsDataImportSection() {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? null;
  const queryClient = useQueryClient();
  const classesQuery = useClasses({ enabled: Boolean(organizationId) });
  const classNames = (classesQuery.data?.rows ?? []).map(c => c.name);
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
    setStep({
      kind: "mapping",
      busy: false,
      draft: startDraft(file.name, read.sheets),
    });
  };

  const editDraft = (draft: ImportDraft) =>
    setStep({ kind: "mapping", busy: false, draft });

  const check = async (draft: ImportDraft) => {
    if (!organizationId) return;
    const prepared = prepareImport(draft, classNames);
    const toMapping = (problem: string) =>
      setStep({ kind: "mapping", busy: false, problem, draft });

    setStep({ kind: "mapping", busy: true, draft });
    try {
      let rows = prepared.rows;
      let rowLabels = prepared.rowLabels;
      let skipped = 0;
      if (draft.skipExisting && draft.mapping.student_number !== null) {
        const existing = await findExistingStudentNumbers(
          organizationId,
          rows.map(row => row.student_number)
        );
        const keep = rows.map(row => !existing.has(row.student_number.trim()));
        skipped = keep.filter(k => !k).length;
        rows = rows.filter((_, i) => keep[i]);
        rowLabels = rowLabels.filter((_, i) => keep[i]);
      }
      if (rows.length === 0) {
        toMapping(
          skipped > 0
            ? `Dosyadaki ${skipped} öğrencinin hepsi zaten kayıtlı; eklenecek yeni öğrenci yok.`
            : "Başlık satırından sonra öğrenci satırı yok."
        );
        return;
      }
      if (rows.length > IMPORT_MAX_ROWS) {
        toMapping(
          `Dosyada ${rows.length} öğrenci var; tek seferde en çok ${IMPORT_MAX_ROWS} aktarılabilir. Sayfaları tek tek seçin ya da dosyayı bölün.`
        );
        return;
      }
      const result = await importStudents(organizationId, rows, true);
      setStep({
        kind: "preview",
        saving: false,
        draft,
        rows,
        rowLabels,
        skipped,
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
      setStep({ kind: "saved", result, skipped: step.skipped });
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
            "2 · Eşleyin",
            "Sütunları ve sınıf adlarını bir kez eşleyin; hücreleri tek tek düzeltmeniz gerekmez.",
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
          Kendi listenizi olduğu gibi yükleyebilirsiniz; şablon yalnız sıfırdan
          liste hazırlayacaklar için.
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
            {step.skipped > 0
              ? ` · ${step.skipped} kayıtlı öğrenci atlandı`
              : ""}
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
        <MappingStep
          step={step}
          classNames={classNames}
          onDraft={editDraft}
          onContinue={draft => void check(draft)}
          onCancel={() => setStep({ kind: "idle" })}
        />
      ) : step.kind === "preview" ? (
        <ImportPreview
          fileName={step.draft.fileName}
          rows={step.rows}
          rowLabels={step.rowLabels}
          skipped={step.skipped}
          result={step.result}
          saving={step.saving}
          onSave={() => void save()}
          onBack={() => editDraft(step.draft)}
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

/** Eşleme ekranı: taslak her değişiklikte yeniden hesaplanır. */
function MappingStep({
  step,
  classNames,
  onDraft,
  onContinue,
  onCancel,
}: {
  step: { draft: ImportDraft; busy: boolean; problem?: string };
  classNames: string[];
  onDraft: (draft: ImportDraft) => void;
  onContinue: (draft: ImportDraft) => void;
  onCancel: () => void;
}) {
  const { draft } = step;
  const prepared = prepareImport(draft, classNames);
  const table = selectedSheets(draft)[0].table;
  const waiting = prepared.unresolvedClasses.length;

  return (
    <>
      <ImportMappingStep
        fileName={draft.fileName}
        table={table}
        headerRow={draft.headerRow}
        mapping={draft.mapping}
        busy={step.busy}
        studentCount={prepared.rows.length}
        sheetCount={selectedSheets(draft).length}
        blockReason={
          waiting > 0
            ? `${waiting} sınıf adı için ORBIT'teki karşılığı seçin.`
            : null
        }
        onHeaderRowChange={headerRow =>
          onDraft({
            ...draft,
            headerRow,
            mapping: guessMapping(table[headerRow] ?? []),
          })
        }
        onMappingChange={mapping => onDraft({ ...draft, mapping })}
        onContinue={() => onContinue(draft)}
        onCancel={onCancel}
      >
        <ImportOptionsPanel
          sheetNames={draft.sheets.map(sheet => sheet.name)}
          sheetChoice={draft.sheetChoice}
          onSheetChoice={choice => onDraft(chooseSheet(draft, choice))}
          sheetAsClass={draft.sheetAsClass}
          onSheetAsClass={on =>
            onDraft({ ...draft, sheetAsClass: on, classChoices: {} })
          }
          classValues={prepared.classValues}
          classNames={classNames}
          classMap={prepared.classMap}
          onClassChoice={(value, orbitClass) =>
            onDraft({
              ...draft,
              classChoices: {
                ...draft.classChoices,
                [turkishNameKey(value)]: orbitClass,
              },
            })
          }
          capsSample={prepared.capsSample}
          fixCaps={prepared.fixCaps}
          onFixCaps={on => onDraft({ ...draft, fixCaps: on })}
          canSkipExisting={draft.mapping.student_number !== null}
          skipExisting={draft.skipExisting}
          onSkipExisting={on => onDraft({ ...draft, skipExisting: on })}
        />
      </ImportMappingStep>
      {step.problem ? (
        <p role="alert" className="mt-2 text-[11px] font-bold text-rose-600">
          {step.problem}
        </p>
      ) : null}
    </>
  );
}
