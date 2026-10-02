import {
  buildFromSheets,
  detectHeaderRow,
  guessMapping,
  type ImportMapping,
  type ImportSheet,
} from "./importMapping";
import {
  applyClassMap,
  applyNameFix,
  distinctClassValues,
  fixAllCaps,
  initialClassMap,
  mostlyAllCaps,
  unresolvedClassValues,
  type ClassMap,
} from "./importNormalize";
import type { ImportRow } from "./studentImport";

/**
 * Aktarım taslağı (2026-10-02): kullanıcının eşleme ekranındaki bütün
 * seçimleri. Satırlar her çizimde bundan yeniden hesaplanır (en çok 500
 * satır); ayrı ayrı tutulan ve birbirinden kayan durum yoktur.
 */
export type ImportDraft = {
  fileName: string;
  sheets: ImportSheet[];
  /** "all" ya da tek sayfanın sırası. */
  sheetChoice: "all" | number;
  /** Sütun eşlemesinin dayandığı (ilk seçili) sayfadaki başlık satırı. */
  headerRow: number;
  mapping: ImportMapping;
  sheetAsClass: boolean;
  /** Yalnız kullanıcının seçtikleri; öneriler `prepareImport`'ta eklenir. */
  classChoices: ClassMap;
  /** null: öneriye uy (adların çoğu büyük harfse düzelt). */
  fixCaps: boolean | null;
  skipExisting: boolean;
};

/** Excel'in kendi verdiği sayfa adları sınıf adı değildir. */
const DEFAULT_SHEET_NAME = /^(sayfa|sheet|tablo|çalışma sayfası)\s*\d+$/i;

export function selectedSheets(draft: ImportDraft): ImportSheet[] {
  return draft.sheetChoice === "all"
    ? draft.sheets
    : [draft.sheets[draft.sheetChoice]];
}

/** Dosya okununca ilk taslak: başlık ve sütunlar tahmin edilir. */
export function startDraft(
  fileName: string,
  sheets: ImportSheet[]
): ImportDraft {
  const headerRow = detectHeaderRow(sheets[0].table);
  const mapping = guessMapping(sheets[0].table[headerRow] ?? []);
  return {
    fileName,
    sheets,
    sheetChoice: "all",
    headerRow,
    mapping,
    sheetAsClass:
      sheets.length > 1 &&
      sheets.every(sheet => !DEFAULT_SHEET_NAME.test(sheet.name.trim())),
    classChoices: {},
    fixCaps: null,
    skipExisting: mapping.student_number !== null,
  };
}

/** Sayfa seçimi değişince başlık ve sütunlar yeni ilk sayfaya göre kurulur. */
export function chooseSheet(
  draft: ImportDraft,
  choice: "all" | number
): ImportDraft {
  const first = choice === "all" ? draft.sheets[0] : draft.sheets[choice];
  const headerRow = detectHeaderRow(first.table);
  return {
    ...draft,
    sheetChoice: choice,
    headerRow,
    mapping: guessMapping(first.table[headerRow] ?? []),
    classChoices: {},
  };
}

export type PreparedImport = {
  rows: ImportRow[];
  rowLabels: string[];
  classValues: string[];
  /** Öneriler + kullanıcının seçimleri. */
  classMap: ClassMap;
  unresolvedClasses: string[];
  /** Büyük harfli bir ad varsa örnek; yoksa null (seçenek gösterilmez). */
  capsSample: { from: string; to: string } | null;
  fixCaps: boolean;
};

export function prepareImport(
  draft: ImportDraft,
  classNames: string[]
): PreparedImport {
  const built = buildFromSheets(
    selectedSheets(draft),
    draft.headerRow,
    draft.mapping,
    draft.sheetAsClass && draft.sheets.length > 1
  );

  const names = built.rows.flatMap(r => [r.full_name, r.guardian_name]);
  const capsName = names.find(name => fixAllCaps(name) !== name) ?? null;
  const fixCaps =
    draft.fixCaps ?? mostlyAllCaps(built.rows.map(r => r.full_name));

  const classValues = distinctClassValues(built.rows);
  const classMap = {
    ...initialClassMap(classValues, classNames),
    ...draft.classChoices,
  };

  const named = fixCaps ? applyNameFix(built.rows) : built.rows;
  return {
    rows: applyClassMap(named, classMap),
    rowLabels: built.rowLabels,
    classValues,
    classMap,
    unresolvedClasses: unresolvedClassValues(classValues, classMap),
    capsSample: capsName ? { from: capsName, to: fixAllCaps(capsName) } : null,
    fixCaps,
  };
}
