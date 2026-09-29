import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, UploadCloud } from "lucide-react";
import { useAuth } from "@/auth/useAuth";
import { isDemoMode } from "@/auth/runtime";
import { educationKeys } from "@/education/educationQueries";
import {
  IMPORT_MAX_BYTES,
  importStudents,
  importTemplateCsv,
  parseStudentCsv,
  type ImportResult,
  type ImportRow,
} from "@/education/studentImport";
import { ImportPreview } from "./ImportPreview";

type Step =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "problem"; message: string }
  | {
      kind: "preview";
      fileName: string;
      rows: ImportRow[];
      result: ImportResult;
    }
  | {
      kind: "saving";
      fileName: string;
      rows: ImportRow[];
      result: ImportResult;
    }
  | { kind: "saved"; result: ImportResult };

/**
 * Ayarlar → Veri içe aktarma (karar 2026-09-29): öğrencileri bir CSV
 * dosyasıyla toplu ekleme. Önce ön izleme (veritabanı her satırı doğrular),
 * hatasızsa tek düğmeyle kayıt — ya hepsi ya hiçbiri. Hesap ve şifre açılmaz.
 */
export function SettingsDataImportSection() {
  const { identity } = useAuth();
  const organizationId = identity?.membership?.organizationId ?? null;
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>({ kind: "idle" });

  const downloadTemplate = () => {
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
    if (!organizationId) return;
    if (file.size > IMPORT_MAX_BYTES) {
      setStep({ kind: "problem", message: "Dosya 1 MB'tan büyük olamaz." });
      return;
    }
    setStep({ kind: "checking" });
    const parsed = parseStudentCsv(await file.text());
    if (!parsed.ok) {
      setStep({ kind: "problem", message: parsed.message });
      return;
    }
    try {
      const result = await importStudents(organizationId, parsed.rows, true);
      setStep({
        kind: "preview",
        fileName: file.name,
        rows: parsed.rows,
        result,
      });
    } catch (error) {
      setStep({
        kind: "problem",
        message:
          error instanceof Error ? error.message : "Dosya denetlenemedi.",
      });
    }
  };

  const save = async () => {
    if (step.kind !== "preview" || !organizationId) return;
    setStep({ ...step, kind: "saving" });
    try {
      const result = await importStudents(organizationId, step.rows, false);
      if (!result.saved) {
        // Ön izlemeden sonra biri aynı numarayı eklemiş olabilir; yeni
        // hatalar gösterilir, hiçbir şey yazılmamıştır.
        setStep({ ...step, kind: "preview", result });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: educationKeys.all });
      setStep({ kind: "saved", result });
    } catch (error) {
      setStep({
        kind: "problem",
        message:
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
        Öğrenci listenizi Excel'de hazırlayıp{" "}
        <strong>"CSV UTF-8 (virgülle ayrılmış)"</strong> olarak kaydedin ve
        buraya yükleyin. Önce bir ön izleme görürsünüz; hiçbir şey onayınız
        olmadan kaydedilmez. Hesap ve şifre açılmaz, yalnız kayıtlar oluşur.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="text-[12px] font-bold">Şablonu indir</span>
        </button>
        <span className="text-[11px] text-slate-500">
          Sütunlar: Ad Soyad (zorunlu) · Öğrenci No · Sınıf · Veli Ad Soyad ·
          Veli Telefon — en çok 500 satır
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
      ) : step.kind === "preview" || step.kind === "saving" ? (
        <ImportPreview
          fileName={step.fileName}
          rows={step.rows}
          result={step.result}
          saving={step.kind === "saving"}
          onSave={() => void save()}
          onCancel={() => setStep({ kind: "idle" })}
        />
      ) : (
        <label className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-10 text-center hover:border-blue-300">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <UploadCloud className="h-6 w-6" />
          </span>
          <span className="text-[13px] font-extrabold text-slate-700">
            {step.kind === "checking" ? "Denetleniyor…" : "CSV dosyası seçin"}
          </span>
          {step.kind === "problem" ? (
            <span role="alert" className="text-[11px] font-bold text-rose-600">
              {step.message}
            </span>
          ) : null}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={step.kind === "checking" || !organizationId}
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
