import type { ImportRow } from "./studentImport";

/**
 * Toplu öğrenci aktarımında SÜTUN EŞLEME (2026-10-01).
 *
 * Kullanıcı geri bildirimi: "nasıl çalışıyor, hangi formatlar, şablon var
 * mı?" Kurumların elindeki listeler ORBIT şablonunun başlıklarını taşımaz
 * ("Adı", "Soyadı", "Okul No", "Şube", "Veli GSM"…), başlık çoğu zaman ilk
 * satırda değildir (üstte okul adı, tarih). Bu modül dosyayı bir tablo
 * olarak alır; başlık satırını ve sütunları TAHMİN eder, kullanıcı ekranda
 * düzeltir. İş kuralları burada değil, `import_students`'tadır (K-06).
 */

/** Dosyadan okunmuş ham tablo: her hücre metin. */
export type ImportTable = string[][];

export type ImportField =
  | "full_name"
  | "last_name"
  | "student_number"
  | "class_name"
  | "guardian_name"
  | "guardian_phone";

/** Alan → dosyadaki sütun sırası (0'dan) ya da kullanılmıyor (null). */
export type ImportMapping = Record<ImportField, number | null>;

export const IMPORT_FIELDS: {
  key: ImportField;
  label: string;
  hint: string;
  required?: boolean;
}[] = [
  {
    key: "full_name",
    label: "Ad Soyad",
    hint: "Ad ve soyad tek sütundaysa onu, ayrıysa yalnız ad sütununu seçin",
    required: true,
  },
  {
    key: "last_name",
    label: "Soyad (ayrı sütunsa)",
    hint: "Soyad ayrı bir sütundaysa seçin; ada eklenir",
  },
  { key: "student_number", label: "Öğrenci No", hint: "Kurumda tekil" },
  {
    key: "class_name",
    label: "Sınıf",
    hint: "ORBIT'teki sınıf adıyla aynı olmalı (ör. 12-A Sayısal)",
  },
  { key: "guardian_name", label: "Veli Ad Soyad", hint: "" },
  {
    key: "guardian_phone",
    label: "Veli Telefon",
    hint: "Aynı telefonlu kardeşler tek veliye bağlanır",
  },
];

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[.:_*()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Bilinen başlık yazımları. Karşılaştırma küçük harf ve noktalama
 * olmadan yapılır ("Öğrenci No:" = "öğrenci no").
 */
const SYNONYMS: Record<ImportField, string[]> = {
  full_name: [
    "ad soyad",
    "adı soyadı",
    "ad soyadı",
    "adı ve soyadı",
    "öğrenci ad soyad",
    "öğrenci adı soyadı",
    "öğrenci adı",
    "öğrenci",
    "isim soyisim",
    "isim",
    "ad",
    "adı",
  ],
  last_name: ["soyad", "soyadı", "soyisim"],
  student_number: [
    "öğrenci no",
    "öğrenci numarası",
    "okul no",
    "okul numarası",
    "numara",
    "no",
    "numarası",
  ],
  class_name: ["sınıf", "sınıfı", "şube", "sınıf şube", "sınıf adı", "grup"],
  guardian_name: [
    "veli ad soyad",
    "veli adı soyadı",
    "veli adı",
    "veli",
    "veli ismi",
  ],
  guardian_phone: [
    "veli telefon",
    "veli telefonu",
    "veli tel",
    "veli gsm",
    "veli cep",
    "veli cep telefonu",
    "telefon",
    "tel",
    "gsm",
    "cep telefonu",
    "cep",
  ],
};

const LOOKUP = new Map<string, ImportField>();
for (const [field, names] of Object.entries(SYNONYMS) as [
  ImportField,
  string[],
][]) {
  for (const name of names) LOOKUP.set(normalize(name), field);
}

/** Bir başlık hücresi hangi alana benziyor (bilinmiyorsa null). */
export function fieldForHeader(cell: string): ImportField | null {
  return LOOKUP.get(normalize(cell)) ?? null;
}

/** Başlık satırı ilk kaç satırda aranır (ekrandaki seçici de bu kadar gösterir). */
export const HEADER_SCAN_ROWS = 10;

/**
 * Başlık satırı: ilk on satırdan en çok bilinen başlığı taşıyanı. Hiçbiri
 * tanınmazsa ilk satır (kullanıcı ekranda değiştirir).
 */
export function detectHeaderRow(table: ImportTable): number {
  let best = 0;
  let bestScore = 0;
  table.slice(0, HEADER_SCAN_ROWS).forEach((row, index) => {
    const score = new Set(row.map(fieldForHeader).filter(Boolean)).size;
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });
  return best;
}

export const EMPTY_MAPPING: ImportMapping = {
  full_name: null,
  last_name: null,
  student_number: null,
  class_name: null,
  guardian_name: null,
  guardian_phone: null,
};

/** Başlık satırından ilk tahmin; her alan en fazla bir sütuna, ilk eşleşen. */
export function guessMapping(header: string[]): ImportMapping {
  const mapping: ImportMapping = { ...EMPTY_MAPPING };
  header.forEach((cell, index) => {
    const field = fieldForHeader(cell);
    if (field && mapping[field] === null) mapping[field] = index;
  });
  return mapping;
}

/**
 * Excel telefonu sayı saklayınca baştaki 0 düşer: "5321234567". On haneli,
 * 5 ile başlayan bir cep numarasına 0 geri eklenir; diğerleri olduğu gibi.
 */
export function restoreLeadingZero(phone: string): string {
  const trimmed = phone.trim();
  return /^5\d{9}$/.test(trimmed) ? `0${trimmed}` : trimmed;
}

export type BuiltImport = {
  rows: ImportRow[];
  /** `rows[i]` dosyanın kaçıncı satırı (1'den) — hata iletisi için. */
  lineNumbers: number[];
};

/**
 * Eşlemeye göre aktarım satırlarını kurar. Başlıktan sonraki, eşlenen
 * hücrelerinin hepsi boş olan satırlar atlanır (Excel'in sondaki boşları).
 */
export function buildImportRows(
  table: ImportTable,
  headerRow: number,
  mapping: ImportMapping
): BuiltImport {
  const read = (cells: string[], field: ImportField) => {
    const index = mapping[field];
    return index === null ? "" : (cells[index] ?? "").trim();
  };

  const rows: ImportRow[] = [];
  const lineNumbers: number[] = [];
  table.slice(headerRow + 1).forEach((cells, offset) => {
    const first = read(cells, "full_name");
    const last = read(cells, "last_name");
    const row: ImportRow = {
      full_name: [first, last].filter(Boolean).join(" "),
      student_number: read(cells, "student_number"),
      class_name: read(cells, "class_name"),
      guardian_name: read(cells, "guardian_name"),
      guardian_phone: restoreLeadingZero(read(cells, "guardian_phone")),
    };
    if (Object.values(row).every(value => value === "")) return;
    rows.push(row);
    lineNumbers.push(headerRow + offset + 2);
  });
  return { rows, lineNumbers };
}

/** Eşleme kaydedilebilir mi; değilse kullanıcıya söylenecek sebep. */
export function mappingProblem(mapping: ImportMapping): string | null {
  if (mapping.full_name === null) {
    return "“Ad Soyad” için bir sütun seçin; bu alan zorunlu.";
  }
  const used = Object.values(mapping).filter(
    (index): index is number => index !== null
  );
  if (new Set(used).size !== used.length) {
    return "Aynı sütun iki alana seçilmiş; her sütun bir alana gider.";
  }
  return null;
}

/** 0 → A, 25 → Z, 26 → AA (Excel sütun harfi). */
export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rest = (n - 1) % 26;
    letters = String.fromCharCode(65 + rest) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}
