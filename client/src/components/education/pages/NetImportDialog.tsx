import { useMemo, useState } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ExamSection } from "@/education/examNetService";
import { readImportTable } from "@/education/importFile";
import {
  columnLetter,
  HEADER_SCAN_ROWS,
  type ImportSheet,
} from "@/education/importMapping";
import {
  buildNetImport,
  guessNetMapping,
  netColumnLabels,
  netMappingProblem,
  type NetCell,
  type NetImportMapping,
  type NetImportStudent,
} from "@/education/netImport";

const SELECT =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] outline-none focus:border-blue-500";

type Loaded = { fileName: string; sheets: ImportSheet[]; sheetIndex: number };

/**
 * Deneme sonucunu dosyadan aktarma diyaloğu (2026-10-12, v1.5-16).
 *
 * Dosya → sütun eşleme → özet → net tablosuna aktar. Kayıt yapmaz: hücreler
 * tabloya dolar, kullanıcı bakıp "Netleri kaydet"e basar. Dosya sunucuya
 * gönderilmez.
 */
export function NetImportDialog({
  open,
  onOpenChange,
  sections,
  students,
  absentStudentIds,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: ExamSection[];
  students: NetImportStudent[];
  absentStudentIds: Set<string>;
  onApply: (cells: Record<string, NetCell>, studentCount: number) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mapping, setMapping] = useState<NetImportMapping | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const table = useMemo(
    () => loaded?.sheets[loaded.sheetIndex]?.table ?? [],
    [loaded]
  );

  const reset = () => {
    setLoaded(null);
    setMapping(null);
    setReadError(null);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setReadError(null);
    const result = await readImportTable(file);
    setReading(false);
    if (!result.ok) {
      setReadError(result.message);
      return;
    }
    setLoaded({ fileName: file.name, sheets: result.sheets, sheetIndex: 0 });
    setMapping(guessNetMapping(result.sheets[0].table, sections));
  };

  const chooseSheet = (index: number) => {
    if (!loaded) return;
    setLoaded({ ...loaded, sheetIndex: index });
    setMapping(guessNetMapping(loaded.sheets[index].table, sections));
  };

  const labels = useMemo(
    () => (mapping ? netColumnLabels(table, mapping.headerRow) : []),
    [table, mapping]
  );
  const sample = mapping ? (table[mapping.headerRow + 1] ?? []) : [];
  const columnOptions = labels.map((label, index) => ({
    index,
    text: `${columnLetter(index)} · ${label || "(başlıksız)"}${
      sample[index] ? ` — ör. ${sample[index]}` : ""
    }`,
  }));

  const problem = mapping ? netMappingProblem(mapping, sections) : null;
  const result = useMemo(
    () =>
      mapping && !problem
        ? buildNetImport({
            table,
            mapping,
            sections,
            students,
            absentStudentIds,
          })
        : null,
    [table, mapping, problem, sections, students, absentStudentIds]
  );

  const pick = (value: string) => (value === "" ? null : Number(value));
  const columnSelect = (
    value: number | null,
    onChange: (value: number | null) => void,
    label: string
  ) => (
    <select
      aria-label={label}
      className={SELECT}
      value={value ?? ""}
      onChange={e => onChange(pick(e.target.value))}
    >
      <option value="">— seçilmedi —</option>
      {columnOptions.map(option => (
        <option key={option.index} value={option.index}>
          {option.text}
        </option>
      ))}
    </select>
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Deneme sonucunu dosyadan aktar</DialogTitle>
          <DialogDescription>
            Optik okuyucunuzun ya da yayınevinin verdiği Excel (.xlsx) veya CSV
            dosyası. Öğrenciler <strong>öğrenci numarasıyla</strong> eşleşir.
            Sonuçlar önce tabloya dolar; kontrol edip “Netleri kaydet”e basınca
            kaydedilir.
          </DialogDescription>
        </DialogHeader>

        {!loaded ? (
          <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center hover:border-slate-300">
            <UploadCloud className="h-7 w-7 text-slate-400" aria-hidden />
            <span className="text-[13px] font-bold text-slate-700">
              {reading ? "Dosya okunuyor…" : "Dosya seçin"}
            </span>
            <span className="text-[11px] text-slate-500">
              .xlsx en çok 300 KB · .csv en çok 1 MB
            </span>
            <input
              type="file"
              accept=".xlsx,.csv,.txt"
              className="sr-only"
              disabled={reading}
              onChange={e => void handleFile(e.target.files?.[0])}
            />
          </label>
        ) : null}
        {readError ? (
          <p role="alert" className="text-[12px] font-bold text-red-700">
            {readError}
          </p>
        ) : null}

        {loaded && mapping ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-[12px] text-slate-700">
              <FileSpreadsheet
                className="h-4 w-4 shrink-0 text-blue-600"
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate font-bold">
                {loaded.fileName}
              </span>
              <button
                type="button"
                onClick={reset}
                className="text-[11px] font-bold text-blue-700 hover:underline"
              >
                Başka dosya
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {loaded.sheets.length > 1 ? (
                <label className="block text-[11px] font-bold text-slate-600">
                  Sayfa
                  <select
                    className={`${SELECT} mt-1`}
                    value={loaded.sheetIndex}
                    onChange={e => chooseSheet(Number(e.target.value))}
                  >
                    {loaded.sheets.map((sheet, index) => (
                      <option key={sheet.name} value={index}>
                        {sheet.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="block text-[11px] font-bold text-slate-600">
                Başlık satırı
                <select
                  className={`${SELECT} mt-1`}
                  value={mapping.headerRow}
                  onChange={e =>
                    setMapping({
                      ...mapping,
                      headerRow: Number(e.target.value),
                    })
                  }
                >
                  {table.slice(0, HEADER_SCAN_ROWS).map((row, index) => (
                    <option key={index} value={index}>
                      {index + 1}. satır:{" "}
                      {row.filter(Boolean).slice(0, 4).join(" · ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] font-bold text-slate-600">
                Öğrenci numarası
                <div className="mt-1">
                  {columnSelect(
                    mapping.numberColumn,
                    v => setMapping({ ...mapping, numberColumn: v }),
                    "Öğrenci numarası sütunu"
                  )}
                </div>
              </label>
              <label className="block text-[11px] font-bold text-slate-600">
                Ad soyad (isteğe bağlı, yalnız özette)
                <div className="mt-1">
                  {columnSelect(
                    mapping.nameColumn,
                    v => setMapping({ ...mapping, nameColumn: v }),
                    "Ad soyad sütunu"
                  )}
                </div>
              </label>
            </div>

            <div className="rounded-xl border border-slate-200">
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2 text-[11px] font-bold text-slate-500">
                <span>Ders</span>
                <span>Doğru sütunu</span>
                <span>Yanlış sütunu</span>
              </div>
              {sections.map(section => {
                const columns = mapping.sections[section.id] ?? {
                  correct: null,
                  wrong: null,
                };
                const set = (patch: Partial<typeof columns>) =>
                  setMapping({
                    ...mapping,
                    sections: {
                      ...mapping.sections,
                      [section.id]: { ...columns, ...patch },
                    },
                  });
                return (
                  <div
                    key={section.id}
                    className="grid grid-cols-[1fr_1fr_1fr] items-center gap-2 border-b border-slate-50 px-3 py-2 last:border-0"
                  >
                    <span className="text-[12px] font-bold text-slate-800">
                      {section.name}
                      <span className="block text-[10px] font-medium text-slate-400">
                        {section.questionCount} soru
                      </span>
                    </span>
                    {columnSelect(
                      columns.correct,
                      v => set({ correct: v }),
                      `${section.name} doğru sütunu`
                    )}
                    {columnSelect(
                      columns.wrong,
                      v => set({ wrong: v }),
                      `${section.name} yanlış sütunu`
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              Net sütunu gerekmez; ORBIT doğru ve yanlıştan kendisi hesaplar.
              Doğru ve yanlış sütunu seçilmeyen ders aktarılmaz.
            </p>

            {problem ? (
              <p role="alert" className="text-[12px] font-bold text-amber-800">
                {problem}
              </p>
            ) : result ? (
              <div className="space-y-2 rounded-xl border border-slate-200 p-3 text-[12px] text-slate-700">
                <p>
                  <strong>{result.matchedStudents}</strong> öğrencinin sonucu
                  tabloya aktarılacak.
                </p>
                {result.absent.length > 0 ? (
                  <p>
                    “Sınava girmedi” işaretli {result.absent.length} öğrenci
                    atlanacak: {result.absent.join(", ")}.
                  </p>
                ) : null}
                {result.unknown.length > 0 ? (
                  <details>
                    <summary className="cursor-pointer font-bold text-amber-800">
                      {result.unknown.length} numara bu sınavın öğrencileri
                      arasında yok — atlanacak
                    </summary>
                    <ul className="mt-1 list-disc pl-5 text-[11px]">
                      {result.unknown.slice(0, 20).map(u => (
                        <li key={u.row}>
                          {u.row}. satır: {u.number}
                          {u.name ? ` (${u.name})` : ""}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Öğrenci başka bir sınıftaysa ya da numarası ORBIT'te
                      farklı yazılıysa eşleşmez.
                    </p>
                  </details>
                ) : null}
                {result.problems.length > 0 ? (
                  <details open>
                    <summary className="cursor-pointer font-bold text-red-700">
                      {result.problems.length} sorun — bu hücreler
                      aktarılmayacak
                    </summary>
                    <ul className="mt-1 list-disc pl-5 text-[11px]">
                      {result.problems.slice(0, 20).map((p, i) => (
                        <li key={`${p.row}-${i}`}>
                          {p.row}. satır: {p.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <button
            type="button"
            onClick={() => close(false)}
            className="rounded-lg border border-slate-200 px-3.5 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!result || result.matchedStudents === 0}
            onClick={() => {
              if (!result) return;
              onApply(result.cells, result.matchedStudents);
              close(false);
            }}
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-[12px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Tabloya aktar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
