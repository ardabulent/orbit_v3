import type { ImportTable } from "./importMapping";
import type { ExamSection } from "./examNetService";

/**
 * Deneme sonucunu dosyadan aktarma (2026-10-12, ROADMAP v1.5-16).
 *
 * Kurum denemeyi kendi optik okuyucusu ya da yayınevinin sistemiyle okur;
 * elinde öğrenci başına bir satır, ders başına doğru/yanlış sütunları olan
 * bir Excel/CSV vardır. ORBIT yalnız bu sonucu alır (optik okuma kapsam
 * dışı, karar 2026-09-16).
 *
 * Bu modül saf: tabloyu alır, net tablosuna konacak hücreleri ve sorunları
 * döndürür. Kayıt yapmaz — hücreler net tablosuna dolar, kullanıcı bakıp
 * "Netleri kaydet"e basar; doğrulama ve yazma mevcut yoldan geçer.
 *
 * Öğrenci isimle değil öğrenci numarasıyla eşleşir (karar 2026-09-16).
 */

export type NetCell = { correct: string; wrong: string };

/** Ders → doğru ve yanlış sütunu (0'dan), seçilmediyse null. */
export type NetSectionColumns = {
  correct: number | null;
  wrong: number | null;
};

export type NetImportMapping = {
  headerRow: number;
  numberColumn: number | null;
  nameColumn: number | null;
  sections: Record<string, NetSectionColumns>;
};

export type NetImportStudent = {
  studentId: string;
  studentName: string;
  studentCode?: string;
};

export type NetImportResult = {
  /** `${studentId}|${sectionId}` → hücre; yalnız dosyada değeri olanlar. */
  cells: Record<string, NetCell>;
  matchedStudents: number;
  /** Dosyada var, bu sınavın öğrencileri arasında numarası yok. */
  unknown: { row: number; number: string; name: string }[];
  /** Sınava girmedi işaretli öğrenci: atlandı. */
  absent: string[];
  problems: { row: number; message: string }[];
};

const NUMBER_HEADERS = [
  "öğrenci no",
  "ogrenci no",
  "öğrenci numarası",
  "numara",
  "no",
  "okul no",
  "okul numarası",
  "öğr no",
  "öğr. no",
  "sıra no",
];
const NAME_HEADERS = [
  "ad soyad",
  "adı soyadı",
  "öğrenci adı",
  "ad",
  "isim",
  "öğrenci",
];

const norm = (value: string) =>
  value
    .toLocaleLowerCase("tr")
    .replace(/[._:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Başlık satırı: ilk on satırda numara başlığı taşıyan ilk satır; yoksa 0.
 * "Sıra no" numara sayılmaz ama başlığın orada olduğunu söyler.
 */
export function detectNetHeaderRow(table: ImportTable): number {
  for (let i = 0; i < Math.min(table.length, 10); i++) {
    if (table[i].some(cell => NUMBER_HEADERS.includes(norm(cell)))) return i;
  }
  return 0;
}

/**
 * Sütun adları. Yayınevi çıktılarında başlık çoğu zaman iki satırdır: üstte
 * birleştirilmiş "TÜRKÇE", altında "D Y N". Birleştirilmiş hücrenin değeri
 * yalnız ilk sütunda durur; sağa doğru taşınıp alttakiyle birleştirilir:
 * "TÜRKÇE D", "TÜRKÇE Y".
 */
export function netColumnLabels(
  table: ImportTable,
  headerRow: number
): string[] {
  const header = table[headerRow] ?? [];
  const above = headerRow > 0 ? table[headerRow - 1] : [];
  const width = Math.max(header.length, above.length);
  const labels: string[] = [];
  let carried = "";
  for (let i = 0; i < width; i++) {
    const top = (above[i] ?? "").trim();
    if (top) carried = top;
    const own = (header[i] ?? "").trim();
    // Üst satır yalnız alttaki kısa bir alt başlıksa (D, Y, N, B…) eklenir.
    const isSubHeader = /^(d|y|b|n|doğru|yanlış|boş|net)$/i.test(own);
    labels.push(isSubHeader && carried ? `${carried} ${own}` : own || carried);
  }
  return labels;
}

/** Ders adında ayırt etmeyen kelimeler: "Temel Matematik", "Fen Bilimleri". */
const GENERIC_WORDS = new Set([
  "temel",
  "genel",
  "bilimleri",
  "bilgisi",
  "ders",
]);

/** "Türkçe" → "türkçe", "tür"; "Temel Matematik" → "temel matematik", "matematik", "mat"… */
function sectionKeys(name: string): string[] {
  const full = norm(name);
  const words = full
    .split(" ")
    .filter(w => w.length >= 3 && !GENERIC_WORDS.has(w));
  return [full, ...words, ...words.map(w => w.slice(0, 3))].filter(
    k => k.length >= 3
  );
}

function kindOf(label: string): "correct" | "wrong" | null {
  const last = norm(label).split(" ").pop() ?? "";
  if (["d", "doğru", "dogru", "dğr"].includes(last)) return "correct";
  if (["y", "yanlış", "yanlis", "ynl"].includes(last)) return "wrong";
  return null;
}

export function guessNetMapping(
  table: ImportTable,
  sections: ExamSection[]
): NetImportMapping {
  const headerRow = detectNetHeaderRow(table);
  const labels = netColumnLabels(table, headerRow);
  const find = (names: string[]) => {
    const index = labels.findIndex(label => names.includes(norm(label)));
    return index === -1 ? null : index;
  };
  const mapping: NetImportMapping = {
    headerRow,
    numberColumn: find(NUMBER_HEADERS.filter(h => h !== "sıra no")),
    nameColumn: find(NAME_HEADERS),
    sections: {},
  };
  for (const section of sections) {
    const keys = sectionKeys(section.name);
    const columns: NetSectionColumns = { correct: null, wrong: null };
    labels.forEach((label, index) => {
      const kind = kindOf(label);
      if (!kind || columns[kind] !== null) return;
      const words = norm(label).split(" ").slice(0, -1).join(" ");
      if (keys.some(key => words.startsWith(key))) columns[kind] = index;
    });
    mapping.sections[section.id] = columns;
  }
  return mapping;
}

/** Eşlemede eksik olan; boşsa aktarılabilir. */
export function netMappingProblem(
  mapping: NetImportMapping,
  sections: ExamSection[]
): string | null {
  if (mapping.numberColumn === null) {
    return "Öğrenci numarası sütununu seçin; öğrenciler isimle değil numarayla eşleşir.";
  }
  const unmapped = sections.filter(section => {
    const columns = mapping.sections[section.id];
    return !columns || columns.correct === null || columns.wrong === null;
  });
  if (unmapped.length === sections.length) {
    return "En az bir dersin doğru ve yanlış sütununu seçin.";
  }
  return null;
}

/** Numara karşılaştırması: boşluklar atılır; ikisi de sayıysa baştaki sıfır önemsiz. */
export function sameStudentNumber(a: string, b: string): boolean {
  const x = a.replace(/\s+/g, "");
  const y = b.replace(/\s+/g, "");
  if (!x || !y) return false;
  if (x === y) return true;
  return /^\d+$/.test(x) && /^\d+$/.test(y) && Number(x) === Number(y);
}

const COUNT = /^\d+$/;

export function buildNetImport(input: {
  table: ImportTable;
  mapping: NetImportMapping;
  sections: ExamSection[];
  students: NetImportStudent[];
  absentStudentIds: Set<string>;
}): NetImportResult {
  const { table, mapping, sections, students, absentStudentIds } = input;
  const result: NetImportResult = {
    cells: {},
    matchedStudents: 0,
    unknown: [],
    absent: [],
    problems: [],
  };
  const numberColumn = mapping.numberColumn;
  if (numberColumn === null) return result;

  const seen = new Set<string>();
  for (let r = mapping.headerRow + 1; r < table.length; r++) {
    const row = table[r];
    const rowNo = r + 1; // Excel'deki satır numarası
    const number = (row[numberColumn] ?? "").trim();
    if (!number) continue; // boş satır, ara başlık ya da alt toplam
    const name =
      mapping.nameColumn !== null ? (row[mapping.nameColumn] ?? "").trim() : "";

    const student = students.find(
      s => s.studentCode && sameStudentNumber(s.studentCode, number)
    );
    if (!student) {
      result.unknown.push({ row: rowNo, number, name });
      continue;
    }
    if (seen.has(student.studentId)) {
      result.problems.push({
        row: rowNo,
        message: `${number} numarası dosyada ikinci kez geçiyor; ilk satır alındı.`,
      });
      continue;
    }
    seen.add(student.studentId);
    if (absentStudentIds.has(student.studentId)) {
      result.absent.push(student.studentName);
      continue;
    }

    const rowCells: Record<string, NetCell> = {};
    for (const section of sections) {
      const columns = mapping.sections[section.id];
      if (!columns || columns.correct === null || columns.wrong === null)
        continue;
      const correct = (row[columns.correct] ?? "").trim();
      const wrong = (row[columns.wrong] ?? "").trim();
      if (!correct && !wrong) continue; // o derse girilmemiş
      if ((correct && !COUNT.test(correct)) || (wrong && !COUNT.test(wrong))) {
        result.problems.push({
          row: rowNo,
          message: `${student.studentName} · ${section.name}: doğru ve yanlış sıfır ya da pozitif tam sayı olmalı ("${correct}", "${wrong}").`,
        });
        continue;
      }
      if (Number(correct || 0) + Number(wrong || 0) > section.questionCount) {
        result.problems.push({
          row: rowNo,
          message: `${student.studentName} · ${section.name}: doğru + yanlış ${section.questionCount} soruyu aşıyor.`,
        });
        continue;
      }
      rowCells[`${student.studentId}|${section.id}`] = {
        correct: correct || "0",
        wrong: wrong || "0",
      };
    }
    Object.assign(result.cells, rowCells);
    if (Object.keys(rowCells).length > 0) result.matchedStudents++;
  }
  return result;
}
